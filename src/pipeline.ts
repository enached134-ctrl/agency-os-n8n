import { extractBrief } from "./extract";
import { idempotencyKey, type IdempotencyStore } from "./idempotency";
import { renderBriefMarkdown, type ClickUpClient, type Ticket } from "./clickup";
import { suggestSops, renderSopComment, type Sop, type SopSuggestion } from "./sop";
import type { BriefLLM } from "./llm";
import type { DeliveryBrief } from "./schema";
import type { StateStore } from "./state";

export interface IngestEvent {
  source: "slack" | "transcript" | string;
  /** Stable id of the source event (Slack message ts, file hash, etc.). */
  eventId: string;
  client?: string;
  text: string;
}

export interface PipelineDeps {
  llm: BriefLLM;
  clickup: ClickUpClient;
  idempotency: IdempotencyStore;
  state?: StateStore;
  sopCorpus?: Sop[];
  maxAttempts?: number;
}

export interface PipelineResult {
  /** True when the event had already been processed and creation was skipped. */
  idempotent: boolean;
  ticket: Ticket;
  brief?: DeliveryBrief;
  sops: SopSuggestion[];
  attempts: number;
}

/**
 * End-to-end: ingest event -> idempotency guard -> extract+validate brief ->
 * create ClickUp ticket -> attach SOP suggestions -> persist state.
 *
 * The idempotency guard is the headline reliability property: a replayed event
 * (Slack retries, n8n re-runs) returns the already-created ticket instead of
 * creating a duplicate.
 */
export async function runBriefPipeline(event: IngestEvent, deps: PipelineDeps): Promise<PipelineResult> {
  const key = idempotencyKey(event.source, event.eventId);

  const existing = await deps.idempotency.get(key);
  if (existing) {
    return {
      idempotent: true,
      ticket: { id: existing, url: `https://app.clickup.com/t/${existing}` },
      sops: [],
      attempts: 0,
    };
  }

  await deps.state?.upsertJob({ idempotencyKey: key, source: event.source, eventId: event.eventId, client: event.client ?? null });
  await deps.state?.setStatus(key, "extracting");

  let brief: DeliveryBrief;
  let attempts: number;
  try {
    ({ brief, attempts } = await extractBrief(deps.llm, event.text, {
      client: event.client,
      maxAttempts: deps.maxAttempts,
    }));
  } catch (err) {
    await deps.state?.setStatus(key, "failed");
    throw err;
  }

  const sops = suggestSops(brief, deps.sopCorpus ?? []);

  const ticket = await deps.clickup.createTask({
    name: `[${brief.client}] ${brief.title}`,
    markdownDescription: renderBriefMarkdown(brief),
    idempotencyKey: key,
    dueDate: brief.dueDate,
  });

  // Record the mapping IMMEDIATELY after creating the ticket and before any
  // further side effect. set() returns the winning id: if a concurrent replay
  // beat us to it, reconcile to that ticket rather than leaking our duplicate.
  const winnerId = await deps.idempotency.set(key, ticket.id);
  if (winnerId !== ticket.id) {
    await deps.state?.setStatus(key, "pushed", winnerId);
    return {
      idempotent: true,
      ticket: { id: winnerId, url: `https://app.clickup.com/t/${winnerId}` },
      brief,
      sops,
      attempts,
    };
  }

  // SOP attachment is non-critical: a comment failure must never strand the
  // already-created-and-recorded ticket (a thrown error here would otherwise
  // skip the recording above on older code and cause a duplicate on retry).
  if (sops.length > 0) {
    try {
      await deps.clickup.addComment(ticket.id, renderSopComment(sops));
    } catch {
      // Swallow: the ticket exists and is recorded; the comment can be reconciled later.
    }
  }

  await deps.state?.setStatus(key, "pushed", ticket.id);
  return { idempotent: false, ticket, brief, sops, attempts };
}
