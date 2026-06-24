import { describe, it, expect } from "vitest";
import { scoreAccount, scoreAccounts, type AccountSignals } from "../src/trafficLight";

const clean: AccountSignals = {
  client: "Clean Co",
  overdueTasks: 0,
  stalledTickets: 0,
  avgResponseHours: 12,
  openRisks: 0,
};

describe("scoreAccount", () => {
  it("is deterministic", () => {
    expect(scoreAccount(clean)).toEqual(scoreAccount(clean));
  });

  it("is green with no negative signals", () => {
    const r = scoreAccount(clean);
    expect(r.status).toBe("green");
    expect(r.score).toBe(0);
    expect(r.reasons.length).toBeGreaterThan(0);
  });

  it("is amber for moderate trouble", () => {
    const r = scoreAccount({ ...clean, client: "Mid", stalledTickets: 1, avgResponseHours: 30 });
    expect(r.status).toBe("amber");
  });

  it("is red for heavy overdue load", () => {
    const r = scoreAccount({ ...clean, client: "Bad", overdueTasks: 3 });
    expect(r.status).toBe("red");
  });
});

describe("scoreAccounts", () => {
  it("sorts worst (highest score) first", () => {
    const out = scoreAccounts([
      clean,
      { ...clean, client: "Bad", overdueTasks: 3 },
      { ...clean, client: "Mid", stalledTickets: 1, avgResponseHours: 30 },
    ]);
    expect(out[0].client).toBe("Bad");
    expect(out[out.length - 1].client).toBe("Clean Co");
  });
});
