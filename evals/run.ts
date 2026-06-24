/**
 * Extraction eval harness.
 *
 * Scores how well the extractor captures the gold fields (client, owner, due
 * date, scope, action items) across the fixture set. Runs hermetically against
 * recorded responses when ANTHROPIC_API_KEY is unset, or against the live model
 * when it is set. Exits non-zero if the mean score drops below THRESHOLD, so it
 * doubles as a CI regression gate.
 */
import { cases, type EvalCase } from "./fixtures/cases";
import { extractBrief } from "../src/extract";
import { AnthropicBriefLLM, ReplayBriefLLM, type BriefLLM } from "../src/llm";
import type { DeliveryBrief } from "../src/schema";

const THRESHOLD = 0.8;

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3);
}

function phraseCovered(phrase: string, hay: Set<string>): boolean {
  const pt = tokenize(phrase);
  if (pt.length === 0) return false;
  const hits = pt.filter((t) => hay.has(t)).length;
  return hits / pt.length >= 0.5;
}

function recall(expected: string[], actualText: string): number {
  if (expected.length === 0) return 1;
  const hay = new Set(tokenize(actualText));
  const covered = expected.filter((e) => phraseCovered(e, hay)).length;
  return covered / expected.length;
}

function eq(a: string | null, b: string | null): number {
  if (a === null && b === null) return 1;
  if (a === null || b === null) return 0;
  return a.toLowerCase().includes(b.toLowerCase()) || b.toLowerCase().includes(a.toLowerCase()) ? 1 : 0;
}

interface Scored {
  id: string;
  client: number;
  owner: number;
  due: number;
  scope: number;
  actions: number;
  overall: number;
}

function scoreCase(c: EvalCase, brief: DeliveryBrief): Scored {
  const client = eq(brief.client, c.expected.client);
  const owner = eq(brief.owner, c.expected.owner);
  const due = eq(brief.dueDate, c.expected.dueDate);
  const scope = recall(c.expected.scope, brief.scope.join(" "));
  const actions = recall(c.expected.actionItems, brief.actionItems.map((a) => a.task).join(" "));
  const overall = (client + owner + due + scope + actions) / 5;
  return { id: c.id, client, owner, due, scope, actions, overall };
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`.padStart(4);
}

async function main(): Promise<void> {
  const live = Boolean(process.env.ANTHROPIC_API_KEY);
  console.log(`\nAgency-OS extraction eval  (mode: ${live ? "LIVE Claude" : "REPLAY fixtures"})\n`);

  const rows: Scored[] = [];
  for (const c of cases) {
    const llm: BriefLLM = live ? new AnthropicBriefLLM() : new ReplayBriefLLM([c.recorded]);
    const { brief } = await extractBrief(llm, c.transcript, { client: c.expected.client });
    rows.push(scoreCase(c, brief));
  }

  console.log("case                 client owner  due  scope action  overall");
  console.log("-".repeat(64));
  for (const r of rows) {
    console.log(
      `${r.id.padEnd(20)} ${pct(r.client)} ${pct(r.owner)} ${pct(r.due)} ${pct(r.scope)} ${pct(r.actions)}   ${pct(r.overall)}`,
    );
  }
  const mean = rows.reduce((s, r) => s + r.overall, 0) / rows.length;
  console.log("-".repeat(64));
  console.log(`mean extraction score: ${pct(mean)}  (threshold ${pct(THRESHOLD)})\n`);

  if (mean < THRESHOLD) {
    console.error(`FAIL: mean score ${pct(mean)} below threshold ${pct(THRESHOLD)}`);
    process.exit(1);
  }
  console.log("PASS");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
