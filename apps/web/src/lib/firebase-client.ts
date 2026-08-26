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
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyD3g0-D5xFffHPFfq8hhjZ1rI4G8i4WwcU',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'at-tayyibun-e3f79.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'at-tayyibun-e3f79',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:637715249195:web:ba4d673f4e3ebbc856126e',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '637715249195',
};

export const isFirebaseConfigured = Boolean(config.apiKey && config.projectId);

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
