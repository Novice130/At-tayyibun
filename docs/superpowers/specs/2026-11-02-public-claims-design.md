# Make At-Tayyibun's public claims true

## Context

An outside review of attayyibun.com found missing age terms, thin legal pages, unverified testimonials and inconsistent wording. Tracing the code showed that several claims are false, not merely badly worded:

- Signup promises only the guardian's contact is shared. The API emails the member's own phone and email in plain text.
- Privacy promises a single-use expiring link. The token is created but never sent.
- Privacy says bio and biodata are decrypted only for approved people. Any verified member gets them.
- A direct API call can skip date of birth and still produce a complete, listed profile.
- Admin "suspend" only clears a badge.

The outcome: the product does what the pages say, and the pages say only what is true. Work spans API, web and mobile, on a new branch `fix/public-claims` from `main`.

## Decisions

### From the owner

- **Contact shared:** the member accepting chooses their guardian's contact or their own.
- **Delivery:** a real link, not details in an email.
- **Request lifecycle:** while pending, the sender's profile is visible to the receiver.
  - Rejected or withdrawn: request gone, full access ends, sender can still appear in browse as a normal preview card.
  - Accepted: access stays and they move forward.
  - 72-hour expiry stays. After expiry the sender can resend.
- **Visibility before approval:** members see the 200-character preview and basics. Logged-out visitors get no bio.
- **Success stories:** Omar & Fatima are real and stay. The other two go.
- **Operator:** "At-Tayyibun" for now. It is an LLC registered in Chicago; exact details come later.
- **Time zone:** Chicago time, stated clearly.
- **Code fixes in scope:** age-gate bypass, real suspension, limiting bio to approved people.
- **Not in scope:** contact form. The email link stays.

### My calls (override any of these)

- **Link is tied to the sender's login.** It opens `/requests/<id>/contact` and needs sign-in as the sender. A forwarded email is useless to anyone else, and it replaces the unused public token.
- **Contact shows once, within 7 days of acceptance,** behind a "Show contact details" button, so email scanners can't use up the view. After that the sender sends a new request.
- **Both sides see each other's full bio after acceptance.** Before that, only the receiver sees the sender's.
- **Marital status stays private in browse.** My question listed it among "basics" by mistake. The code deliberately keeps it out of browse and shows it only to a request's receiver, and I am keeping that.
- **Governing law: Illinois,** inferred from Chicago.
- **Operator wording:** "At-Tayyibun, an LLC registered in Chicago, Illinois." Operator, state and dates live in one constants file, so the exact LLC name is a one-line change.
- **Legal contact email: `support@attayyibun.com`.** No privacy address is known to exist.
- **Signup label: "Create Account"** everywhere, without "Free": no paid features exist today, but admin settings call Silver and Gold "purchasable".
- **Enforcement wording in Terms:** "may result in suspension or removal" throughout.
- **Legal link labels:** "Terms of Use" and "Privacy Policy" on web and mobile, keeping the creative names as page headings.
- **Unchanged:** a rejected sender can still re-request the same person, as today.

## Implementation

### 1. Migration

Add the next free number. The memory notes a stashed photo-drop migration also wanting 0006, so check first. In `apps/api/src/db/schema.ts`:

- `info_requests.share_source` (`GUARDIAN` or `SELF`) and `info_requests.contact_expires_at`
- `users.suspended_at`
- Null existing `one_time_token` values. Stop writing the column; dropping it is later work.
- Set `profile_complete = false` where `dob` makes the member under 18. This catches placeholder dates. Count these read-only in production first and report the number.

### 2. Age gate

`apps/api/src/modules/profiles/profiles.service.ts`, around `:479`: completeness requires a date of birth giving age 18 or over, so the today's-date placeholder written at `:516` can never count. Add spec cases next to `profiles.service.spec.ts:96-117`. Check `hasCompleteProfile` in `marital-match` needs nothing further.

### 3. Requests and contact link

In `apps/api/src/modules/requests/`:

- **DTO:** add `shareSource` to `RespondRequestDto`. Missing means `SELF`, so old mobile builds keep working and their wording stays true.
- **Accept:** validate the chosen source has contact details and return 400 if not. Set `share_source` and `contact_expires_at`. Send an email containing only the link and no contact values. Rewrite `sendSharedInfoEmail` in `apps/api/src/services/email.service.ts:207-220`.
- **New `POST /requests/:id/contact`:**
  - Claim atomically: `UPDATE ... WHERE id AND requester_id AND status = APPROVED AND token_used_at IS NULL AND contact_expires_at > now RETURNING`.
  - Read details at reveal time: guardian fields from decrypted biodata, or the existing verified-phone and non-placeholder-email rules.
  - Respond with `Cache-Control: no-store`.
- **Remove** public `GET shared/:token` and `getSharedInfo`.
- **Expiry:** `createRequest` marks the sender's stale pending rows `EXPIRED` before its one-pending check, so resend works with the partial unique index. `getActiveRequest` ignores stale rows.
- **Lists:**
  - Build rows explicitly, so `oneTimeToken` no longer leaks through the `...r` spread at `:275` and `:312`.
  - Incoming returns only live pending and approved rows.
  - Outgoing keeps declined and expired, reporting stale pending as `EXPIRED`.
  - Rows carry contact state: available, viewed or expired.

Phone-first accounts have a placeholder email and can't receive the link, so the Requests screen also shows the button. This also covers failed sends.

### 4. Bio and biodata limits

In `apps/api/src/modules/profiles/profiles.service.ts`:

- Add a helper that checks for an approved request in either direction, or a live pending request where the viewer is the receiver.
- `getProfileByPublicId` (`:264-310`): decrypt and return full bio and biodata only when that passes or the viewer is the owner. Other members get the preview from `publicFields` and no biodata. Anonymous viewers get no bio. Guardian keys stay excluded.
- Browse (`:205`): null `bio` when there is no viewer.
- Non-match exception (`:250-258`): count only live requests, so a rejected or withdrawn request no longer keeps a profile reachable.

Check web and mobile profile pages render well without biodata, and show a short "Full profile unlocks after a request is accepted" note.

### 5. Suspension

- `moderation.service.ts:227`: set `suspended_at`, delete the user's sessions, delete their pending requests, and stop touching `isVerified`.
- `better-auth.guard.ts`: refuse with 403 and code `ACCOUNT_SUSPENDED`, mirroring the phone-gate pattern. Public routes treat a suspended user as anonymous. Self-delete stays allowed, so a suspended member can still erase their data.
- Hide suspended users from browse, profile lookup and `createRequest`, using the same 404 as blocks.
- Add an admin unsuspend endpoint and button. Protect `SUPER_ADMIN`.
- Web and mobile show a suspended message pointing to support.
- Read past `SUSPEND_USER` audit rows in production and list them for the owner rather than backfilling automatically.

### 6. Web and mobile request screens

- `apps/web/src/app/requests/page.tsx`:
  - Accept opens a chooser: guardian or own contact, with guardian disabled when none is saved.
  - Add a "Send again" action on expired outgoing requests.
  - Fix the toasts and the "sent to your email" lines at `:110` and `:365`. Pre-migration approved rows keep the email wording.
- New web page `/requests/[id]/contact`: requires sign-in, warns "shown once, copy it now", has a reveal button, and clear states for viewed and expired.
- Mobile parity in `apps/mobile/lib/screens/requests_screen.dart` and `lib/repositories/requests_repository.dart:35`, with reveal in-app.

### 7. Copy

Add `apps/web/src/lib/legal.ts` holding the operator, state, contact email and effective date (set to the deploy date).

- **Home (`apps/web/src/app/page.tsx`):**
  - Keep only Omar & Fatima, and adjust the section layout for one card.
  - Rewrite the "families have found" lines at `:298` and `:331-332`.
  - Fix `:275` (link, guardian or own contact) and `:48-49` (drop "military-grade" and "All sensitive data").
  - Footer labels at `:360-361`.
- **Terms (`terms/page.tsx`):** keep the "Terms of Union" heading. Add:
  - effective date, operator and contact
  - 18+ and not currently married
  - permission to share a guardian's details
  - one enforcement wording, and how removal and suspension work
  - limitation of liability, and Illinois governing law
- **Privacy (`privacy/page.tsx`):** keep the "Privacy Sanctuary" heading. State only what code does:
  - **Age:** not for children; 18+ only.
  - **Encrypted (AES-256-GCM):** last name, bio and biodata including guardian details.
  - **Not encrypted by the app:** phone, email, first name, date of birth, location, marital answers and the bio preview.
  - **Who sees what:** matching section 4, with the heading "Limited visibility of your data".
  - **Contact sharing:** the link flow from section 3.
  - **Retention and deletion:** data stays until deletion, and deletion is immediate. Disclose what survives: audit row, reports, emails already sent, the Firebase phone record and backups. Check backup retention in `../infra`. Promise no retention window the code doesn't enforce.
  - **Who else gets data:** other members and guardians, Resend, Firebase, Sentry, Neon, Google and Apple sign-in, Cloudflare, Hetzner, DiceBear.
  - **Terms explained:** one line each on nikah and biodata.
- **About (`about/page.tsx`):** `:80` becomes "Join Muslim families across the United States."; `:51-52` becomes "helping keep it to one account per person"; explain nikah.
- **Same claim elsewhere:** `signup/phone/page.tsx:27`, `components/PhoneVerify.tsx:44`, `email.service.ts:146`.
- **Signup:**
  - Add "Members must be 18 or older" in web `SignupForm.tsx` and `mobile/lib/screens/signup_screen.dart`.
  - Fix guardian claims at `:303` and `:671`.
  - Fix "your data is encrypted, your photos are protected" at `:670`; photos don't exist.
  - Update the guardian wording in `mobile/lib/screens/welcome_screen.dart`.
- **Contact (`contact/page.tsx:31`):** "We typically respond within one business day (Central Time, Chicago), InshaAllah."
- **Labels:** "Create Account" at `page.tsx:146,335`, `about/page.tsx:83`, `Navbar.tsx:180,321`, and `welcome_screen.dart:285`. "Terms of Use" replaces "Terms of Service" in the signup, profile and mobile screens listed by the search.
- **Metadata (`layout.tsx:21,29`):** match the `:15` title.
- **Profile cards (`components/profile/ProfileCard.tsx:35,56`):** always "Name, age". Hidden names show "Member, age" instead of the random public ID. Same on mobile if it does this.

### 8. Test profiles

These accounts may be real people: the code-style names appear when a member ticks "hide my name", and seed accounts show names.

1. Read-only production query listing accounts with `@example.com` or `@loadtest.invalid` emails, the name "Xyz", and the two public IDs.
2. Show the owner the list.
3. Delete only the accounts the owner confirms, one at a time, through admin delete.

First change `admin.service.ts:238-254` to call `hardDeleteUser`, because its current delete likely hits foreign-key errors. Never run `cleanup-test-accounts.ts` or `seed.ts` against production: both wipe real users.

### 9. Handoff

Stop at a tested branch. Deploy is separate and needs owner approval: migration first, then API and web through `bin/prod`, then a mobile release. Old mobile builds keep working but can't show the contact screen, so ship the mobile release close behind; those members can use the web link.

## Open for the owner

- **Before launch:** have a lawyer review Terms and Privacy. The exact LLC name is still needed, and Illinois governing law needs confirming.
- **Omar & Fatima:** confirm they agreed to be featured and that the quote at `page.tsx:25` is theirs.
- **Noted, not fixed here:** the email footer's dead `/unsubscribe` link (`email.service.ts:281`), and the Firebase phone record surviving account deletion, which Privacy will disclose.

## Verification

- `apps/api` unit tests, adding cases for:
  - API call without a date of birth stays incomplete and unlisted
  - contact reveal: succeeds once, then fails on second view, wrong user, expired, and rejected requests
  - guardian chosen with none saved returns 400
  - expired request can be resent
  - each visibility state: anonymous, member, receiver while pending, after accept, after reject, after withdraw
  - suspended user blocked, hidden, and still able to self-delete
- Web typecheck, lint and tests; `flutter analyze` and `flutter test` for mobile.
- Run the app locally and walk the flow with two accounts in a browser: send, view while pending, accept with each contact choice, open the link, reopen it. Then repeat for reject, withdraw and expiry.
- Read the email in Resend or a local capture to confirm no contact values appear.
- Grep web, mobile and API for `military-grade`, `thousands`, `single-use`, `Terms of Service`, `Get Started`, `Free Account`, and confirm no leftovers.
- After a future deploy: `https://attayyibun.com/api/session/health`, and an anonymous request to browse returns no bio.
