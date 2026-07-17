// src/scripts/account.ts
// Drives the account button + login modal in the top bar. Layers on top
// of auth.ts / lib/firebase.ts: this file is just the UI wiring for a real
// sign-in / sign-up / sign-out flow (separate from the mascot's soft
// "upgrade your anonymous session" nudge in robot.ts).

import {
  isFirebaseConfigured,
  signInWithEmailPassword,
  signUpWithEmailPassword,
  signInWithGoogle,
  signOutUser,
} from '../lib/firebase';
import { authState, AUTH_READY_EVENT } from './auth';
import type { User } from 'firebase/auth';

type Mode = 'signin' | 'signup';

export function initAccount() {
  const accountBtn = document.getElementById('account-btn') as HTMLButtonElement;
  const accountBtnLabel = document.getElementById('account-btn-label')!;
  const overlay = document.getElementById('account-modal')!;
  const closeBtn = document.getElementById('account-modal-close')!;
  const guestPane = document.getElementById('account-modal-guest')!;
  const signedInPane = document.getElementById('account-modal-signedin')!;
  const signedInEmail = document.getElementById('account-signedin-email')!;
  const signOutBtn = document.getElementById('account-signout-btn') as HTMLButtonElement;
  const googleBtn = document.getElementById('account-google-btn') as HTMLButtonElement;
  const form = document.getElementById('account-email-form') as HTMLFormElement;
  const emailInput = document.getElementById('account-email') as HTMLInputElement;
  const passwordInput = document.getElementById('account-password') as HTMLInputElement;
  const submitBtn = document.getElementById('account-submit-btn') as HTMLButtonElement;
  const errorBox = document.getElementById('account-error')!;
  const switchText = document.getElementById('account-switch-text')!;
  const switchBtn = document.getElementById('account-switch-btn') as HTMLButtonElement;

  let mode: Mode = 'signin';

  function setMode(next: Mode) {
    mode = next;
    submitBtn.textContent = mode === 'signin' ? 'Sign In' : 'Create Account';
    passwordInput.autocomplete = mode === 'signin' ? 'current-password' : 'new-password';
    switchText.textContent = mode === 'signin' ? 'New here?' : 'Already have an account?';
    switchBtn.textContent = mode === 'signin' ? 'Create an account' : 'Sign in instead';
    hideError();
  }

  function showError(msg: string) {
    errorBox.textContent = msg;
    errorBox.classList.remove('hidden');
  }
  function hideError() {
    errorBox.classList.add('hidden');
  }

  function refreshButtonLabel(user: User | null) {
    if (user && !user.isAnonymous) {
      const label = user.email ? user.email.split('@')[0] : 'Account';
      accountBtnLabel.textContent = label;
      accountBtn.classList.add('is-signed-in');
    } else {
      accountBtnLabel.textContent = 'Sign In';
      accountBtn.classList.remove('is-signed-in');
    }
  }

  function openModal() {
    const user = authState.user;
    if (user && !user.isAnonymous) {
      guestPane.classList.add('hidden');
      signedInPane.classList.remove('hidden');
      signedInEmail.textContent = user.email || user.displayName || 'Signed in';
    } else {
      signedInPane.classList.add('hidden');
      guestPane.classList.remove('hidden');
      setMode('signin');
      form.reset();
    }
    overlay.classList.remove('hidden');
  }

  function closeModal() {
    overlay.classList.add('hidden');
  }

  accountBtn.addEventListener('click', () => {
    if (!isFirebaseConfigured()) {
      showLoginUnavailableHint();
      return;
    }
    openModal();
  });

  closeBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !overlay.classList.contains('hidden')) closeModal();
  });

  switchBtn.addEventListener('click', () => setMode(mode === 'signin' ? 'signup' : 'signin'));

  googleBtn.addEventListener('click', async () => {
    hideError();
    googleBtn.disabled = true;
    googleBtn.textContent = 'Opening Google…';
    try {
      const user = await signInWithGoogle();
      authState.user = user;
      refreshButtonLabel(user);
      closeModal();
      window.dispatchEvent(new CustomEvent('pdfbuddy:auth-ready', { detail: { user } }));
    } catch (err: any) {
      showError(friendlyAuthError(err));
    } finally {
      googleBtn.disabled = false;
      googleBtn.textContent = 'Continue with Google';
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();
    submitBtn.disabled = true;
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    try {
      const user =
        mode === 'signin'
          ? await signInWithEmailPassword(email, password)
          : await signUpWithEmailPassword(email, password);
      authState.user = user;
      refreshButtonLabel(user);
      closeModal();
      window.dispatchEvent(new CustomEvent('pdfbuddy:auth-ready', { detail: { user } }));
    } catch (err: any) {
      showError(friendlyAuthError(err));
    } finally {
      submitBtn.disabled = false;
    }
  });

  signOutBtn.addEventListener('click', async () => {
    await signOutUser();
    authState.user = null;
    refreshButtonLabel(null);
    closeModal();
    // Re-render recent docs panel so it shows the anon bucket, not the signed-in user's.
    window.dispatchEvent(new CustomEvent('pdfbuddy:auth-ready', { detail: { user: null } }));
  });

  window.addEventListener(AUTH_READY_EVENT, ((e: CustomEvent) => {
    refreshButtonLabel(e.detail?.user ?? null);
  }) as EventListener);

  // In case auth was already ready before this script ran.
  if (authState.ready) refreshButtonLabel(authState.user);

  function showLoginUnavailableHint() {
    accountBtnLabel.textContent = 'Sign In';
    openModalUnavailable();
  }

  function openModalUnavailable() {
    signedInPane.classList.add('hidden');
    guestPane.classList.remove('hidden');
    setMode('signin');
    showError('Login isn\u2019t configured for this deployment yet \u2014 add the PUBLIC_FIREBASE_* environment variables to enable it.');
    overlay.classList.remove('hidden');
  }
}

function friendlyAuthError(err: any): string {
  const code = err?.code || '';
  console.error('[account] auth error:', code, err?.message || err);
  if (code.includes('wrong-password') || code.includes('invalid-credential')) return 'Incorrect email or password.';
  if (code.includes('user-not-found')) return 'No account found with that email.';
  if (code.includes('email-already-in-use')) return 'That email already has an account \u2014 try signing in instead.';
  if (code.includes('weak-password')) return 'Password should be at least 6 characters.';
  if (code.includes('invalid-email')) return 'That email address looks invalid.';
  if (code.includes('popup-closed-by-user')) return 'Sign-in was cancelled.';
  if (code.includes('popup-blocked')) return 'Your browser blocked the sign-in popup. Allow popups for this site and try again.';
  if (code.includes('unauthorized-domain')) return 'This domain isn\u2019t authorized for sign-in yet. Add it under Firebase Console \u2192 Authentication \u2192 Settings \u2192 Authorized domains.';
  if (code.includes('operation-not-allowed')) return 'This sign-in method isn\u2019t enabled yet. Turn it on under Firebase Console \u2192 Authentication \u2192 Sign-in method.';
  if (code.includes('too-many-requests')) return 'Too many attempts. Please wait a bit and try again.';
  if (code.includes('user-disabled')) return 'This account has been disabled.';
  if (code.includes('network-request-failed')) return 'Network error \u2014 check your connection and try again.';
  if (code.includes('api-key-not-valid') || code.includes('invalid-api-key')) return 'Firebase API key looks invalid for this project. Check your PUBLIC_FIREBASE_API_KEY.';
  if (code) return `Something went wrong (${code}). Please try again.`;
  return 'Something went wrong. Please try again.';
}
