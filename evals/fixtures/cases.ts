import type { DeliveryBrief } from "../../src/schema";

/**
 * Eval fixtures. Each case carries:
 *  - `transcript`: the raw input
 *  - `expected`: gold fields the extractor should capture (used by the scorer)
 *  - `recorded`: a recorded Claude response, replayed when ANTHROPIC_API_KEY is
 *    unset so CI/evals are fully hermetic. With a key set, the live model runs
 *    instead and is scored against the same gold fields.
 */
export interface EvalCase {
  id: string;
  eventId: string;
  transcript: string;
  expected: {
    client: string;
    owner: string | null;
    dueDate: string | null;
    scope: string[];
    actionItems: string[];
  };
  recorded: DeliveryBrief;
}

export const cases: EvalCase[] = [
  {
    id: "kickoff-lumen",
    eventId: "slack-1719050400.0001",
    transcript: [
      "Meeting date: 2026-06-22. Attendees: Ana (account lead), Marius (design).",
      "Client: Lumen Cosmetics.",
      "Ana: Lumen wants the summer campaign landing page redesigned. Scope is the hero section, a new product grid, and an email capture popup.",
      "Marius: I'll own the design. First mockups by 2026-07-03.",
      "Ana: Action item - Marius delivers hero + grid mockups by 2026-07-03. I'll write the copy brief by 2026-06-27.",
      "Marius: One risk - we still don't have the final product photos from the client, that could block the grid.",
    ].join("\n"),
    expected: {
      client: "Lumen Cosmetics",
      owner: "Marius",
      dueDate: "2026-07-03",
      scope: ["hero section", "product grid", "email capture popup"],
      actionItems: ["hero and grid mockups", "copy brief"],
    },
    recorded: {
      client: "Lumen Cosmetics",
      title: "Summer campaign landing page redesign",
      summary:
        "Redesign Lumen's summer campaign landing page with a new hero section, product grid, and email capture popup. Marius owns the design with first mockups due 2026-07-03.",
      owner: "Marius",
      dueDate: "2026-07-03",
      scope: ["Hero section redesign", "New product grid", "Email capture popup"],
      actionItems: [
        { task: "Deliver hero and grid mockups", owner: "Marius", dueDate: "2026-07-03" },
        { task: "Write the copy brief", owner: "Ana", dueDate: "2026-06-27" },
      ],
      risks: ["Final product photos not yet received from the client; may block the product grid."],
      sourceRefs: [
        "Scope is the hero section, a new product grid, and an email capture popup",
        "Marius delivers hero + grid mockups by 2026-07-03",
      ],
    },
  },
  {
    id: "onboarding-northwind",
    eventId: "slack-1719054000.0007",
    transcript: [
      "Slack thread #accounts. Client: Northwind Logistics (new).",
      "Ioana: Kicking off Northwind onboarding. I'll own it.",
      "Ioana: We need to set up their shared Drive access, build the monthly reporting dashboard, and run a brand guidelines intake.",
      "Dan: No hard deadline yet, client is still finalizing their team.",
    ].join("\n"),
    expected: {
      client: "Northwind Logistics",
      owner: "Ioana",
      dueDate: null,
      scope: ["shared drive access", "reporting dashboard", "brand guidelines intake"],
      actionItems: ["set up drive access", "build reporting dashboard"],
    },
    recorded: {
      client: "Northwind Logistics",
      title: "Northwind Logistics onboarding",
      summary:
        "Onboard new client Northwind Logistics: set up shared Drive access and build the monthly reporting dashboard. Ioana owns it; no hard deadline yet.",
      owner: "Ioana",
      dueDate: null,
      // Intentionally omits "brand guidelines intake" so scope recall is < 1.0,
      // demonstrating the scorer measures real partial capture (not a rigged 100%).
      scope: ["Shared Drive access setup", "Monthly reporting dashboard"],
      actionItems: [
        { task: "Set up shared Drive access", owner: "Ioana", dueDate: null },
        { task: "Build the monthly reporting dashboard", owner: "Ioana", dueDate: null },
      ],
      risks: ["Client team not finalized; scope may shift."],
      sourceRefs: ["set up their shared Drive access, build the monthly reporting dashboard"],
    },
  },
  {
    id: "incident-acme",
    eventId: "slack-1719057600.0042",
    transcript: [
      "Meeting date: 2026-06-24. Client: Acme Retail.",
      "Paul: Acme's checkout is throwing errors on mobile, they're losing sales. This is urgent.",
      "Paul: I'll own the fix. Scope: fix the checkout bug and add monitoring so we catch it next time.",
      "Lead: Need this resolved by 2026-06-25.",
      "Paul: Risk - if it's a payment-provider issue we may need their support, which slows us down.",
    ].join("\n"),
    expected: {
      client: "Acme Retail",
      owner: "Paul",
      dueDate: "2026-06-25",
      scope: ["fix checkout bug", "add monitoring"],
      actionItems: ["fix checkout bug", "add monitoring"],
    },
    recorded: {
      client: "Acme Retail",
      title: "Fix mobile checkout errors + add monitoring",
      summary:
        "Acme Retail's mobile checkout is erroring and losing sales. Paul owns the fix: resolve the checkout bug and add monitoring, due 2026-06-25.",
      owner: "Paul",
      dueDate: "2026-06-25",
      scope: ["Fix the mobile checkout bug", "Add monitoring/alerting for checkout"],
      actionItems: [
        { task: "Fix the checkout bug", owner: "Paul", dueDate: "2026-06-25" },
        { task: "Add monitoring for checkout", owner: "Paul", dueDate: "2026-06-25" },
      ],
      risks: ["May depend on the payment provider's support, which could slow resolution."],
      sourceRefs: ["fix the checkout bug and add monitoring", "resolved by 2026-06-25"],
    },
  },
];
