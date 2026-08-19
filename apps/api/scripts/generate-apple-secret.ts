// Regenerates the Apple OAuth client secret JWT. Apple caps these at 6 months,
// so this has to be re-run and the env var updated twice a year.
//   corepack pnpm --filter api tsx scripts/generate-apple-secret.ts
import { SignJWT, importPKCS8 } from 'jose';

async function main() {
  const TEAM_ID = process.env.APPLE_TEAM_ID!;        // 10 chars, e.g. AB12CD34EF
  const KEY_ID = process.env.APPLE_KEY_ID!;          // 10 chars, from the Keys page
  const CLIENT_ID = process.env.APPLE_CLIENT_ID!;    // com.attayyibun.web (Services ID)
  const P8 = process.env.APPLE_PRIVATE_KEY!;         // full -----BEGIN PRIVATE KEY----- block

  const key = await importPKCS8(P8.replace(/\\n/g, '\n'), 'ES256');
  const now = Math.floor(Date.now() / 1000);

  const jwt = await new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: KEY_ID })
    .setIssuer(TEAM_ID)
    .setIssuedAt(now)
    .setExpirationTime(now + 60 * 60 * 24 * 180) // 180d, just under Apple's cap
    .setAudience('https://appleid.apple.com')
    .setSubject(CLIENT_ID)
    .sign(key);

  console.log(jwt);
}

main().catch((error) => {
  console.error('Apple secret generation failed:', error);
  process.exit(1);
});
