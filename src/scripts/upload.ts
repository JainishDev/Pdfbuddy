// src/scripts/upload.ts
// Handles everything on the upload screen: drag & drop, file picking,
// POSTing to /api/upload, and handing off to the chat screen on success.

import { appState, playLaunchBurst } from './chrome';
import { switchToChat } from './chat';
import { saveDocumentToHistory } from './history';

export function initUpload() {
  const dropzone = document.getElementById('dropzone')!;
  const fileInput = document.getElementById('file-input') as HTMLInputElement;
  const browseBtn = document.getElementById('browse-btn')!;
  const uploadScreen = document.getElementById('upload-screen')!;
  const chatScreen = document.getElementById('chat-screen')!;
  const uploadStatus = document.getElementById('upload-status')!;
  const uploadStatusText = document.getElementById('upload-status-text')!;
  const uploadError = document.getElementById('upload-error')!;
  const docBadge = document.getElementById('doc-badge')!;
  const newDocBtn = document.getElementById('new-doc-btn')!;

  browseBtn.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('click', (e) => {
    if (e.target === dropzone) fileInput.click();
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files && fileInput.files[0]) {
      handleUpload(fileInput.files[0]);
    }
  });

  ['dragenter', 'dragover'].forEach((evt) => {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.add('drag-over');
    });
  });
  ['dragleave', 'drop'].forEach((evt) => {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.remove('drag-over');
    });
  });
  dropzone.addEventListener('drop', (e: DragEvent) => {
    const file = e.dataTransfer?.files?.[0];
    if (file) handleUpload(file);
  });

  newDocBtn.addEventListener('click', () => {
    appState.currentDocumentId = null;
    appState.currentChunks = [];
    fileInput.value = '';
    docBadge.classList.add('hidden');
    newDocBtn.classList.add('hidden');
    chatScreen.classList.add('hidden');
    uploadScreen.classList.remove('hidden');
    uploadScreen.classList.remove('screen-fade-in');
    void uploadScreen.offsetWidth;
    uploadScreen.classList.add('screen-fade-in');
    uploadError.classList.add('hidden');
  });

  async function handleUpload(file: File) {
    uploadError.classList.add('hidden');

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      showUploadError('That is not a PDF. Try a .pdf file.');
      return;
    }

    uploadStatus.classList.remove('hidden');
    setAnalysisStep('upload', `GETTING YOUR ${formatBytes(file.size)} PDF…`);

    const formData = new FormData();
    formData.append('file', file);

    let progressTimer = 0;
    try {
      progressTimer = startAnalysisProgress();
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      clearInterval(progressTimer);

      if (!res.ok) {
        showUploadError(data.error || 'Upload failed. Try again.');
        uploadStatus.classList.add('hidden');
        return;
      }

      setAnalysisStep('ready', `READY: ${data.pageCount} PAGES READ`);
      appState.currentDocumentId = data.documentId;
      appState.currentChunks = data.chunks || [];
      saveDocumentToHistory(data);
      docBadge.textContent = data.filename;
      docBadge.classList.remove('hidden');
      newDocBtn.classList.remove('hidden');

      uploadStatus.classList.add('hidden');
      await playLaunchBurst();
      switchToChat(data);

      if (!localStorage.getItem('pdfbuddy_had_upload')) {
        localStorage.setItem('pdfbuddy_had_upload', '1');
        window.dispatchEvent(new CustomEvent('pdfbuddy:first-upload'));
      }
    } catch (err) {
      clearInterval(progressTimer);
      showUploadError('Network error — could not reach the server.');
      uploadStatus.classList.add('hidden');
    }
  }

  function showUploadError(msg: string) {
    uploadError.textContent = msg;
    uploadError.classList.remove('hidden');
  }

  function startAnalysisProgress() {
    const stages = [
      { step: 'parse', text: 'READING THE PAGES…' },
      { step: 'index', text: 'ORGANIZING THE IMPORTANT PARTS…' },
      { step: 'ready', text: 'GETTING YOUR CHAT READY…' },
    ];
    let idx = 0;
    return window.setInterval(() => {
      const stage = stages[Math.min(idx, stages.length - 1)];
      setAnalysisStep(stage.step, stage.text);
      idx += 1;
    }, 900);
  }

  function setAnalysisStep(activeStep: string, text: string) {
    uploadStatusText.textContent = text;
    ['upload', 'parse', 'index', 'ready'].forEach((step) => {
      const el = document.getElementById(`step-${step}`);
      if (!el) return;
      el.classList.toggle('active', step === activeStep);
      el.classList.toggle('done', stepOrder(step) < stepOrder(activeStep));
    });
  }

  function stepOrder(step: string) {
    return ['upload', 'parse', 'index', 'ready'].indexOf(step);
  }

  function formatBytes(bytes: number) {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }
}
