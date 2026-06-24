import type { Sop } from "../../src/sop";

/** Synthetic SOP knowledge base used by the demo and the SOP tests. */
export const sopCorpus: Sop[] = [
  {
    id: "sop-lp-qa",
    title: "Landing Page QA Checklist",
    url: "https://sop.agency/landing-page-qa",
    keywords: ["landing", "page", "hero", "grid", "mockups", "design", "responsive"],
  },
  {
    id: "sop-onboarding",
    title: "New Client Onboarding Runbook",
    url: "https://sop.agency/onboarding",
    keywords: ["onboarding", "access", "drive", "reporting", "dashboard", "intake", "setup"],
  },
  {
    id: "sop-incident",
    title: "Production Incident Response",
    url: "https://sop.agency/incident-response",
    keywords: ["incident", "checkout", "monitoring", "rollback", "severity", "outage", "alerting"],
  },
  {
    id: "sop-copy-brief",
    title: "Copywriting Brief Template",
    url: "https://sop.agency/copy-brief",
    keywords: ["copy", "brief", "messaging", "tone", "voice"],
  },
];
