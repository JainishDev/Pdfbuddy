// src/scripts/history.ts
// "Recent PDFs" panel — stores up to MAX_ENTRIES documents per user in
// localStorage under a key that includes the Firebase UID (or "anon" when
// not signed in), so history is isolated per account and automatically
// switches when the user signs in / out.

import { appState } from './chrome';
import { switchToChat } from './chat';
import { authState, AUTH_READY_EVENT, AUTH_UPGRADED_EVENT } from './auth';

const BASE_KEY = 'pdfbuddy_recent_docs';
const MAX_ENTRIES = 12;

interface RecentDoc {
  documentId: string;
  filename: string;
  pageCount: number;
  charCount: number;
  analysis: any;
  chunkCount: number;
  chunks: { content: string; embedding: number[] | null }[];
  savedAt: number;
}

// Returns a per-user storage key so history is isolated between accounts.
function storageKey(): string {
  const uid = authState.user?.uid;
  return uid ? `${BASE_KEY}_${uid}` : `${BASE_KEY}_anon`;
}

function readHistory(): RecentDoc[] {
  try {
    const raw = localStorage.getItem(storageKey());
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeHistory(docs: RecentDoc[]) {
  try {
    localStorage.setItem(storageKey(), JSON.stringify(docs));
  } catch {
    // Quota exceeded — recent-docs is a nice-to-have, fail silently.
  }
}

/** Call right after a successful /api/upload response. */
export function saveDocumentToHistory(data: any) {
  const docs = readHistory().filter((d) => d.documentId !== data.documentId);
  docs.unshift({
    documentId: data.documentId,
    filename: data.filename,
    pageCount: data.pageCount,
    charCount: data.charCount,
    analysis: data.analysis,
    chunkCount: data.chunkCount,
    chunks: data.chunks,
    savedAt: Date.now(),
  });
  writeHistory(docs.slice(0, MAX_ENTRIES));
  renderList();
}

function removeFromHistory(documentId: string) {
  writeHistory(readHistory().filter((d) => d.documentId !== documentId));
  renderList();
}

function clearAllHistory() {
  writeHistory([]);
  renderList();
}

function timeAgo(ts: number): string {
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function renderList() {
  const list = document.getElementById('recent-docs-list');
  const empty = document.getElementById('recent-docs-empty');
  const clearBtn = document.getElementById('recent-docs-clear');
  const countBadge = document.getElementById('recent-docs-count');
  if (!list) return;
  const docs = readHistory();
  list.innerHTML = '';

  if (empty) empty.classList.toggle('hidden', docs.length > 0);
  if (clearBtn) clearBtn.classList.toggle('hidden', docs.length === 0);
  if (countBadge) {
    countBadge.textContent = String(docs.length);
    countBadge.classList.toggle('hidden', docs.length === 0);
  }

  if (docs.length === 0) return;

  for (const doc of docs) {
    const item = document.createElement('div');
    item.className = 'recent-doc-item';

    const openBtn = document.createElement('button');
    openBtn.type = 'button';
    openBtn.className = 'recent-doc-open';
    openBtn.innerHTML = `<span class="recent-doc-name">${escapeHtml(doc.filename)}</span><span class="recent-doc-meta">${doc.pageCount} pages · ${timeAgo(doc.savedAt)}</span>`;
    openBtn.addEventListener('click', () => {
      appState.currentDocumentId = doc.documentId;
      appState.currentChunks = doc.chunks;
      switchToChat(doc);
      closeDropdown();
      document.getElementById('doc-badge')?.classList.remove('hidden');
      document.getElementById('new-doc-btn')?.classList.remove('hidden');
      const badge = document.getElementById('doc-badge');
      if (badge) badge.textContent = doc.filename;
    });

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'recent-doc-remove';
    removeBtn.setAttribute('aria-label', 'Remove from recent');
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeFromHistory(doc.documentId);
    });

    item.appendChild(openBtn);
    item.appendChild(removeBtn);
    list.appendChild(item);
  }
}

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function closeDropdown() {
  document.getElementById('recent-docs-panel')?.classList.add('hidden');
  const btn = document.getElementById('recent-docs-btn');
  btn?.setAttribute('aria-expanded', 'false');
}

export function initHistory() {
  const btn = document.getElementById('recent-docs-btn') as HTMLButtonElement;
  const panel = document.getElementById('recent-docs-panel')!;
  const clearBtn = document.getElementById('recent-docs-clear') as HTMLButtonElement | null;
  if (!btn || !panel) return;

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = !panel.classList.contains('hidden');
    panel.classList.toggle('hidden', isOpen);
    btn.setAttribute('aria-expanded', String(!isOpen));
  });
  document.addEventListener('click', (e) => {
    if (!panel.contains(e.target as Node) && e.target !== btn) closeDropdown();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDropdown();
  });

  clearBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (readHistory().length === 0) return;
    if (confirm('Clear all PDF history in this browser? This cannot be undone.')) {
      clearAllHistory();
    }
  });

  // Refresh list when auth state resolves so we load the right user's history.
  window.addEventListener(AUTH_READY_EVENT, () => renderList());
  // Also refresh if an anonymous user upgrades to a real account.
  window.addEventListener(AUTH_UPGRADED_EVENT, () => renderList());

  renderList();
}
