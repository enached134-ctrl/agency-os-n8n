import { createHash } from "node:crypto";
import type { DeliveryBrief } from "./schema";

export interface Ticket {
  id: string;
  url: string;
}

export interface CreateTaskInput {
  name: string;
  markdownDescription: string;
  /** A stable client-supplied key used to make creation idempotent. */
  idempotencyKey: string;
  dueDate?: string | null;
}

export interface ClickUpClient {
  createTask(input: CreateTaskInput): Promise<Ticket>;
  addComment(taskId: string, comment: string): Promise<void>;
}

/** Render a brief into ClickUp-friendly markdown. */
export function renderBriefMarkdown(brief: DeliveryBrief): string {
  const lines: string[] = [];
  lines.push(brief.summary, "");
  if (brief.owner) lines.push(`**Owner:** ${brief.owner}`);
  if (brief.dueDate) lines.push(`**Due:** ${brief.dueDate}`);
  if (brief.scope.length) {
    lines.push("", "**Scope**");
    for (const s of brief.scope) lines.push(`- ${s}`);
  }
  if (brief.actionItems.length) {
    lines.push("", "**Action items**");
    for (const a of brief.actionItems) {
      const meta = [a.owner ? `@${a.owner}` : null, a.dueDate ? `due ${a.dueDate}` : null]
        .filter(Boolean)
        .join(", ");
      lines.push(`- [ ] ${a.task}${meta ? ` (${meta})` : ""}`);
    }
  }
  if (brief.risks.length) {
    lines.push("", "**Risks**");
    for (const r of brief.risks) lines.push(`- ${r}`);
  }
  return lines.join("\n");
}

/**
 * Offline ClickUp client used by the demo and tests. Returns deterministic ids
 * derived from the idempotency key, so the same input always yields the same
 * "ticket" — which lets us assert idempotent behaviour without a network.
 */
export class DryRunClickUpClient implements ClickUpClient {
  readonly created: Array<CreateTaskInput & { id: string }> = [];
  readonly comments: Array<{ taskId: string; comment: string }> = [];

  async createTask(input: CreateTaskInput): Promise<Ticket> {
    const id = `DRY-${createHash("sha1").update(input.idempotencyKey).digest("hex").slice(0, 8)}`;
    this.created.push({ ...input, id });
    return { id, url: `https://app.clickup.com/t/${id}` };
  }

  async addComment(taskId: string, comment: string): Promise<void> {
    this.comments.push({ taskId, comment });
  }
}

export interface HttpClickUpOptions {
  apiToken?: string;
  listId?: string;
  fetchImpl?: typeof fetch;
}

/** Real ClickUp client (REST v2). */
export class HttpClickUpClient implements ClickUpClient {
  private readonly token: string;
  private readonly listId: string;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: HttpClickUpOptions = {}) {
    const token = opts.apiToken ?? process.env.CLICKUP_API_TOKEN;
    const listId = opts.listId ?? process.env.CLICKUP_LIST_ID;
    if (!token) throw new Error("CLICKUP_API_TOKEN is required for HttpClickUpClient");
    if (!listId) throw new Error("CLICKUP_LIST_ID is required for HttpClickUpClient");
    this.token = token;
    this.listId = listId;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  async createTask(input: CreateTaskInput): Promise<Ticket> {
    const res = await this.fetchImpl(`https://api.clickup.com/api/v2/list/${this.listId}/task`, {
      method: "POST",
      headers: { Authorization: this.token, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: input.name,
        markdown_description: input.markdownDescription,
        due_date: input.dueDate ? Date.parse(`${input.dueDate}T00:00:00Z`) : undefined,
        // Dedup is enforced upstream by the idempotency store (see pipeline.ts);
        // ClickUp is intentionally NOT given the key here. To add a server-side
        // guard, set a deterministic external_id custom field to
        // input.idempotencyKey and query/dedupe on it.
      }),
    });
    if (!res.ok) {
      throw new Error(`ClickUp createTask failed: ${res.status} ${await res.text()}`);
    }
    const body = (await res.json()) as { id: string; url: string };
    return { id: body.id, url: body.url };
  }

  async addComment(taskId: string, comment: string): Promise<void> {
    const res = await this.fetchImpl(`https://api.clickup.com/api/v2/task/${taskId}/comment`, {
      method: "POST",
      headers: { Authorization: this.token, "Content-Type": "application/json" },
      body: JSON.stringify({ comment_text: comment }),
    });
    if (!res.ok) {
      throw new Error(`ClickUp addComment failed: ${res.status} ${await res.text()}`);
    }
  }
}
