import { describe, it, expect } from "vitest";
import { extractBrief, BriefValidationError } from "../src/extract";
import { ReplayBriefLLM } from "../src/llm";
import { cases } from "../evals/fixtures/cases";

const valid = cases[0].recorded;

function invalid(): Record<string, unknown> {
  const bad: Record<string, unknown> = JSON.parse(JSON.stringify(valid));
  delete bad.title; // required -> fails validation
  return bad;
}

describe("extractBrief (validate + repair loop)", () => {
  it("returns on the first valid response", async () => {
    const llm = new ReplayBriefLLM([valid]);
    const { brief, attempts } = await extractBrief(llm, "transcript");
    expect(attempts).toBe(1);
    expect(brief.client).toBe("Lumen Cosmetics");
    expect(llm.calls).toBe(1);
  });

  it("repairs after an invalid response, then succeeds", async () => {
    const llm = new ReplayBriefLLM([invalid(), valid]);
    const { attempts } = await extractBrief(llm, "transcript", { maxAttempts: 3 });
    expect(attempts).toBe(2);
    expect(llm.calls).toBe(2);
  });

  it("throws BriefValidationError after exhausting attempts", async () => {
    const llm = new ReplayBriefLLM([invalid(), invalid(), invalid()]);
    await expect(extractBrief(llm, "transcript", { maxAttempts: 3 })).rejects.toBeInstanceOf(
      BriefValidationError,
    );
  });

  it("reports the attempt count on failure", async () => {
    const llm = new ReplayBriefLLM([invalid()]);
    try {
      await extractBrief(llm, "transcript", { maxAttempts: 2 });
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(BriefValidationError);
      expect((err as BriefValidationError).attempts).toBe(2);
    }
  });
});
