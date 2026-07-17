const STOPWORDS = new Set([
  'the', 'and', 'for', 'that', 'with', 'this', 'from', 'are', 'was', 'were', 'have', 'has', 'had',
  'you', 'your', 'their', 'they', 'them', 'but', 'not', 'can', 'will', 'all', 'any', 'into', 'about',
  'more', 'than', 'then', 'also', 'such', 'may', 'these', 'those', 'between', 'within', 'without',
  'pdf', 'page', 'document',
]);

export interface DocumentAnalysis {
  wordCount: number;
  readingMinutes: number;
  averageWordsPerPage: number;
  readability: 'Sparse' | 'Balanced' | 'Dense';
  extractionQuality: 'Low' | 'Good' | 'Strong';
  keyTerms: string[];
  dates: string[];
  numbers: string[];
  emails: string[];
  urls: string[];
  headings: string[];
}

export function analyzeDocument(text: string, pageCount: number): DocumentAnalysis {
  const words = text.match(/[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)?/g) || [];
  const wordCount = words.length;
  const safePages = Math.max(pageCount || 1, 1);
  const averageWordsPerPage = Math.round(wordCount / safePages);
  const readingMinutes = Math.max(1, Math.ceil(wordCount / 220));

  return {
    wordCount,
    readingMinutes,
    averageWordsPerPage,
    readability: densityLabel(averageWordsPerPage),
    extractionQuality: qualityLabel(text, wordCount, safePages),
    keyTerms: extractKeyTerms(text, 8),
    dates: uniqueMatches(text, /\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{2,4})\b/gi, 6),
    numbers: uniqueMatches(text, /\b(?:[$€£₹]\s?)?\d[\d,]*(?:\.\d+)?%?\b/g, 8),
    emails: uniqueMatches(text, /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, 5),
    urls: uniqueMatches(text, /\bhttps?:\/\/[^\s)]+/gi, 5),
    headings: extractHeadings(text, 6),
  };
}

export function extractKeyTerms(text: string, limit = 8): string[] {
  const counts = new Map<string, number>();
  for (const raw of text.match(/[A-Za-z][A-Za-z0-9-]{2,}/g) || []) {
    const term = normalizeTerm(raw);
    if (term.length < 3 || STOPWORDS.has(term)) continue;
    counts.set(term, (counts.get(term) || 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([term]) => titleCase(term));
}

function extractHeadings(text: string, limit: number): string[] {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 4 && line.length <= 90)
    .filter((line) => {
      const words = line.split(/\s+/);
      const uppercaseRatio = line.replace(/[^A-Z]/g, '').length / Math.max(line.replace(/[^A-Za-z]/g, '').length, 1);
      return words.length <= 10 && (uppercaseRatio > 0.45 || /^[0-9A-Z][^.!?]+$/.test(line));
    })
    .slice(0, limit);
}

function uniqueMatches(text: string, regex: RegExp, limit: number): string[] {
  return Array.from(new Set((text.match(regex) || []).map((value) => value.trim().replace(/[.,;:]$/, '')))).slice(0, limit);
}

function normalizeTerm(term: string) {
  return term.toLowerCase().replace(/(?:'s|s'|ing|ed|es|s)$/i, '');
}

function titleCase(term: string) {
  return term.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function densityLabel(wordsPerPage: number): DocumentAnalysis['readability'] {
  if (wordsPerPage < 140) return 'Sparse';
  if (wordsPerPage > 420) return 'Dense';
  return 'Balanced';
}

function qualityLabel(text: string, wordCount: number, pageCount: number): DocumentAnalysis['extractionQuality'] {
  const oddChars = (text.match(/[�□■●]/g) || []).length;
  const wordsPerPage = wordCount / pageCount;
  if (wordCount < 80 || oddChars > 20 || wordsPerPage < 30) return 'Low';
  if (wordCount > 500 && oddChars < 5) return 'Strong';
  return 'Good';
}
