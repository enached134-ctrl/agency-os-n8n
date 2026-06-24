import { describe, it, expect } from "vitest";
import { suggestSops } from "../src/sop";
import { cases } from "../evals/fixtures/cases";
import { sopCorpus } from "../evals/fixtures/sops";
import type { DeliveryBrief } from "../src/schema";

describe("suggestSops", () => {
  it("suggests the landing-page SOP for a landing-page brief, best first", () => {
    const out = suggestSops(cases[0].recorded, sopCorpus);
    expect(out.length).toBeGreaterThan(0);
    expect(out[0].sop.id).toBe("sop-lp-qa");
    // sorted by descending score
    for (let i = 1; i < out.length; i += 1) {
      expect(out[i - 1].score).toBeGreaterThanOrEqual(out[i].score);
    }
  });

  it("abstains (returns nothing) when no SOP is relevant", () => {
    const unrelated: DeliveryBrief = {
      client: "X",
      title: "Quarterly tax filing paperwork",
      summary: "Submit the quarterly VAT paperwork to the accountant.",
      owner: null,
      dueDate: null,
      scope: ["collect invoices", "submit VAT return"],
      actionItems: [],
      risks: [],
      sourceRefs: [],
    };
    expect(suggestSops(unrelated, sopCorpus)).toEqual([]);
  });

  it("respects the limit", () => {
    const out = suggestSops(cases[0].recorded, sopCorpus, { limit: 1, minScore: 0 });
    expect(out.length).toBe(1);
  });
});
