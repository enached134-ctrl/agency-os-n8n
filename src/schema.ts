import { z } from "zod";

/**
 * The canonical, typed contract for a delivery brief produced from an
 * unstructured agency input (a meeting transcript or a Slack thread).
 *
 * The whole reliability story of this project hinges on this schema: the LLM
 * is forced to emit JSON that conforms to it, the output is validated, and a
 * repair loop re-asks Claude with the validation errors until it conforms.
 */

export const ActionItem = z.object({
  task: z.string().min(1, "action item task must not be empty"),
  owner: z.string().min(1).nullable(),
  /** ISO-8601 date (YYYY-MM-DD) or null when the source did not state one. */
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "dueDate must be YYYY-MM-DD")
    .nullable(),
});
export type ActionItem = z.infer<typeof ActionItem>;

export const DeliveryBrief = z.object({
  /** Client / account the work belongs to. */
  client: z.string().min(1, "client is required"),
  /** Short ticket-style title. */
  title: z.string().min(1, "title is required").max(140),
  /** 1-3 sentence narrative summary of what was agreed. */
  summary: z.string().min(1, "summary is required"),
  /** Primary owner of the deliverable, or null if unassigned. */
  owner: z.string().min(1).nullable(),
  /** Headline due date for the deliverable (YYYY-MM-DD) or null. */
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "dueDate must be YYYY-MM-DD")
    .nullable(),
  /** Bulleted scope of work. */
  scope: z.array(z.string().min(1)).default([]),
  /** Concrete, assignable action items. */
  actionItems: z.array(ActionItem).default([]),
  /** Risks / blockers surfaced in the conversation. */
  risks: z.array(z.string().min(1)).default([]),
  /** Verbatim source snippets the brief was grounded in (for traceability). */
  sourceRefs: z.array(z.string().min(1)).default([]),
});
export type DeliveryBrief = z.infer<typeof DeliveryBrief>;

/**
 * Hand-authored JSON Schema mirroring {@link DeliveryBrief}, passed to Claude
 * as the `input_schema` of a forced tool call so the model emits conformant
 * JSON in the first place. Kept in sync with the Zod schema by the
 * `schema.test.ts` round-trip test.
 */
export const briefInputSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    client: { type: "string", description: "Client / account name the work belongs to." },
    title: { type: "string", description: "Short ticket-style title (<=140 chars)." },
    summary: { type: "string", description: "1-3 sentence summary of what was agreed." },
    owner: { type: ["string", "null"], description: "Primary owner, or null if unassigned." },
    dueDate: {
      type: ["string", "null"],
      description: "Headline due date as YYYY-MM-DD, or null if none stated.",
    },
    scope: { type: "array", items: { type: "string" }, description: "Bulleted scope of work." },
    actionItems: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          task: { type: "string" },
          owner: { type: ["string", "null"] },
          dueDate: { type: ["string", "null"], description: "YYYY-MM-DD or null." },
        },
        required: ["task", "owner", "dueDate"],
      },
    },
    risks: { type: "array", items: { type: "string" } },
    sourceRefs: {
      type: "array",
      items: { type: "string" },
      description: "Verbatim source snippets the brief is grounded in.",
    },
  },
  required: ["client", "title", "summary", "owner", "dueDate", "scope", "actionItems", "risks", "sourceRefs"],
} as const;
