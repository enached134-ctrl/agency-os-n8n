/**
 * Deterministic, auditable delivery-health scoring.
 *
 * Design rule that matters for a portfolio piece: the LLM is kept OUT of the
 * scoring path. The status is computed by transparent, unit-tested rules so the
 * rating is reproducible and explainable; an LLM only narrates the result
 * elsewhere. Same input -> same status, every time.
 */

export interface AccountSignals {
  client: string;
  /** Tasks past their due date. */
  overdueTasks: number;
  /** Tickets with no movement in N days. */
  stalledTickets: number;
  /** Average first-response time to client messages, in hours. */
  avgResponseHours: number;
  /** Open risks flagged on briefs. */
  openRisks: number;
}

export type HealthStatus = "green" | "amber" | "red";

export interface HealthResult {
  client: string;
  status: HealthStatus;
  /** 0 (healthy) .. 100 (critical) penalty score. */
  score: number;
  reasons: string[];
}

/** Weights are explicit and tunable; kept here so the rules are auditable. */
export const HEALTH_WEIGHTS = {
  overdueTask: 12,
  stalledTicket: 8,
  responseHourOver24: 1.5,
  openRisk: 6,
} as const;

export const HEALTH_THRESHOLDS = { amber: 15, red: 35 } as const;

export function scoreAccount(signals: AccountSignals): HealthResult {
  const reasons: string[] = [];
  let score = 0;

  if (signals.overdueTasks > 0) {
    const p = signals.overdueTasks * HEALTH_WEIGHTS.overdueTask;
    score += p;
    reasons.push(`${signals.overdueTasks} overdue task(s) (+${p})`);
  }
  if (signals.stalledTickets > 0) {
    const p = signals.stalledTickets * HEALTH_WEIGHTS.stalledTicket;
    score += p;
    reasons.push(`${signals.stalledTickets} stalled ticket(s) (+${p})`);
  }
  const slowHours = Math.max(0, signals.avgResponseHours - 24);
  if (slowHours > 0) {
    const p = Math.round(slowHours * HEALTH_WEIGHTS.responseHourOver24 * 10) / 10;
    score += p;
    reasons.push(`avg response ${signals.avgResponseHours}h (+${p})`);
  }
  if (signals.openRisks > 0) {
    const p = signals.openRisks * HEALTH_WEIGHTS.openRisk;
    score += p;
    reasons.push(`${signals.openRisks} open risk(s) (+${p})`);
  }

  score = Math.round(score * 10) / 10;
  const status: HealthStatus =
    score >= HEALTH_THRESHOLDS.red ? "red" : score >= HEALTH_THRESHOLDS.amber ? "amber" : "green";
  if (reasons.length === 0) reasons.push("no negative signals");

  return { client: signals.client, status, score, reasons };
}

export function scoreAccounts(signals: AccountSignals[]): HealthResult[] {
  return signals.map(scoreAccount).sort((a, b) => b.score - a.score);
}
