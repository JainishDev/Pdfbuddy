// src/lib/firebase.ts
// Client-side Firebase setup. Imported only from browser code (scripts/*.ts
// running via <script> tags), never from server-rendered .astro frontmatter
// or API routes — use firebase-admin.ts there instead.

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  signInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  linkWithCredential,
  linkWithPopup,
  signInWithPopup,
  EmailAuthProvider,
  GoogleAuthProvider,
  type Auth,
  type User,
} from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.PUBLIC_FIREBASE_API_KEY,
  authDomain: import.meta.env.PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.PUBLIC_FIREBASE_APP_ID,
};

function hasFirebaseConfig(): boolean {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
}

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;
let persistenceRequested = false; // guards one-time initializeFirestore call

/**
 * Lazily creates (or returns) the Firebase app instance.
 * Returns null if PUBLIC_FIREBASE_* env vars aren't configured, so the rest
 * of the app can keep working fully offline / SQLite-only.
 */
function getFirebaseApp(): FirebaseApp | null {
  if (!hasFirebaseConfig()) return null;
  if (!app) {
    try {
      app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    } catch (err) {
      // A malformed config value (bad API key format, etc.) makes
      // initializeApp() throw synchronously. Without this catch, that
      // exception propagates straight out of whatever click handler
      // triggered it (e.g. the Sign In button) and the UI just does
      // nothing with no visible error. Fail soft instead.
      console.error('[firebase] initializeApp failed \u2014 check your PUBLIC_FIREBASE_* values:', err);
      return null;
    }
  }
  return app;
}

export function getFirebaseAuth(): Auth | null {
  const a = getFirebaseApp();
  if (!a) return null;
  if (!authInstance) authInstance = getAuth(a);
  return authInstance;
}

export function getFirestoreDb(): Firestore | null {
  const a = getFirebaseApp();
  if (!a) return null;
  if (!dbInstance) {
    if (!persistenceRequested) {
      persistenceRequested = true;
      try {
        // Use new modular persistence API (Firebase v9.13+) with multi-tab support.
        dbInstance = initializeFirestore(a, {
          localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
        });
      } catch {
        // Falls through to plain Firestore if persistence setup fails (e.g. SSR/Node).
        dbInstance = getFirestore(a);
      }
    } else {
      dbInstance = getFirestore(a);
    }
  }
  return dbInstance;
}

export function isFirebaseConfigured(): boolean {
  return hasFirebaseConfig();
}

/**
 * Ensures there is a signed-in Firebase user (anonymous by default).
 * Safe to call multiple times; resolves once auth state is known.
 */
export function ensureSignedIn(): Promise<User | null> {
  const auth = getFirebaseAuth();
  if (!auth) return Promise.resolve(null);

  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      unsubscribe();
      if (user) {
        resolve(user);
        return;
      }
      try {
        const cred = await signInAnonymously(auth);
        resolve(cred.user);
      } catch (err) {
        console.error('[firebase] anonymous sign-in failed:', err);
        resolve(null);
      }
    });
  });
}

export function onUserChanged(cb: (user: User | null) => void): () => void {
  const auth = getFirebaseAuth();
  if (!auth) {
    cb(null);
    return () => {};
  }
  return onAuthStateChanged(auth, cb);
}

/** Links the current anonymous user to an email/password credential. */
export async function upgradeWithEmailPassword(email: string, password: string): Promise<User> {
  const auth = getFirebaseAuth();
  if (!auth?.currentUser) throw new Error('Not signed in');
  const credential = EmailAuthProvider.credential(email, password);
  const result = await linkWithCredential(auth.currentUser, credential);
  return result.user;
}

/** Links the current anonymous user to a Google account via popup. */
export async function upgradeWithGoogle(): Promise<User> {
  const auth = getFirebaseAuth();
  if (!auth?.currentUser) throw new Error('Not signed in');
  const provider = new GoogleAuthProvider();
  const result = await linkWithPopup(auth.currentUser, provider);
  return result.user;
}

export async function getIdToken(): Promise<string | null> {
  const auth = getFirebaseAuth();
  if (!auth?.currentUser) return null;
  return auth.currentUser.getIdToken();
}

/**
 * Real login/signup flow (as opposed to the anonymous->linked upgrade path
 * above). Used by the account modal in the top bar.
 */

/** Creates a brand-new email/password account (no anonymous session to link). */
export async function signUpWithEmailPassword(email: string, password: string): Promise<User> {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error('Login is not configured for this deployment.');
  const result = await createUserWithEmailAndPassword(auth, email, password);
  return result.user;
}

/** Signs in an existing user with email/password. */
export async function signInWithEmailPassword(email: string, password: string): Promise<User> {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error('Login is not configured for this deployment.');
  return (await signInWithEmailAndPassword(auth, email, password)).user;
}

/** Signs in (or up) with Google via popup — works for both new and returning users. */
export async function signInWithGoogle(): Promise<User> {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error('Login is not configured for this deployment.');
  const provider = new GoogleAuthProvider();
  return (await signInWithPopup(auth, provider)).user;
}

/** Signs the current user out and immediately starts a fresh anonymous session. */
export async function signOutUser(): Promise<void> {
  const auth = getFirebaseAuth();
  if (!auth) return;
  await signOut(auth);
  try {
    await signInAnonymously(auth);
  } catch {
    // Non-fatal — the app degrades to "not signed in" until the next reload.
  }
}
