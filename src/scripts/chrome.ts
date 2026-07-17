// src/scripts/chrome.ts
// Everything that isn't upload or chat: shared app state, the boot
// splash, the light/dark toggle, and the small ambient effects
// (parallax, button ripple, launch burst).
// These were previously seven separate one-purpose files; none of
// them was more than a couple dozen lines, so they're grouped here
// instead of each needing its own module.

const THEME_STORAGE_KEY = 'pdf-buddy-theme';
const PARTICLE_COLORS = ['var(--pink)', 'var(--mint)', 'var(--yellow)', 'var(--sky)', 'var(--purple)'];

export interface ClientChunk {
  content: string;
  embedding: number[] | null;
}

/**
 * Shared between upload.ts and chat.ts so they agree on the active document.
 * There's no server-side database (the app is stateless so it deploys
 * cleanly on Netlify's serverless functions), so the parsed PDF chunks live
 * here in memory for the lifetime of the tab and get sent along with every
 * /api/chat request.
 */
export const appState: {
  currentDocumentId: string | null;
  currentChunks: ClientChunk[];
} = {
  currentDocumentId: null,
  currentChunks: [],
};

/** Wires up everything in this file. Call once on page load. */
export function initChrome() {
  initBoot();
  initTheme();
  initParallax();
  initRipple();
}

/* ---------------- boot splash ---------------- */

function initBoot() {
  const bootScreen = document.getElementById('boot-screen')!;
  const appEl = document.getElementById('app')!;
  const bootMsg = document.getElementById('boot-msg')!;

  const bootMessages = ['CALIBRATING STAR MAP…', 'WARMING DOCUMENT CORE…', 'SYNCING ORBITAL INDEX…', 'READY FOR LAUNCH…'];
  let bmIdx = 0;
  const bmInterval = setInterval(() => {
    bmIdx = (bmIdx + 1) % bootMessages.length;
    bootMsg.textContent = bootMessages[bmIdx];
  }, 950);

  setTimeout(() => {
    clearInterval(bmInterval);
    appEl.classList.remove('hidden');
    bootScreen.classList.add('boot-leaving');
  }, 3600);

  setTimeout(() => {
    bootScreen.remove();
  }, 4400);
}

/* ---------------- light/dark toggle ---------------- */
// The *initial* theme is set synchronously by an inline script in
// Layout.astro (to avoid a flash of the wrong theme) — this only
// handles the interactive part.

function initTheme() {
  const root = document.documentElement;
  const toggle = document.getElementById('theme-toggle');
  if (!toggle) return;

  toggle.setAttribute('aria-pressed', String(root.getAttribute('data-theme') === 'light'));

  toggle.addEventListener('click', () => {
    const next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    playThemeTransition(next);
    root.setAttribute('data-theme', next);
    toggle.setAttribute('aria-pressed', String(next === 'light'));
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // localStorage may be unavailable (private browsing, etc) — non-critical.
    }
  });
}

function playThemeTransition(nextTheme: string) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const oldTransition = document.querySelector('.theme-transition');
  oldTransition?.remove();

  const transition = document.createElement('div');
  transition.className = `theme-transition ${nextTheme === 'light' ? 'to-light' : 'to-dark'}`;

  const core = document.createElement('div');
  core.className = 'theme-transition-core';
  transition.appendChild(core);

  const ring = document.createElement('div');
  ring.className = 'theme-transition-ring';
  transition.appendChild(ring);

  document.body.appendChild(transition);
  transition.addEventListener('animationend', () => transition.remove(), { once: true });
}

/* ---------------- mouse parallax ---------------- */
// Sets --parallax-x / --parallax-y (range -1..1) on the root element
// as the pointer moves, so background layers can subtly drift.

function initParallax() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!window.matchMedia('(pointer: fine)').matches) return;

  const root = document.documentElement;
  let raf = 0;

  window.addEventListener('mousemove', (e) => {
    const x = (e.clientX / window.innerWidth) * 2 - 1;
    const y = (e.clientY / window.innerHeight) * 2 - 1;

    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      root.style.setProperty('--parallax-x', x.toFixed(3));
      root.style.setProperty('--parallax-y', y.toFixed(3));
    });
  });
}

/* ---------------- button ripple ---------------- */
// A single delegated listener gives every button a material-style
// ripple on click. Overflow is only clipped for the brief life of the
// ripple so it never permanently hides a button's outer glow.

function initRipple() {
  document.addEventListener('click', (e: MouseEvent) => {
    const target = (e.target as HTMLElement)?.closest('button');
    if (!target || !(target instanceof HTMLElement)) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const rect = target.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);

    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    ripple.style.width = ripple.style.height = `${size}px`;
    ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
    ripple.style.top = `${e.clientY - rect.top - size / 2}px`;

    const previousPosition = target.style.position;
    const previousOverflow = target.style.overflow;
    if (!previousPosition) target.style.position = 'relative';
    target.style.overflow = 'hidden';

    target.appendChild(ripple);
    ripple.addEventListener('animationend', () => {
      ripple.remove();
      target.style.overflow = previousOverflow;
      target.style.position = previousPosition;
    });
  });
}

/* ---------------- launch burst ---------------- */
// A brief particle burst, played in the center of the screen when a
// PDF finishes uploading. Triggered from upload.ts.

export function playLaunchBurst(durationMs = 650): Promise<void> {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return Promise.resolve();
  }

  const burst = document.createElement('div');
  burst.className = 'launch-burst';

  const core = document.createElement('div');
  core.className = 'burst-core';
  burst.appendChild(core);

  const particleCount = 14;
  for (let i = 0; i < particleCount; i++) {
    const p = document.createElement('div');
    p.className = 'burst-particle';
    const angle = (Math.PI * 2 * i) / particleCount;
    const distance = 90 + Math.random() * 60;
    p.style.setProperty('--tx', `${Math.cos(angle) * distance}px`);
    p.style.setProperty('--ty', `${Math.sin(angle) * distance}px`);
    p.style.setProperty('--delay', `${Math.random() * 0.08}s`);
    p.style.setProperty('--particle-color', PARTICLE_COLORS[i % PARTICLE_COLORS.length]);
    burst.appendChild(p);
  }

  document.body.appendChild(burst);

  return new Promise((resolve) => {
    setTimeout(() => {
      burst.remove();
      resolve();
    }, durationMs);
  });
}
