// src/lib/firebase-admin.ts
// Server-only Firebase Admin SDK. Import from API routes / middleware,
// never from client-side scripts (it needs a service-account private key).

import { getApps, initializeApp, cert, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

const PROJECT_ID = process.env.FIREBASE_ADMIN_PROJECT_ID;
const CLIENT_EMAIL = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
// Private keys stored in .env come with literal "\n" sequences — restore
// real newlines before handing them to the SDK.
const PRIVATE_KEY = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

let adminApp: App | null = null;

function hasAdminConfig(): boolean {
  return Boolean(PROJECT_ID && CLIENT_EMAIL && PRIVATE_KEY);
}

function getAdminApp(): App | null {
  if (!hasAdminConfig()) return null;
  if (!adminApp) {
    adminApp = getApps().length
      ? getApps()[0]
      : initializeApp({
          credential: cert({
            projectId: PROJECT_ID,
            clientEmail: CLIENT_EMAIL,
            privateKey: PRIVATE_KEY,
          }),
        });
  }
  return adminApp;
}

export function getAdminAuth(): Auth | null {
  const app = getAdminApp();
  return app ? getAuth(app) : null;
}

export function getAdminDb(): Firestore | null {
  const app = getAdminApp();
  return app ? getFirestore(app) : null;
}

export function isAdminConfigured(): boolean {
  return hasAdminConfig();
}

export interface VerifiedUser {
  uid: string;
  email: string | null;
  isAnonymous: boolean;
}

/**
 * Verifies a Firebase ID token (as sent in `Authorization: Bearer <token>`).
 * Returns null on missing config, missing token, or an invalid/expired token
 * — callers should treat that the same as "not signed in", not an error,
 * since the whole app is designed to work without Firebase configured.
 */
export async function verifyIdToken(token: string | null): Promise<VerifiedUser | null> {
  if (!token) return null;
  const auth = getAdminAuth();
  if (!auth) return null;
  try {
    const decoded = await auth.verifyIdToken(token);
    return {
      uid: decoded.uid,
      email: decoded.email ?? null,
      isAnonymous: !decoded.firebase?.sign_in_provider || decoded.firebase.sign_in_provider === 'anonymous',
    };
  } catch (err) {
    console.warn('[firebase-admin] token verification failed:', err);
    return null;
  }
}
