#!/usr/bin/env node

/**
 * Apple Client Secret Generator for Sign in with Apple (Web)
 *
 * Generates an ES256 JWT client secret valid for 180 days (Apple maximum).
 *
 * Usage:
 *   node scripts/generate_apple_secret.mjs [services_id]
 * Example:
 *   node scripts/generate_apple_secret.mjs com.attayyibun.attayyibun.service
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { importPKCS8, SignJWT } from "jose";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const TEAM_ID = process.env.APPLE_TEAM_ID || "TT3HQ774N4";
const KEY_ID = process.env.APPLE_KEY_ID || "T479RMTYDJ";
const SERVICES_ID =
  process.argv[2] ||
  process.env.APPLE_CLIENT_ID ||
  "com.attayyibun.attayyibun.service";
const APP_BUNDLE_ID =
  process.env.APPLE_APP_BUNDLE_ID || "com.attayyibun.attayyibun";

const keyPath = path.join(rootDir, `AuthKey_${KEY_ID}.p8`);

if (!fs.existsSync(keyPath)) {
  console.error(`Error: Apple private key file not found at ${keyPath}`);
  process.exit(1);
}

const keyContent = fs.readFileSync(keyPath, "utf8");
const privateKey = await importPKCS8(keyContent, "ES256");

// Apple allows at most 6 months (180 days) validity for client secrets
const clientSecret = await new SignJWT({})
  .setProtectedHeader({ alg: "ES256", kid: KEY_ID })
  .setIssuer(TEAM_ID)
  .setIssuedAt()
  .setExpirationTime("180d")
  .setAudience("https://appleid.apple.com")
  .setSubject(SERVICES_ID)
  .sign(privateKey);

console.log("\n=======================================================");
console.log("Apple Client Secret JWT successfully generated (180d)");
console.log("=======================================================\n");
console.log(`Team ID:        ${TEAM_ID}`);
console.log(`Key ID:         ${KEY_ID}`);
console.log(`Services ID:    ${SERVICES_ID}`);
console.log(`App Bundle ID:  ${APP_BUNDLE_ID}\n`);
console.log("Copy and paste these environment variables into Dokploy:\n");
console.log(`APPLE_TEAM_ID=${TEAM_ID}`);
console.log(`APPLE_KEY_ID=${KEY_ID}`);
console.log(`APPLE_CLIENT_ID=${SERVICES_ID}`);
console.log(`APPLE_APP_BUNDLE_ID=${APP_BUNDLE_ID}`);
console.log(`APPLE_CLIENT_SECRET=${clientSecret}\n`);
