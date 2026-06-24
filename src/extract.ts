import { z } from "zod";
import { DeliveryBrief } from "./schema";
import type { BriefLLM } from "./llm";

export class BriefValidationError extends Error {
  constructor(message: string, readonly attempts: number, readonly lastIssues: string) {
    super(message);
    this.name = "BriefValidationError";
  }
}

function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`)
    .join("; ");
}

export interface ExtractResult {
  brief: DeliveryBrief;
  /** How many LLM calls it took to get a valid brief (1 = first try). */
  attempts: number;
}

export interface ExtractOptions {
  client?: string;
  /** Max LLM attempts including the first. Defaults to 3. */
  maxAttempts?: number;
}

/**
 * Extract a validated {@link DeliveryBrief} from a transcript.
 *
 * The reliability core: the LLM output is validated against the Zod schema and,
 * on failure, Claude is re-asked with the precise validation errors as feedback
 * (schema-guided repair) up to `maxAttempts` times before throwing.
 */
export async function extractBrief(
  llm: BriefLLM,
  transcript: string,
  opts: ExtractOptions = {},
): Promise<ExtractResult> {
  const maxAttempts = opts.maxAttempts ?? 3;
  if (maxAttempts < 1) throw new Error("maxAttempts must be >= 1");

  let feedback: string | undefined;
  let lastIssues = "";

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const raw = await llm.extract(transcript, { client: opts.client, feedback });
    const parsed = DeliveryBrief.safeParse(raw);
    if (parsed.success) {
      return { brief: parsed.data, attempts: attempt };
    }
    lastIssues = formatIssues(parsed.error);
    feedback = `Your previous JSON failed schema validation (${lastIssues}). Return a corrected object that matches the schema exactly.`;
  }

  throw new BriefValidationError(
    `Failed to extract a valid brief after ${maxAttempts} attempt(s).`,
    maxAttempts,
    lastIssues,
  );
}
