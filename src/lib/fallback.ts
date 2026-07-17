// Local rule engine: TF-IDF style keyword scoring, light stemming,
// query intent detection, and extractive answers over indexed chunks.

const STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'to', 'of', 'in', 'on', 'at', 'for', 'and', 'or', 'but', 'with',
  'this', 'that', 'these', 'those', 'it', 'its', 'as', 'by', 'from',
  'what', 'when', 'where', 'who', 'why', 'how', 'does', 'do', 'did',
  'can', 'could', 'would', 'should', 'will', 'shall', 'i', 'you', 'we',
  'they', 'he', 'she', 'my', 'your', 'their', 'our', 'is', 'has', 'have',
  'had', 'not', 'no', 'yes',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))
    .map(stem);
}

function termFrequency(tokens: string[]): Map<string, number> {
  const freq = new Map<string, number>();
  for (const t of tokens) freq.set(t, (freq.get(t) || 0) + 1);
  return freq;
}

export interface ScoredChunk {
  index: number;
  content: string;
  score: number;
}

type Intent = 'summary' | 'actions' | 'dates' | 'numbers' | 'definition' | 'general';

/**
 * Score chunks against a question using simple TF-IDF-like overlap
 * scoring. No embeddings, no external calls - pure JS, always available.
 */
export function rankChunksByKeyword(
  question: string,
  chunks: { content: string }[],
  topK = 4
): ScoredChunk[] {
  const qTokens = tokenize(question);
  const expanded = expandQueryTerms(qTokens);
  const qFreq = termFrequency(expanded);
  const qTerms = Array.from(qFreq.keys());

  // document frequency across chunks
  const df = new Map<string, number>();
  const chunkTokenSets = chunks.map((c) => new Set(tokenize(c.content)));
  for (const term of qTerms) {
    let count = 0;
    for (const set of chunkTokenSets) if (set.has(term)) count++;
    df.set(term, count);
  }

  const N = chunks.length || 1;

  const scored: ScoredChunk[] = chunks.map((c, i) => {
    const tokens = tokenize(c.content);
    const freq = termFrequency(tokens);
    let score = 0;
    for (const term of qTerms) {
      const tf = freq.get(term) || 0;
      if (tf === 0) continue;
      const idf = Math.log(1 + N / (1 + (df.get(term) || 0)));
      score += tf * idf;
    }
    // Bonuses for exact phrase and nearby query terms.
    if (question.length > 4 && c.content.toLowerCase().includes(question.toLowerCase())) {
      score += 5;
    }
    if (hasNearbyTerms(c.content, qTerms)) score += 1.5;
    return { index: i, content: c.content, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.filter((s) => s.score > 0).slice(0, topK);
}

/**
 * Builds a grounded answer directly from matched excerpts.
 */
export function buildFallbackAnswer(question: string, matches: ScoredChunk[]): string {
  if (matches.length === 0) {
    return "I couldn't find that in the PDF. Try asking it another way, or mention a specific topic from the file.";
  }

  const intent = detectIntent(question);
  const text = matches.map((m) => m.content).join('\n\n');

  if (intent === 'summary') {
    return `Here is a quick summary:\n\n${extractSentences(text, question, 5)
      .map((s) => `• ${s}`)
      .join('\n')}`;
  }

  if (intent === 'actions') {
    const actions = extractActionSentences(text);
    if (actions.length > 0) return `Here are the likely action items or decisions:\n\n${actions.map((s) => `• ${s}`).join('\n')}`;
  }

  if (intent === 'dates') {
    const dates = Array.from(new Set(text.match(/\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{2,4})\b/gi) || []));
    if (dates.length > 0) return `I found these dates:\n\n${dates.slice(0, 10).map((d) => `• ${d}`).join('\n')}`;
  }

  if (intent === 'numbers') {
    const numbers = Array.from(new Set(text.match(/\b(?:[$€£₹]\s?)?\d[\d,]*(?:\.\d+)?%?\b/g) || []));
    if (numbers.length > 0) return `I found these numbers:\n\n${numbers.slice(0, 12).map((n) => `• ${n}`).join('\n')}`;
  }

  const excerpts = matches.map((m, i) => {
    const best = extractSentences(m.content, question, 2).join(' ');
    const excerpt = best || m.content.slice(0, 520);
    return `**From the PDF ${i + 1}:**\n${excerpt}${excerpt.length > 520 ? '…' : ''}`;
  }).join('\n\n');

  return `Here is what I found in your PDF:\n\n${excerpts}`;
}

function detectIntent(question: string): Intent {
  const q = question.toLowerCase();
  if (/\b(summary|summarize|overview|brief|main points|key points)\b/.test(q)) return 'summary';
  if (/\b(action|todo|task|decision|next step|follow up|follow-up)\b/.test(q)) return 'actions';
  if (/\b(date|deadline|timeline|when|schedule)\b/.test(q)) return 'dates';
  if (/\b(number|amount|price|cost|percent|percentage|metric|total)\b/.test(q)) return 'numbers';
  if (/\b(define|definition|meaning|what is|what are)\b/.test(q)) return 'definition';
  return 'general';
}

function extractSentences(text: string, question: string, limit: number): string[] {
  const terms = new Set(tokenize(question));
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 35 && sentence.length < 360)
    .map((sentence) => ({
      sentence,
      score: tokenize(sentence).reduce((sum, term) => sum + (terms.has(term) ? 1 : 0), 0),
    }))
    .sort((a, b) => b.score - a.score || a.sentence.length - b.sentence.length)
    .slice(0, limit)
    .map((item) => item.sentence);
}

function extractActionSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => /\b(must|should|need to|needs to|required|action|decision|assign|follow up|deadline|next step|responsible)\b/i.test(sentence))
    .filter((sentence) => sentence.length > 25 && sentence.length < 320)
    .slice(0, 8);
}

function expandQueryTerms(tokens: string[]): string[] {
  const expansions: Record<string, string[]> = {
    cost: ['price', 'amount', 'fee', 'budget'],
    date: ['deadline', 'schedule', 'timeline'],
    task: ['action', 'todo', 'responsible'],
    summary: ['overview', 'brief', 'key'],
    risk: ['issue', 'concern', 'problem'],
  };
  return tokens.flatMap((token) => [token, ...(expansions[token] || [])]);
}

function hasNearbyTerms(content: string, terms: string[]) {
  const tokens = tokenize(content);
  const positions = tokens
    .map((token, index) => (terms.includes(token) ? index : -1))
    .filter((index) => index >= 0);
  return positions.some((position, i) => positions[i + 1] !== undefined && positions[i + 1] - position <= 12);
}

function stem(token: string) {
  return token.replace(/(?:'s|s'|ing|edly|edly|ed|es|s)$/i, '');
}
