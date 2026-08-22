'use client';

import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  inMemoryPersistence,
  setPersistence,
  type Auth,
} from 'firebase/auth';

// Client-side Firebase, used only to deliver and confirm an SMS code. The
// moment we have the ID token we hand it to better-auth and sign out of
// Firebase — better-auth's cookie is the only session in this app, and leaving
// a second one lying around in IndexedDB just creates two sources of truth.

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
};

export const isFirebaseConfigured = Boolean(config.apiKey && config.projectId && config.appId);

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;

export function firebaseApp(): FirebaseApp {
  if (!isFirebaseConfigured) {
    throw new Error(
      'Firebase is not configured: set the NEXT_PUBLIC_FIREBASE_* variables.',
    );
  }
  if (!app) app = getApps()[0] ?? initializeApp(config);
  return app;
}

export function firebaseAuth(): Auth {
  if (!authInstance) {
    authInstance = getAuth(firebaseApp());
    // Nothing should survive a reload. Errors here are non-fatal — the sign-in
    // still works, it just leaves a Firebase session behind.
    void setPersistence(authInstance, inMemoryPersistence).catch(() => {});
  }
  return authInstance;
}
