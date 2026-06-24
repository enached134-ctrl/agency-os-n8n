import type { DeliveryBrief } from "./schema";

export interface Sop {
  id: string;
  title: string;
  url: string;
  keywords: string[];
}

export interface SopSuggestion {
  sop: Sop;
  score: number;
}

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "to", "of", "for", "in", "on", "with", "we", "our",
  "is", "are", "be", "this", "that", "it", "as", "by", "at", "from", "will", "need",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

function briefText(brief: DeliveryBrief): string {
  return [
    brief.title,
    brief.summary,
    ...brief.scope,
    ...brief.actionItems.map((a) => a.task),
  ].join(" ");
}

export interface SuggestSopsOptions {
  /** Minimum overlap score (0-1) required to suggest. Defaults to 0.18. */
  minScore?: number;
  /** Max suggestions to return. Defaults to 3. */
  limit?: number;
}

/**
 * Suggest the most relevant SOPs for a brief using keyword overlap.
 *
 * Deliberately deterministic and abstaining: if nothing clears `minScore` it
 * returns [] (post nothing) rather than attaching an irrelevant SOP — which is
 * what keeps the human-in-the-loop trustworthy. (Distinct from a heavier RAG
 * approach; here the value is the confidence gate, not the retrieval.)
 */
export function suggestSops(
  brief: DeliveryBrief,
  corpus: Sop[],
  opts: SuggestSopsOptions = {},
): SopSuggestion[] {
  const minScore = opts.minScore ?? 0.18;
  const limit = opts.limit ?? 3;
  const briefTokens = new Set(tokenize(briefText(brief)));
  if (briefTokens.size === 0) return [];

  const scored: SopSuggestion[] = corpus.map((sop) => {
    const kw = sop.keywords.map((k) => k.toLowerCase());
    if (kw.length === 0) return { sop, score: 0 };
    const hits = kw.filter((k) => briefTokens.has(k)).length;
    return { sop, score: hits / kw.length };
  });

  return scored
    .filter((s) => s.score >= minScore)
    .sort((a, b) => b.score - a.score || a.sop.id.localeCompare(b.sop.id))
    .slice(0, limit);
}

export function renderSopComment(suggestions: SopSuggestion[]): string {
  const lines = ["Suggested SOPs for this ticket:"];
  for (const s of suggestions) {
    lines.push(`- [${s.sop.title}](${s.sop.url}) (${Math.round(s.score * 100)}% match)`);
  }
  return lines.join("\n");
}
