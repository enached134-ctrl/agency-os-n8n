import { createHash } from "node:crypto";
import type { Pool } from "pg";

/**
 * Deterministic idempotency key for an inbound event. The same source + event
 * id always yields the same key, so a replayed Slack delivery (Slack retries
 * webhooks aggressively) never creates a second ClickUp ticket.
 */
export function idempotencyKey(source: string, eventId: string): string {
  // Hash an unambiguous serialization of the components so that distinct
  // (source, eventId) pairs can never collide via a shared delimiter character.
  return createHash("sha256").update(JSON.stringify([source, eventId])).digest("hex");
}

/**
 * Records which external object (e.g. a ClickUp task id) an idempotency key has
 * already produced. `get` returns the existing id if the key was already
 * processed, letting callers short-circuit instead of creating a duplicate.
 */
export interface IdempotencyStore {
  get(key: string): Promise<string | null>;
  /**
   * Atomically record the mapping and return the WINNING external id: the value
   * already stored if the key existed (this caller lost a race), otherwise the
   * value just stored. Returning the winner lets the pipeline reconcile a
   * concurrent double-fire instead of leaking a duplicate.
   */
  set(key: string, externalId: string): Promise<string>;
}

/** In-memory store for tests and the offline demo. */
export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly map = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.map.get(key) ?? null;
  }

  async set(key: string, externalId: string): Promise<string> {
    const existing = this.map.get(key);
    if (existing !== undefined) return existing;
    this.map.set(key, externalId);
    return externalId;
  }
}

/**
 * Durable, Postgres-backed idempotency store. `set` is an upsert that RETURNS
 * the winning external id (the first writer's), so the pipeline can reconcile a
 * concurrent double-fire to the canonical ticket instead of leaking a duplicate.
 */
export class PgIdempotencyStore implements IdempotencyStore {
  constructor(private readonly pool: Pool) {}

  async get(key: string): Promise<string | null> {
    const { rows } = await this.pool.query(
      "SELECT external_id FROM idempotency_keys WHERE key = $1",
      [key],
    );
    return rows.length > 0 ? (rows[0].external_id as string) : null;
  }

  async set(key: string, externalId: string): Promise<string> {
    // The no-op DO UPDATE forces the existing row to be RETURNED on conflict
    // (DO NOTHING would return no row), so we always learn the winning id.
    const { rows } = await this.pool.query(
      `INSERT INTO idempotency_keys (key, external_id) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET external_id = idempotency_keys.external_id
       RETURNING external_id`,
      [key, externalId],
    );
    return rows[0].external_id as string;
  }
}
