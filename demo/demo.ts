/**
 * Offline, end-to-end demo. No external services required.
 *
 *   npm run demo
 *
 * Shows: transcript -> validated brief -> ClickUp ticket (dry-run) -> SOP
 * suggestions, then REPLAYS the same event to prove the idempotency guard skips
 * the duplicate, then renders the deterministic traffic-light report.
 *
 * Set ANTHROPIC_API_KEY to run the extraction against the live Claude model.
 */
import { runBriefPipeline, type IngestEvent } from "../src/pipeline";
import { AnthropicBriefLLM, ReplayBriefLLM, type BriefLLM } from "../src/llm";
import { DryRunClickUpClient } from "../src/clickup";
import { InMemoryIdempotencyStore } from "../src/idempotency";
import { InMemoryStateStore } from "../src/state";
import { scoreAccounts, type AccountSignals } from "../src/trafficLight";
import { cases } from "../evals/fixtures/cases";
import { sopCorpus } from "../evals/fixtures/sops";

const STATUS_DOT: Record<string, string> = { green: "[GREEN]", amber: "[AMBER]", red: "[ RED ]" };

async function main(): Promise<void> {
  const demoCase = cases[0];
  const live = Boolean(process.env.ANTHROPIC_API_KEY);
  const llm: BriefLLM = live ? new AnthropicBriefLLM() : new ReplayBriefLLM([demoCase.recorded]);

  const clickup = new DryRunClickUpClient();
  const deps = {
    llm,
    clickup,
    idempotency: new InMemoryIdempotencyStore(),
    state: new InMemoryStateStore(),
    sopCorpus,
  };

  const event: IngestEvent = {
    source: "slack",
    eventId: demoCase.eventId,
    client: demoCase.expected.client,
    text: demoCase.transcript,
  };

  console.log(`\n=== Agency OS demo  (mode: ${live ? "LIVE Claude" : "REPLAY fixture"}) ===\n`);
  console.log("Inbound event:", event.source, event.eventId, "\n");

  const first = await runBriefPipeline(event, deps);
  console.log("--- Extracted & validated brief ---");
  console.log(JSON.stringify(first.brief, null, 2));
  console.log(`\nValidated in ${first.attempts} attempt(s).`);
  console.log(`\nClickUp ticket created: ${first.ticket.id}  ${first.ticket.url}`);
  console.log("SOP suggestions:");
  for (const s of first.sops) console.log(`  - ${s.sop.title} (${Math.round(s.score * 100)}% match)`);

  console.log("\n--- Replaying the SAME event (Slack retry / n8n re-run) ---");
  const second = await runBriefPipeline(event, deps);
  console.log(`idempotent: ${second.idempotent}  ->  ticket ${second.ticket.id}`);
  console.log(`ClickUp tasks actually created: ${clickup.created.length}  (expected: 1 — no duplicate)`);
  if (clickup.created.length !== 1 || !second.idempotent) {
    console.error("DEMO FAILED: idempotency guard did not hold");
    process.exit(1);
  }

  console.log("\n--- Weekly delivery-health (deterministic scoring) ---");
  const signals: AccountSignals[] = [
    { client: "Lumen Cosmetics", overdueTasks: 0, stalledTickets: 1, avgResponseHours: 30, openRisks: 1 },
    { client: "Acme Retail", overdueTasks: 3, stalledTickets: 2, avgResponseHours: 40, openRisks: 1 },
    { client: "Northwind Logistics", overdueTasks: 0, stalledTickets: 0, avgResponseHours: 12, openRisks: 0 },
  ];
  for (const r of scoreAccounts(signals)) {
    console.log(`  ${STATUS_DOT[r.status]} ${r.client.padEnd(22)} score ${r.score}  (${r.reasons.join("; ")})`);
  }

  console.log("\nDone.\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
