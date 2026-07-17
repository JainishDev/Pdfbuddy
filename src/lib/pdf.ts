// Polyfill browser canvas APIs (DOMMatrix, ImageData, Path2D) that pdfjs-dist's
// Node "legacy" build expects at import time. This MUST run before `unpdf` (and
// therefore `pdfjs-dist`) is imported below.
//
// Note: pdfjs-dist specifically looks for `@napi-rs/canvas` (not the old `canvas`
// package) to auto-polyfill these globals, and merely `import`-ing a package
// doesn't attach anything to `globalThis` on its own — we have to assign it
// ourselves so this works reliably once bundled for serverless.
import { DOMMatrix, ImageData, Path2D } from '@napi-rs/canvas';

if (typeof globalThis.DOMMatrix === 'undefined') {
  // @ts-expect-error - polyfilling a browser global pdfjs-dist expects in Node
  globalThis.DOMMatrix = DOMMatrix;
}
if (typeof globalThis.ImageData === 'undefined') {
  // @ts-expect-error - polyfilling a browser global pdfjs-dist expects in Node
  globalThis.ImageData = ImageData;
}
if (typeof globalThis.Path2D === 'undefined') {
  // @ts-expect-error - polyfilling a browser global pdfjs-dist expects in Node
  globalThis.Path2D = Path2D;
}

import { extractText, getDocumentProxy } from 'unpdf';

export interface ParsedPdf {
  text: string;
  numPages: number;
}

export async function parsePdf(buffer: Buffer): Promise<ParsedPdf> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  return {
    text: text || '',
    numPages: pdf.numPages || 0,
  };
}

/**
 * Splits text into overlapping chunks by character count, trying to break
 * on paragraph/sentence boundaries for better semantic coherence.
 */
export function chunkText(text: string, chunkSize = 1200, overlap = 150): string[] {
  const clean = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!clean) return [];

  const chunks: string[] = [];
  let start = 0;

  while (start < clean.length) {
    let end = Math.min(start + chunkSize, clean.length);

    if (end < clean.length) {
      // try to break on paragraph, then sentence, then space
      const window = clean.slice(start, end);
      const lastPara = window.lastIndexOf('\n\n');
      const lastSentence = window.lastIndexOf('. ');
      const lastSpace = window.lastIndexOf(' ');

      if (lastPara > chunkSize * 0.5) {
        end = start + lastPara;
      } else if (lastSentence > chunkSize * 0.5) {
        end = start + lastSentence + 1;
      } else if (lastSpace > chunkSize * 0.5) {
        end = start + lastSpace;
      }
    }

    const piece = clean.slice(start, end).trim();
    if (piece.length > 0) chunks.push(piece);

    if (end >= clean.length) break;
    start = end - overlap;
    if (start < 0) start = 0;
  }

  return chunks;
}