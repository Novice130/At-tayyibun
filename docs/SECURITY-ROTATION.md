# SECURITY ROTATION CHECKLIST — At-Tayyibun

> Status: **PENDING ROTATION** (values below were live in the working tree and a prior
> exposure is documented in `DEPLOYMENT_LESSONS.md`). Run these steps, then mark each done.

Every secret listed here must be treated as compromised and rotated. Until a value is
rotated, assume it can be used by an attacker.

---

## 1. Neon Postgres

- [ ] Neon Console → your project → Settings → Reset password. **This invalidates the old
      `npg_...` password used in `DATABASE_URL`.**
- [ ] Update `DATABASE_URL` in the deployment (Dokploy env / Docker secrets) with the new
      connection string.
- [ ] Put the new value in local env files (root `.env`, `apps/api/.env`,
      `apps/web/.env.local` — all gitignored) replacing `REPLACE_AFTER_ROTATION`.

## 2. Better-auth

- [ ] Generate a new secret: `openssl rand -base64 32`
- [ ] Set `BETTER_AUTH_SECRET` in deployment and local env files.
- [ ] Expect all existing sessions to be invalidated (secret is used for cookie signing).

## 3. Encryption key (PII at rest)

- [ ] Generate a new key: `openssl rand -hex 32`
- [ ] **WARNING:** changing `ENCRYPTION_KEY` makes existing encrypted data (last names,
      bios, biodata, shared contact info) unreadable. There is no re-encryption path yet
      (see `docs/open-issues-2026-08-10.md`). Decide: rotate now and accept that legacy
      encrypted fields must be re-entered by users, or plan a re-encryption migration first.
- [ ] Set `ENCRYPTION_KEY` in deployment and local env files.

## 4. Resend (email)

- [ ] Resend dashboard → API Keys → revoke the old keys and create a new one.
- [ ] Update `RESEND_API_KEY` in deployment and local env files.

## 5. Sentry

- [ ] Sentry → Settings → Auth Tokens → revoke the leaked token; create a new one.
- [ ] Rotate the DSN (`NEXT_PUBLIC_SENTRY_DSN`) if you consider it exposed.
- [ ] Update `apps/web/.env.local` (or delete both Sentry vars — Sentry is currently
      disabled in code).

## 6. Google OAuth

- [ ] Google Cloud Console → APIs & Services → Credentials → the "Attayyibun-auth" web
      client → regenerate client secret. Client IDs are public identifiers and do not
      need rotation.
- [ ] Update `GOOGLE_CLIENT_SECRET` in deployment and local env files.
- [ ] Android client id can stay (public).

## 7. Android release keystore

- [ ] Generate a NEW keystore with NEW passwords:
      `keytool -genkeypair -v -keystore ~/.android-keystores/at-tayyibun-release-new.jks -keyalg RSA -keysize 2048 -validity 10000 -alias at-tayyibun`
- [ ] Delete the old keystore: `~/.android-keystores/at-tayyibun-release.jks`
      (its passwords were in the repo working tree).
- [ ] Recreate `apps/mobile/android/key.properties` (gitignored) pointing at the NEW
      keystore. Template:
      ```
      storePassword=***
      keyPassword=***
      keyAlias=at-tayyibun
      storeFile=/Users/<you>/.android-keystores/at-tayyibun-release-new.jks
      ```
- [ ] Rebuild and re-publish the APK — the new signature differs from the old one, so
      users will need to uninstall the old APK first (side-loading upgrade path).

## 8. JWT / passport leftovers

- [ ] `JWT_SECRET` in `apps/api/.env` belongs to the retired passport stack (`.bak`
      strategies). It can be deleted once the passport packages are removed.

---

## Verification

- [ ] `grep -rInE 'npg_|re_|sntrys_|ENCRYPTION_KEY=.{8}|storePassword=.'` across the repo
      returns no live values (only placeholders/docs).
- [ ] Full signup → verify → login → browse → request flow works on staging with the new
      values.
- [ ] Old sessions, old APK, and old DB password are confirmed dead.
