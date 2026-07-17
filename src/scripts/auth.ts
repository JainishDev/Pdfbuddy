// src/scripts/auth.ts
// Boots Firebase auth (anonymous by default) and exposes small helpers the
// rest of the app (robot.ts, chat.ts, upload.ts) can use without every file
// needing to know about Firebase directly.
//
// Degrades cleanly: if PUBLIC_FIREBASE_* env vars aren't set, every export
// here becomes a harmless no-op and the app behaves exactly as it did
// before this file existed (SQLite-only, no accounts).

import {
  ensureSignedIn,
  onUserChanged,
  getIdToken,
  isFirebaseConfigured,
  upgradeWithEmailPassword,
  upgradeWithGoogle,
} from '../lib/firebase';
import type { User } from 'firebase/auth';

export const authState: { user: User | null; ready: boolean } = {
  user: null,
  ready: false,
};

/** Fired on window once the initial anon-or-real sign-in resolves. */
export const AUTH_READY_EVENT = 'pdfbuddy:auth-ready';
/** Fired whenever the signed-in user transitions from anonymous -> real account. */
export const AUTH_UPGRADED_EVENT = 'pdfbuddy:auth-upgraded';

export async function initAuth(): Promise<void> {
  if (!isFirebaseConfigured()) {
    authState.ready = true;
    return;
  }

  const user = await ensureSignedIn();
  authState.user = user;
  authState.ready = true;
  window.dispatchEvent(new CustomEvent(AUTH_READY_EVENT, { detail: { user } }));

  onUserChanged((updated) => {
    const wasAnonymous = authState.user?.isAnonymous ?? true;
    authState.user = updated;
    if (updated && wasAnonymous && !updated.isAnonymous) {
      window.dispatchEvent(new CustomEvent(AUTH_UPGRADED_EVENT, { detail: { user: updated } }));
    }
  });
}

export function currentUser(): User | null {
  return authState.user;
}

export function isAnonymous(): boolean {
  return authState.user?.isAnonymous ?? true;
}

/** Upgrades the anonymous session to a real account, then migrates server-side data. */
export async function upgradeAccount(
  method: { type: 'email'; email: string; password: string } | { type: 'google' }
): Promise<User> {
  const previousUid = authState.user?.uid ?? null;

  const user =
    method.type === 'google' ? await upgradeWithGoogle() : await upgradeWithEmailPassword(method.email, method.password);

  // Tell the server to move ownership of any anonymous-UID data over to
  // this now-permanent account. Best-effort — a failure here shouldn't
  // undo the successful auth link.
  if (previousUid) {
    try {
      await authedFetch('/api/auth/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ previousUid }),
      });
    } catch (err) {
      console.error('[auth] server-side data migration failed:', err);
    }
  }

  return user;
}

/** fetch() wrapper that attaches the current user's Firebase ID token, if any. */
export async function authedFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const token = await getIdToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}
