const GEMINI_API_KEY = import.meta.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
const EMBED_MODEL = 'gemini-embedding-001';
const CHAT_MODEL = 'gemini-flash-lite-latest';

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

export function hasGeminiKey(): boolean {
  return Boolean(GEMINI_API_KEY);
}

export async function embedText(text: string): Promise<number[] | null> {
  if (!GEMINI_API_KEY) return null;
  try {
    const res = await fetch(
      `${BASE_URL}/models/${EMBED_MODEL}:embedContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: `models/${EMBED_MODEL}`,
          content: { parts: [{ text }] },
        }),
      }
    );
    if (!res.ok) {
      console.error('Gemini embed error', res.status, await res.text());
      return null;
    }
    const data = await res.json();
    return data?.embedding?.values ?? null;
  } catch (err) {
    console.error('Gemini embed exception', err);
    return null;
  }
}

export async function embedBatch(texts: string[]): Promise<(number[] | null)[]> {
  // Gemini embedContent is single-item; run with limited concurrency.
  const results: (number[] | null)[] = new Array(texts.length).fill(null);
  const CONCURRENCY = 5;
  let idx = 0;

  async function worker() {
    while (idx < texts.length) {
      const current = idx++;
      results[current] = await embedText(texts[current]);
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return results;
}

export interface ChatAnswer {
  text: string;
  source: 'gemini';
}

export async function askGemini(
  question: string,
  contextChunks: string[]
): Promise<ChatAnswer | null> {
  if (!GEMINI_API_KEY) return null;

  const context = contextChunks
    .map((c, i) => `[Excerpt ${i + 1}]\n${c}`)
    .join('\n\n');

  const prompt = `You are a helpful assistant answering questions about a PDF document. Use ONLY the excerpts below to answer. If the answer isn't in the excerpts, say you couldn't find that in the document.

${context}

Question: ${question}

Answer clearly and concisely, citing excerpt numbers like [Excerpt 1] where relevant.`;

  try {
    const res = await fetch(
      `${BASE_URL}/models/${CHAT_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 1024,
          },
        }),
      }
    );

    if (!res.ok) {
      console.error('Gemini chat error', res.status, await res.text());
      return null;
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;

    return { text, source: 'gemini' };
  } catch (err) {
    console.error('Gemini chat exception', err);
    return null;
  }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
