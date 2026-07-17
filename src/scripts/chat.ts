// src/scripts/chat.ts
// Handles the chat screen: revealing it once a document is loaded,
// sending questions to /api/chat, and rendering the conversation
// (with timestamps, copy-to-clipboard, and a "jump to latest" button).

import { appState } from './chrome';

const uploadScreen = () => document.getElementById('upload-screen')!;
const chatScreen = () => document.getElementById('chat-screen')!;
const chatWindow = () => document.getElementById('chat-window')!;
const chatInput = () => document.getElementById('chat-input') as HTMLInputElement;
const scrollBtn = () => document.getElementById('scroll-bottom-btn') as HTMLButtonElement;
const inputCount = () => document.getElementById('input-count')!;

interface TranscriptEntry {
  role: 'user' | 'assistant';
  text: string;
  source?: string;
}
let transcript: TranscriptEntry[] = [];
let activeDocInfo: any = null;
let lastFailedQuestion: string | null = null;

export function switchToChat(docInfo: any) {
  activeDocInfo = docInfo;
  transcript = [];
  uploadScreen().classList.add('hidden');
  const screen = chatScreen();
  screen.classList.remove('hidden');
  screen.classList.remove('screen-fade-in');
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  void screen.offsetWidth; // restart the animation if it's already been played once
  screen.classList.add('screen-fade-in');
  chatWindow().innerHTML = '';
  updateDocumentDock(docInfo);
  addAssistantMessage(
    `"${docInfo.filename}" is ready. I read ${formatNumber(docInfo.analysis?.wordCount || 0)} words across ${docInfo.pageCount} pages. Ask anything, or try one of the quick questions above.`,
    'document'
  );
  // Defer focus until after the CSS transition so mobile keyboards don't
  // flicker during the screen-fade-in animation.
  setTimeout(() => chatInput().focus(), 350);
}

export function initChat() {
  const chatForm = document.getElementById('chat-form') as HTMLFormElement;
  const clearChatBtn = document.getElementById('clear-chat-btn') as HTMLButtonElement;
  const exportChatBtn = document.getElementById('export-chat-btn') as HTMLButtonElement;

  exportChatBtn.addEventListener('click', () => exportTranscript());

  chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = chatInput();
    const question = input.value.trim();
    if (!question || !appState.currentDocumentId) return;
    input.value = '';
    inputCount().textContent = '0';
    await askQuestion(question);
  });

  chatInput().addEventListener('input', () => {
    inputCount().textContent = String(chatInput().value.length);
  });

  document.querySelectorAll<HTMLButtonElement>('[data-question]').forEach((btn) => {
    btn.addEventListener('click', () => {
      chatInput().value = btn.dataset.question || '';
      inputCount().textContent = String(chatInput().value.length);
      chatInput().focus();
    });
  });

  clearChatBtn.addEventListener('click', () => {
    transcript = [];
    chatWindow().innerHTML = '';
    addAssistantMessage('Conversation cleared. Ask a fresh question when you are ready.', 'document');
  });

  initScrollToBottom();
}

async function askQuestion(question: string) {
  const chatForm = document.getElementById('chat-form') as HTMLFormElement;
  const sendBtn = chatForm?.querySelector<HTMLButtonElement>('[type="submit"]');
  if (sendBtn) { sendBtn.disabled = true; sendBtn.textContent = '…'; }

  addUserMessage(question);
  const typingEl = addTypingIndicator();

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, chunks: appState.currentChunks }),
    });
    const data = await res.json();
    typingEl.remove();

    if (!res.ok) {
      lastFailedQuestion = question;
      addAssistantMessage(data.error || 'Something went wrong.', 'fallback', true);
      return;
    }
    lastFailedQuestion = null;
    addAssistantMessage(data.answer, data.source);

    if (!localStorage.getItem('pdfbuddy_had_chat')) {
      localStorage.setItem('pdfbuddy_had_chat', '1');
      window.dispatchEvent(new CustomEvent('pdfbuddy:first-chat'));
    }
  } catch (err) {
    typingEl.remove();
    lastFailedQuestion = question;
    addAssistantMessage('Network error — could not reach the server.', 'fallback', true);
  } finally {
    if (sendBtn) { sendBtn.disabled = false; sendBtn.textContent = 'Send'; }
  }
}

function retryLastQuestion() {
  if (!lastFailedQuestion) return;
  const q = lastFailedQuestion;
  lastFailedQuestion = null;
  askQuestion(q);
}

function updateDocumentDock(docInfo: any) {
  const title = document.getElementById('chat-doc-title');
  const pages = document.getElementById('metric-pages');
  const words = document.getElementById('metric-words');
  const readtime = document.getElementById('metric-readtime');
  const quality = document.getElementById('metric-quality');
  const keyterms = document.getElementById('detail-keyterms');
  const entities = document.getElementById('detail-entities');
  const analysis = docInfo.analysis || {};
  if (title) title.textContent = docInfo.filename || 'Loaded PDF';
  if (pages) pages.textContent = `${docInfo.pageCount || 0} pages`;
  if (words) words.textContent = `${formatNumber(analysis.wordCount || 0)} words`;
  if (readtime) readtime.textContent = `${analysis.readingMinutes || 1} min read`;
  if (quality) quality.textContent = textQualityLabel(analysis.extractionQuality);
  if (keyterms) keyterms.textContent = listOrEmpty(analysis.keyTerms, 'No common topics found yet');
  if (entities) {
    const details = [
      ...(analysis.dates || []).slice(0, 2),
      ...(analysis.numbers || []).slice(0, 3),
      ...(analysis.emails || []).slice(0, 1),
      ...(analysis.urls || []).slice(0, 1),
    ];
    entities.textContent = listOrEmpty(details, 'No dates or numbers found yet');
  }
}

/* ---------------- scroll-to-bottom affordance ---------------- */

function initScrollToBottom() {
  const win = chatWindow();
  const btn = scrollBtn();

  win.addEventListener('scroll', () => {
    const distanceFromBottom = win.scrollHeight - win.scrollTop - win.clientHeight;
    btn.classList.toggle('hidden', distanceFromBottom < 120);
  });

  btn.addEventListener('click', () => scrollChatToBottom());
}

/* ---------------- message rendering ---------------- */

function addUserMessage(text: string) {
  transcript.push({ role: 'user', text });
  const div = document.createElement('div');
  div.className = 'msg user';

  const body = document.createElement('span');
  body.textContent = text;
  div.appendChild(body);
  div.appendChild(makeTimestamp());

  chatWindow().appendChild(div);
  scrollChatToBottom();
}

function addAssistantMessage(text: string, source?: string, showRetry = false) {
  transcript.push({ role: 'assistant', text, source });
  const div = document.createElement('div');
  div.className = 'msg assistant' + (source === 'fallback' || source === 'rule' ? ' fallback' : '');

  const header = document.createElement('div');
  header.className = 'msg-header';

  const tag = document.createElement('span');
  tag.className = 'msg-tag';
  tag.textContent = source === 'fallback' || source === 'rule' ? 'Found in your PDF' : 'PDF Buddy';
  header.appendChild(tag);

  const actions = document.createElement('span');
  actions.className = 'msg-actions';

  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'msg-copy-btn';
  copyBtn.title = 'Copy answer';
  copyBtn.textContent = '⧉';
  copyBtn.addEventListener('click', () => copyToClipboard(text, copyBtn));
  actions.appendChild(copyBtn);

  if (showRetry) {
    const retryBtn = document.createElement('button');
    retryBtn.type = 'button';
    retryBtn.className = 'msg-copy-btn msg-retry-btn';
    retryBtn.title = 'Retry this question';
    retryBtn.textContent = '↻ Retry';
    retryBtn.addEventListener('click', () => retryLastQuestion());
    actions.appendChild(retryBtn);
  }

  header.appendChild(actions);

  div.appendChild(header);

  const body = document.createElement('span');
  body.textContent = text;
  div.appendChild(body);
  div.appendChild(makeTimestamp());

  chatWindow().appendChild(div);
  scrollChatToBottom();
}

function addTypingIndicator() {
  const div = document.createElement('div');
  div.className = 'typing-msg';
  div.innerHTML = '<span></span><span></span><span></span>';
  chatWindow().appendChild(div);
  scrollChatToBottom();
  return div;
}

function makeTimestamp(): HTMLElement {
  const el = document.createElement('time');
  el.className = 'msg-time';
  const now = new Date();
  el.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return el;
}

async function copyToClipboard(text: string, btn: HTMLButtonElement) {
  try {
    await navigator.clipboard.writeText(text);
    const original = btn.textContent;
    btn.textContent = '✓';
    btn.classList.add('copied');
    setTimeout(() => {
      btn.textContent = original;
      btn.classList.remove('copied');
    }, 1200);
  } catch {
    // Clipboard API unavailable — fail silently, it's a non-critical affordance.
  }
}

function scrollChatToBottom() {
  const win = chatWindow();
  win.scrollTo({ top: win.scrollHeight, behavior: 'smooth' });
}

function exportTranscript() {
  if (transcript.length === 0) return;
  const title = activeDocInfo?.filename || 'PDF Buddy conversation';
  const lines = [`# ${title}`, '', `_Exported ${new Date().toLocaleString()}_`, ''];
  for (const entry of transcript) {
    const speaker = entry.role === 'user' ? '**You**' : '**PDF Buddy**';
    lines.push(`${speaker}: ${entry.text}`, '');
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(title || 'pdf-buddy-chat').replace(/\.[^/.]+$/, '').replace(/[^a-z0-9-_]+/gi, '-')}-chat.md`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat().format(value);
}

function listOrEmpty(items: string[] | undefined, fallback: string) {
  return items && items.length > 0 ? items.slice(0, 8).join(', ') : fallback;
}

function textQualityLabel(value: string | undefined) {
  if (value === 'Strong') return 'Text is clear';
  if (value === 'Low') return 'Text may be limited';
  return 'Text looks good';
}
