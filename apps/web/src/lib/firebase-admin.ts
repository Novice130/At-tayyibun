import { getApps, initializeApp, cert, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";

// Server-side Firebase, used for exactly one thing: verifying the ID token a
// client gets back after Firebase confirms an SMS code. Firebase never holds a
// session here — better-auth's cookie remains the only session in the system.

const APP_NAME = "attayyibun-phone-auth";

let cached: Auth | null = null;

function buildApp(): App {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const rawKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !rawKey) {
    throw new Error(
      "Firebase admin is not configured: set FIREBASE_PROJECT_ID, " +
        "FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY.",
    );
  }

  // Hosting providers store the PEM as a single line with literal backslash-n.
  // Passing that straight through fails with an opaque "Invalid PEM formatted
  // message" — the single most common deploy failure with this SDK.
  const privateKey = rawKey.replace(/\\n/g, "\n");

  const existing = getApps().find((a) => a.name === APP_NAME);
  if (existing) return existing;

  return initializeApp(
    { credential: cert({ projectId, clientEmail, privateKey }) },
    APP_NAME,
  );
}

export function firebaseAuth(): Auth {
  // Lazy: importing this module must not throw at build time when the env is
  // absent (the web build runs without secrets).
  if (!cached) cached = getAuth(buildApp());
  return cached;
}

export function isFirebaseConfigured(): boolean {
  return Boolean(
    process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY,
  );
}
