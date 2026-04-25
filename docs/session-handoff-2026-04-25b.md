# Session Handoff — 2026-04-25 (Session B)

> Paste into a new Claude Code session. Covers the investigation of the 500 error on profile setup, all relevant files read, and exact root causes found.

---

## 1. Active problem: 500 on `PUT /api/profiles/me`

User sees **"Internal Server Error"** when clicking "Complete Profile" on Step 5 of the profile setup wizard (`/profile/setup`). This is triggered by `PUT /api/profiles/me` in `apps/web/src/app/profile/setup/page.tsx:152`.

### Root cause #1 — Gender never stored (confirmed bug)

`apps/web/src/app/signup/SignupForm.tsx` collects `formData.gender` but never saves it anywhere. `signUp.email()` only receives `email`, `password`, `name`, `image`. BetterAuth creates the user without gender.

`/profile/setup` then calls `GET /api/profiles/me` on mount. For a brand-new user this returns `{ profile: null }`. So `setGender(null)` is never called and `gender` stays `null`.

When the form submits: `...(gender ? { gender } : {})` — gender is NOT included.

In `apps/api/src/modules/profiles/profiles.service.ts:237`, the INSERT defaults to `gender: (data.gender as any) ?? 'MALE'`. **All new female users get male profiles.** This is a data-correctness bug but NOT the 500.

**Fix**: Add a gender selector to Step 1 of `/profile/setup` that is visible when `gender === null`. Validate it as required before advancing. The submit already handles it via `...(gender ? { gender } : {})`.

### Root cause #2 — Actual 500 cause (NOT YET CONFIRMED)

All static analysis was exhausted without finding the throw. TypeScript compiles clean (`tsc --noEmit` = 0 errors). No global exception filter exists in `apps/api/src/main.ts` — NestJS swallows the error and returns the generic `{ statusCode: 500, message: "Internal Server Error" }`.

**To find the real cause**: Add a try-catch with `console.error` around the body of `updateMyProfile` in `profiles.service.ts`. Run both servers (`pnpm dev` from monorepo root), attempt to submit the profile setup form, and read the API terminal output.

Suspects (in order of likelihood):
1. **DB INSERT constraint** — The `profiles.lastNameEnc` column is `text().notNull()`. If `data.lastName` is empty string, `if (data.lastName)` is `false`, so `updateData.lastNameEnc` is never set, and the INSERT does `lastNameEnc: (updateData.lastNameEnc as string) ?? ''` — inserts empty string. Fine for `notNull`. Not the issue.
2. **`encryptionService.encrypt()` throwing** — Only throws if `ENCRYPTION_KEY` missing/wrong, which would prevent API startup. Ruled out.
3. **Drizzle `date()` column** — `dob: date().notNull()` with no mode. Service inserts a string `"YYYY-MM-DD"`. PostgreSQL accepts this. Probably fine.
4. **`publicFields` jsonb** — Inserted as `{ bio: string | null }`. Drizzle serializes jsonb objects. Probably fine.
5. **`getMyProfile()` relational query** after INSERT — `usersRelations` has `profiles: many(profiles)` and `photos: many(photos)` defined in `relations.ts`. Should work.

**Recommended next step**: Add the try-catch logging (see §3 below), run the form, read the actual error from the API terminal.

---

## 2. Files read in this session (all content known)

| File | Key facts |
|------|-----------|
| `apps/api/src/modules/profiles/profiles.service.ts` | Full content. `updateMyProfile` at line 191. INSERT path at 232. `getMyProfile` at 139. |
| `apps/api/src/modules/profiles/profiles.controller.ts` | `PUT /profiles/me` at line 74. Controller converts `dto.dob → new Date(dto.dob)`. |
| `apps/api/src/modules/profiles/dto/index.ts` | `dob?: string` with `@IsDateString()`. `biodata?: Record<string, unknown>` with `@IsObject()`. |
| `apps/api/src/db/schema.ts` | Full content. `profiles` table at line 327. `users` table at line 155. `dob: date().notNull()` (no explicit mode). `lastNameEnc: text().notNull()`. `publicId: varchar(16).notNull()` (no default — set by BetterAuth hook). |
| `apps/api/src/db/relations.ts` | Full content. `usersRelations` has `profiles: many(profiles)` and `photos: many(photos)`. `sessionRelations` has `user: one(users, ...)`. All correct. |
| `apps/api/src/db/drizzle.service.ts` | `casing: 'snake_case'` set on drizzle instance. All schema columns have explicit names so casing option has no effect. |
| `apps/api/src/common/guards/better-auth.guard.ts` | Queries `session` with `user → profiles`. Sets `request.user.id`. No email verification check. |
| `apps/api/src/common/decorators/current-user.decorator.ts` | Returns `request.user[data]` — `@CurrentUser("id")` returns `request.user.id`. |
| `apps/api/src/services/encryption.service.ts` | AES-256-GCM. Throws at constructor if `ENCRYPTION_KEY` missing/wrong length — so if API is running, key is valid. |
| `apps/api/src/main.ts` | No global exception filter. `ValidationPipe` with `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`, `enableImplicitConversion: true`. Global prefix `api`. |
| `apps/web/src/app/profile/setup/page.tsx` | Full content. `handleSubmit` at line 148. Gender state starts null for new users. Sends `biodata` object with `hideLocation: boolean`, etc. |
| `apps/web/src/app/signup/SignupForm.tsx` | Full content. Collects `formData.gender` but does NOT pass to `signUp.email()`. Redirects to `/profile/setup` after 2s. |
| `apps/web/src/app/login/LoginForm.tsx` | Redirects regular users to `/browse`, admins to `/admin`. No changes needed. |
| `apps/web/src/lib/api.ts` | `API_URL = '/api'`. Handles non-JSON responses and NestJS array messages. |

---

## 3. Exact code changes needed

### Fix A — Add try-catch logging to find the 500 (diagnostic)

In `apps/api/src/modules/profiles/profiles.service.ts`, wrap `updateMyProfile` body:

```typescript
async updateMyProfile(userId: string, data: { ... }) {
  try {
    const db = this.drizzle.db;
    // ... existing code unchanged ...
    return this.getMyProfile(userId);
  } catch (error) {
    console.error('[ProfilesService] updateMyProfile FAILED for userId:', userId);
    console.error('[ProfilesService] Error:', error);
    throw error;
  }
}
```

Run `pnpm dev`, submit the form, read the API terminal. The actual error will appear.

### Fix B — Gender selector in profile setup (data correctness)

In `apps/web/src/app/profile/setup/page.tsx`:

1. Add to Step 0 (basic info card), after the name fields, before date of birth — only when `gender === null`:

```tsx
{!gender && (
  <div>
    <label className="block text-sm font-medium mb-2">I am a <span className="text-red-400">*</span></label>
    <div className="grid grid-cols-2 gap-3">
      {(['MALE', 'FEMALE'] as const).map(g => (
        <button key={g} type="button"
          onClick={() => setGender(g)}
          className={`p-3 rounded-lg border text-sm transition ${gender === g ? 'border-gold-500 bg-gold-500/10 text-gold-400' : ''}`}
          style={gender !== g ? { borderColor: 'var(--color-border)', color: 'var(--color-text)' } : {}}>
          {g === 'MALE' ? 'Brother' : 'Sister'}
        </button>
      ))}
    </div>
  </div>
)}
```

2. In `validate()` for step 0, add before other checks:
```typescript
if (!gender) return 'Please select your gender.';
```

### Fix C — Global exception filter (optional, improves DX)

New file `apps/api/src/common/filters/all-exceptions.filter.ts`:

```typescript
import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    this.logger.error('Unhandled exception:', exception);

    const message = exception instanceof HttpException
      ? exception.getResponse()
      : { statusCode: status, message: 'Internal server error' };

    response.status(status).json(message);
  }
}
```

Register in `main.ts`:
```typescript
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
// ...
app.useGlobalFilters(new AllExceptionsFilter());
```

---

## 4. Other pending items (from previous sessions)

- [ ] **Confirm MFA loop fixed** — log in as SUPER_ADMIN, verify OTP, confirm admin loads
- [ ] **Profile E2E test** — sign up → complete wizard → verify profile appears in opposite-gender browse
- [ ] **`hideLocation` in ProfileCard** — show state-only when `biodata.hideLocation = true`
- [ ] **Rotate all secrets** — Neon DB, Better-Auth secret, Resend API key, Sentry token — REQUIRED before prod deploy
- [ ] **Production deploy** — blocked on secrets rotation

---

## 5. Dev server setup

```bash
pnpm dev   # from monorepo root — runs web (3000) + api (3001) via Turborepo
```

Or separately:
```bash
cd apps/api && pnpm dev    # port 3001
cd apps/web && pnpm dev    # port 3000
```

API errors appear in the `apps/api` terminal window.

---

## 6. Key architecture reminders

- BetterAuth lives in `apps/web/src/lib/auth.ts` (Next.js app, NOT NestJS)
- NestJS API at `apps/api` — all profile/browse/admin endpoints
- Web proxies `/api/*` → `http://127.0.0.1:3001/api/*` via `next.config.js` rewrites
- BetterAuth auth routes at `/auth/[...all]` (NOT under `/api`)
- NestJS `BetterAuthGuard` validates session cookie against the shared Neon DB
- `ENCRYPTION_KEY` must be set in `apps/api/.env` (64-char hex = 32 bytes AES key)
