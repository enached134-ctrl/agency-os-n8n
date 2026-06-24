import type { Pool } from "pg";

export type JobStatus = "queued" | "extracting" | "needs_review" | "pushed" | "failed";

export interface JobRecord {
  idempotencyKey: string;
  source: string;
  eventId: string;
  client: string | null;
  status: JobStatus;
  ticketId: string | null;
}

/**
 * Durable state for the brief pipeline. The Postgres-backed implementation maps
 * onto the schema in `infra/db/init.sql`; the in-memory one backs tests/demo.
 */
export interface StateStore {
  upsertJob(job: Pick<JobRecord, "idempotencyKey" | "source" | "eventId" | "client">): Promise<void>;
  setStatus(idempotencyKey: string, status: JobStatus, ticketId?: string | null): Promise<void>;
  getJob(idempotencyKey: string): Promise<JobRecord | null>;
  recordHealth(client: string, status: string, score: number): Promise<void>;
}

export class InMemoryStateStore implements StateStore {
  readonly jobs = new Map<string, JobRecord>();
  readonly health: Array<{ client: string; status: string; score: number }> = [];

  async upsertJob(job: Pick<JobRecord, "idempotencyKey" | "source" | "eventId" | "client">): Promise<void> {
    if (!this.jobs.has(job.idempotencyKey)) {
      this.jobs.set(job.idempotencyKey, { ...job, status: "queued", ticketId: null });
    }
  }

  async setStatus(idempotencyKey: string, status: JobStatus, ticketId?: string | null): Promise<void> {
    const job = this.jobs.get(idempotencyKey);
    if (!job) return;
    job.status = status;
    if (ticketId !== undefined) job.ticketId = ticketId;
  }

  async getJob(idempotencyKey: string): Promise<JobRecord | null> {
    return this.jobs.get(idempotencyKey) ?? null;
  }

  async recordHealth(client: string, status: string, score: number): Promise<void> {
    this.health.push({ client, status, score });
  }
}

/** Postgres / Supabase-backed state store. */
export class PgStateStore implements StateStore {
  constructor(private readonly pool: Pool) {}

  async upsertJob(job: Pick<JobRecord, "idempotencyKey" | "source" | "eventId" | "client">): Promise<void> {
    await this.pool.query(
      `INSERT INTO jobs (idempotency_key, source, event_id, client, status)
       VALUES ($1, $2, $3, $4, 'queued')
       ON CONFLICT (idempotency_key) DO NOTHING`,
      [job.idempotencyKey, job.source, job.eventId, job.client],
    );
  }

  async setStatus(idempotencyKey: string, status: JobStatus, ticketId?: string | null): Promise<void> {
    await this.pool.query(
      `UPDATE jobs SET status = $2, ticket_id = COALESCE($3, ticket_id), updated_at = now()
       WHERE idempotency_key = $1`,
      [idempotencyKey, status, ticketId ?? null],
    );
  }

  async getJob(idempotencyKey: string): Promise<JobRecord | null> {
    const { rows } = await this.pool.query(
      `SELECT idempotency_key, source, event_id, client, status, ticket_id
       FROM jobs WHERE idempotency_key = $1`,
      [idempotencyKey],
    );
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      idempotencyKey: r.idempotency_key,
      source: r.source,
      eventId: r.event_id,
      client: r.client,
      status: r.status,
      ticketId: r.ticket_id,
    };
  }

  async recordHealth(client: string, status: string, score: number): Promise<void> {
    await this.pool.query(
      `INSERT INTO delivery_health (client, status, score, snapshot_at)
       VALUES ($1, $2, $3, now())`,
      [client, status, score],
    );
  }
}
