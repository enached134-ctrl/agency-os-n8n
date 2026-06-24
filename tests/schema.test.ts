import { describe, it, expect } from "vitest";
import { DeliveryBrief, briefInputSchema } from "../src/schema";
import { cases } from "../evals/fixtures/cases";

describe("DeliveryBrief schema", () => {
  it("parses a valid recorded brief", () => {
    const res = DeliveryBrief.safeParse(cases[0].recorded);
    expect(res.success).toBe(true);
  });

  it("rejects a brief missing a required field", () => {
    const bad: Record<string, unknown> = { ...cases[0].recorded };
    delete bad.client;
    expect(DeliveryBrief.safeParse(bad).success).toBe(false);
  });

  it("rejects an action item with a malformed due date", () => {
    const bad = {
      ...cases[0].recorded,
      actionItems: [{ task: "x", owner: null, dueDate: "07/03/2026" }],
    };
    expect(DeliveryBrief.safeParse(bad).success).toBe(false);
  });

  it("keeps the JSON Schema (sent to Claude) in sync with the Zod schema", () => {
    const zodKeys = Object.keys(DeliveryBrief.shape).sort();
    const jsonRequired = [...briefInputSchema.required].sort();
    const jsonProps = Object.keys(briefInputSchema.properties).sort();
    expect(jsonRequired).toEqual(zodKeys);
    expect(jsonProps).toEqual(zodKeys);
  });
});
