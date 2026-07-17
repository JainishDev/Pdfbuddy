import type { APIRoute } from 'astro';
import { nanoid } from 'nanoid';
import { parsePdf, chunkText } from '../../lib/pdf';
import { embedBatch, hasGeminiKey } from '../../lib/gemini';
import { analyzeDocument } from '../../lib/analysis';

export const prerender = false;

// Stateless by design: Netlify functions have no shared/persistent
// filesystem across invocations, so there's nothing durable to write to
// here. Instead we parse + chunk + (optionally) embed the PDF once, then
// hand the whole result back to the client, which holds it in memory for
// the rest of the session and sends it along with each /api/chat request.
export const POST: APIRoute = async ({ request }) => {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return json({ error: 'No file uploaded' }, 400);
    }

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      return json({ error: 'Only PDF files are supported' }, 400);
    }

    const MAX_SIZE = 25 * 1024 * 1024; // 25MB
    if (file.size > MAX_SIZE) {
      return json({ error: 'File too large (max 25MB)' }, 400);
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const parsed = await parsePdf(buffer);
    if (!parsed.text || parsed.text.trim().length < 10) {
      return json({ error: 'I could not read text from this PDF. It may be a scanned file, so convert it to a searchable PDF first and try again.' }, 422);
    }

    const chunks = chunkText(parsed.text);
    if (chunks.length === 0) {
      return json({ error: 'I could not find enough readable text in this PDF.' }, 422);
    }

    const documentId = nanoid();
    const analysis = analyzeDocument(parsed.text, parsed.numPages);

    // Store optional semantic vectors when configured; local rules still work without them.
    let embeddings: (number[] | null)[] = new Array(chunks.length).fill(null);
    if (hasGeminiKey()) {
      embeddings = await embedBatch(chunks);
    }

    const chunkPayload = chunks.map((content, i) => ({
      content,
      embedding: embeddings[i] || null,
    }));

    return json({
      documentId,
      filename: file.name,
      pageCount: parsed.numPages,
      chunkCount: chunks.length,
      charCount: parsed.text.length,
      analysis,
      embedded: hasGeminiKey(),
      chunks: chunkPayload,
    });
  } catch (err: any) {
    console.error('Upload error', err);
    return json({ error: 'Failed to process PDF', detail: String(err?.message || err) }, 500);
  }
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
