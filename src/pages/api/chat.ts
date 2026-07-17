import type { APIRoute } from 'astro';
import { askGemini, cosineSimilarity, embedText, hasGeminiKey } from '../../lib/gemini';
import { rankChunksByKeyword, buildFallbackAnswer } from '../../lib/fallback';

export const prerender = false;

interface ClientChunk {
  content: string;
  embedding: number[] | null;
}

// Stateless: the client sends the chunks it got back from /api/upload along
// with every question, so no server-side database is needed at all. This
// keeps the app deployable as-is on Netlify's serverless functions, which
// don't share a persistent filesystem between invocations.
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { question, chunks } = body as { question?: string; chunks?: ClientChunk[] };

    if (!question || !question.trim()) {
      return json({ error: 'A question is required' }, 400);
    }

    if (!Array.isArray(chunks) || chunks.length === 0) {
      return json({ error: 'No document content was provided. Try uploading the PDF again.' }, 422);
    }

    // fallback ranking works over objects with an `id` + `content`
    const chunkRows = chunks.map((c, i) => ({ id: String(i), content: c.content, embedding: c.embedding }));

    let selectedChunks: string[] = [];
    let answerText = '';
    let source: 'gemini' | 'fallback' = 'fallback';
    let usedGemini = false;

    // --- Primary path: Gemini + embedding-based retrieval ---
    if (hasGeminiKey()) {
      const questionEmbedding = await embedText(question);

      if (questionEmbedding) {
        const embedded = chunkRows.filter((c) => c.embedding);
        if (embedded.length > 0) {
          const scored = embedded
            .map((c) => ({
              content: c.content,
              score: cosineSimilarity(questionEmbedding, c.embedding as number[]),
            }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 5);
          selectedChunks = scored.map((s) => s.content);
        }
      }

      // If embeddings weren't available for retrieval, fall back to keyword
      // ranking just to pick context, but still try Gemini for generation.
      if (selectedChunks.length === 0) {
        const ranked = rankChunksByKeyword(question, chunkRows as any, 5);
        selectedChunks = ranked.length > 0
          ? ranked.map((r: any) => r.content)
          : chunkRows.slice(0, 3).map((c) => c.content);
      }

      const geminiAnswer = await askGemini(question, selectedChunks);
      if (geminiAnswer) {
        answerText = geminiAnswer.text;
        source = 'gemini';
        usedGemini = true;
      }
    }

    // --- Fallback path: rule-based keyword search, no external API ---
    if (!usedGemini) {
      const ranked = rankChunksByKeyword(question, chunkRows as any, 4);
      answerText = buildFallbackAnswer(question, ranked);
      source = 'fallback';
    }

    return json({ answer: answerText, source });
  } catch (err: any) {
    console.error('Chat error', err);
    return json({ error: 'Failed to answer question', detail: String(err?.message || err) }, 500);
  }
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
