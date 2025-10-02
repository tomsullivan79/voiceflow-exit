import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

// IMPORTANT: import the real module so we test the actual resolver & safety prepend.
import { getAgentInstructions } from "@/lib/tools/agentInstructions";

// Utility: minimal Bus with overlays we’ll vary
const baseBus = {
  mode: "triage",
  overlays: { tone_overlay: "supportive", playbook: "onsite_help" },
  org: { site_code: "WRCMN", timezone: "America/Chicago" },
  caller: { county: "Hennepin County" },
};

test("resolves most-specific agent file by mode+playbook+tone", async () => {
  const bus = { ...baseBus, mode: "triage", overlays: { tone_overlay: "supportive", playbook: "onsite_help" } };
  const out = await getAgentInstructions(bus);
  // This file was added in 20A; it must win for triage+onsite_help+supportive
  assert.equal(out?.sourcePath, "agent/triage.onsite_help.supportive.md");
  assert.ok(out?.content && out.content.includes("Agent behavior — triage (onsite help, supportive)"));
});

test("global _safety.md is prepended before the agent file", async () => {
  // Use after_hours_support files added in 20C for a different mode to ensure prepend is generic
  const bus = { ...baseBus, mode: "referral", overlays: { tone_overlay: "supportive", playbook: "after_hours_support" } };
  const out = await getAgentInstructions(bus);
  assert.equal(out?.sourcePath, "agent/referral.after_hours_support.supportive.md");
  // First section should be the global safety header
  assert.ok(out?.content && out.content.trimStart().startsWith("### Agent safety — do / don't (global)"),
    "Expected _safety.md header to be the first section of the combined content");
  // And the referral after-hours section should also be present
  assert.ok(out?.content && out.content.includes("Agent behavior — referral (after-hours support, supportive)"));
});
