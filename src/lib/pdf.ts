import { PDFParse } from 'pdf-parse';

export interface ParsedPdf {
  text: string;
  numPages: number;
}

export async function parsePdf(buffer: Buffer): Promise<ParsedPdf> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    return {
      text: result.text || '',
      numPages: result.pages?.length || result.total || 0,
    };
  } finally {
    await parser.destroy();
  }
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
