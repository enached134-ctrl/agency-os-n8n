import { describe, it, expect } from "vitest";
import { runBriefPipeline, type IngestEvent, type PipelineDeps } from "../src/pipeline";
import { ReplayBriefLLM } from "../src/llm";
import { DryRunClickUpClient } from "../src/clickup";
import { InMemoryIdempotencyStore } from "../src/idempotency";
import { InMemoryStateStore } from "../src/state";
import { cases } from "../evals/fixtures/cases";
import { sopCorpus } from "../evals/fixtures/sops";

function makeDeps(): { deps: PipelineDeps; clickup: DryRunClickUpClient; state: InMemoryStateStore } {
  const clickup = new DryRunClickUpClient();
  const state = new InMemoryStateStore();
  const deps: PipelineDeps = {
    llm: new ReplayBriefLLM([cases[0].recorded]),
    clickup,
    idempotency: new InMemoryIdempotencyStore(),
    state,
    sopCorpus,
  };
  return { deps, clickup, state };
}

const event: IngestEvent = {
  source: "slack",
  eventId: cases[0].eventId,
  client: cases[0].expected.client,
  text: cases[0].transcript,
};

describe("runBriefPipeline", () => {
  it("creates a ticket, attaches SOPs and records state on first run", async () => {
    const { deps, clickup, state } = makeDeps();
    const res = await runBriefPipeline(event, deps);
    expect(res.idempotent).toBe(false);
    expect(res.ticket.id).toMatch(/^DRY-/);
    expect(res.sops.length).toBeGreaterThan(0);
    expect(clickup.created.length).toBe(1);
    expect(clickup.comments.length).toBe(1);
    const job = await state.getJob(Object.keys(Object.fromEntries(state.jobs))[0]);
    expect(job?.status).toBe("pushed");
  });

  it("does not create a duplicate when the same event is replayed", async () => {
    const { deps, clickup } = makeDeps();
    const first = await runBriefPipeline(event, deps);
    const second = await runBriefPipeline(event, deps);
    expect(second.idempotent).toBe(true);
    expect(second.ticket.id).toBe(first.ticket.id);
    expect(clickup.created.length).toBe(1);
  });

  it("creates a separate ticket for a different event", async () => {
    const { deps, clickup } = makeDeps();
    await runBriefPipeline(event, deps);
    await runBriefPipeline({ ...event, eventId: "slack-999.0001" }, deps);
    expect(clickup.created.length).toBe(2);
  });

  it("does not strand or duplicate the ticket when the SOP comment fails", async () => {
    const created: string[] = [];
    const flakyClickup = {
      async createTask(input: { idempotencyKey: string }) {
        const id = `T-${created.length}`;
        created.push(id);
        return { id, url: `https://app.clickup.com/t/${id}` };
      },
      async addComment() {
        throw new Error("ClickUp 500 while adding SOP comment");
      },
    };
    const idempotency = new InMemoryIdempotencyStore();
    const deps = {
      llm: new ReplayBriefLLM([cases[0].recorded]),
      clickup: flakyClickup as unknown as PipelineDeps["clickup"],
      idempotency,
      sopCorpus,
    };

    const first = await runBriefPipeline(event, deps);
    expect(first.idempotent).toBe(false);
    expect(created.length).toBe(1); // ticket created despite the comment failure

    const second = await runBriefPipeline(event, deps);
    expect(second.idempotent).toBe(true); // replay recognizes the recorded ticket
    expect(created.length).toBe(1); // and never creates a duplicate
  });
});
