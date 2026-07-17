// src/scripts/robot.ts
// Behavior for the "Bit" mascot: decides *when* to show a message and
// *what* it says. Talks to auth.ts for sign-in state and isFirebaseConfigured
// so it never nags when Firebase isn't even set up.

import {
  isFirebaseConfigured,
  signInWithGoogle,
  signInWithEmailPassword,
  signUpWithEmailPassword,
} from '../lib/firebase';
import { isAnonymous, authState, AUTH_READY_EVENT, AUTH_UPGRADED_EVENT } from './auth';

const SEEN_KEY = 'bit_seen';
const NUDGED_THIS_SESSION_KEY = 'bit_nudged_session'; // sessionStorage: max 1 nudge/session
const DISMISSED_KEY = 'bit_dismissed';

const ROBOT_MESSAGES = {
  welcome: "👋 Hey! I'm <strong>Bit</strong>, your PDF sidekick. Upload a PDF and ask me anything — no signup needed. But hey... if you sign up, I'll remember everything forever. 🧠✨",
  afterFirstUpload: 'Nice upload! 📄 Want me to keep this safe? Sign up and I\'ll sync it to the cloud.',
  afterFirstChat: "Great question! 💬 Sign up so you never lose this conversation.",
  returnVisitor: '👀 Welcome back! Still anonymous — your history is only on this device.',
  signupSuccess: "You're official now! 🎉 Everything's saved. I'll remember you next time.",
};

let elements: {
  root: HTMLElement;
  bubble: HTMLElement;
  text: HTMLElement;
  actions: HTMLElement;
  avatar: HTMLElement;
  close: HTMLElement;
  emailForm: HTMLFormElement;
  emailInput: HTMLInputElement;
  passwordInput: HTMLInputElement;
  googleBtn: HTMLButtonElement;
  laterBtn: HTMLButtonElement;
} | null = null;

let signUpMode = true; // robot is a signup nudge, default to sign-up

export function initRobot() {
  if (!isFirebaseConfigured()) return; // no accounts feature = no nudging

  const root = document.getElementById('bit-mascot');
  if (!root) return;

  elements = {
    root,
    bubble: document.getElementById('bit-bubble')!,
    text: document.getElementById('bit-text')!,
    actions: document.getElementById('bit-actions')!,
    avatar: document.getElementById('bit-avatar')!,
    close: document.getElementById('bit-close')!,
    emailForm: document.getElementById('bit-email-form') as HTMLFormElement,
    emailInput: document.getElementById('bit-email') as HTMLInputElement,
    passwordInput: document.getElementById('bit-password') as HTMLInputElement,
    googleBtn: document.getElementById('bit-signup-google') as HTMLButtonElement,
    laterBtn: document.getElementById('bit-later') as HTMLButtonElement,
  };

  elements.close.addEventListener('click', hide);
  elements.laterBtn.addEventListener('click', hide);
  elements.avatar.addEventListener('click', () => {
    if (elements!.root.classList.contains('hidden')) {
      show(ROBOT_MESSAGES.welcome, { withSignup: true });
    } else {
      hide();
    }
  });
  elements.googleBtn.addEventListener('click', () => handleSignIn({ type: 'google' }));
  elements.emailForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handleSignIn({
      type: 'email',
      email: elements!.emailInput.value.trim(),
      password: elements!.passwordInput.value,
    });
  });

  window.addEventListener(AUTH_READY_EVENT, onAuthReady, { once: true });
  window.addEventListener(AUTH_UPGRADED_EVENT, onUpgraded);
  window.addEventListener('pdfbuddy:first-upload', () => maybeNudge(ROBOT_MESSAGES.afterFirstUpload));
  window.addEventListener('pdfbuddy:first-chat', () => maybeNudge(ROBOT_MESSAGES.afterFirstChat));
}

function onAuthReady() {
  if (!isAnonymous()) return; // already a real account, nothing to nudge about

  const hasSeen = localStorage.getItem(SEEN_KEY);
  if (!hasSeen) {
    localStorage.setItem(SEEN_KEY, '1');
    setTimeout(() => show(ROBOT_MESSAGES.welcome, { withSignup: true }), 1200);
  } else {
    maybeNudge(ROBOT_MESSAGES.returnVisitor, { withSignup: true });
  }
}

function onUpgraded() {
  show(ROBOT_MESSAGES.signupSuccess, { withSignup: false, autoHideMs: 4500 });
}

/** Shows a nudge at most once per browser session, and never if already dismissed for good. */
function maybeNudge(message: string, opts: { withSignup?: boolean } = {}) {
  if (!isAnonymous()) return;
  if (sessionStorage.getItem(NUDGED_THIS_SESSION_KEY)) return;
  sessionStorage.setItem(NUDGED_THIS_SESSION_KEY, '1');
  show(message, { withSignup: opts.withSignup ?? true });
}

function show(message: string, opts: { withSignup?: boolean; autoHideMs?: number } = {}) {
  if (!elements) return;
  elements.root.classList.remove('hidden');
  elements.actions.classList.toggle('hidden', !opts.withSignup);
  typeMessage(message);
  if (opts.autoHideMs) setTimeout(hide, opts.autoHideMs);
}

function hide() {
  if (!elements) return;
  elements.root.classList.add('hidden');
  localStorage.setItem(DISMISSED_KEY, String(Date.now()));
}

let typeTimer: ReturnType<typeof setTimeout> | null = null;

/** Simple typed-text reveal. Strips tags for the typing pass, then restores markup instantly at the end (keeps <strong> intact without character-by-character HTML parsing bugs). */
function typeMessage(html: string) {
  if (!elements) return;
  if (typeTimer) clearTimeout(typeTimer);

  const plain = html.replace(/<[^>]+>/g, '');
  elements.text.textContent = '';
  let i = 0;

  const step = () => {
    if (!elements) return;
    i += 2;
    if (i >= plain.length) {
      elements.text.innerHTML = html;
      return;
    }
    elements.text.textContent = plain.slice(0, i);
    typeTimer = setTimeout(step, 18);
  };
  step();
}

async function handleSignIn(method: { type: 'email'; email: string; password: string } | { type: 'google' }) {
  if (!elements) return;
  try {
    let user;
    if (method.type === 'google') {
      user = await signInWithGoogle();
    } else {
      // Robot is a signup nudge, so create account
      user = await signUpWithEmailPassword(method.email, method.password);
    }
    authState.user = user;
    // Fire auth-ready event so other parts of the app (top bar, etc.) update
    window.dispatchEvent(new CustomEvent('pdfbuddy:auth-ready', { detail: { user } }));
    // onUpgraded() handles the success message via the auth-upgraded event.
  } catch (err: any) {
    elements.text.textContent = `Hmm, that didn't work: ${err?.message ?? 'unknown error'}. Try again?`;
  }
}
