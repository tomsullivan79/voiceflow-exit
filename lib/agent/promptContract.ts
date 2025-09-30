// lib/agent/promptContract.ts
import { VariableBus } from "@/types/variableBus";

export const SYSTEM_PROMPT = `
You are the WildTriage Single Agent.

Contract:
- Input: a Variable Bus (JSON) describing caller, species, flags, and mode.
- Tools you may call:
  1) route_decision → returns the canonical decision/urgency (DO THIS FIRST; you may escalate but NEVER downgrade).
  2) instructions_fetch → fetch step list for the chosen decision (dispatch uses public-health playbook).
  3) referral_search → if decision is "referral" or policy requires it.
  4) status_lookup → for patient_status mode.
  5) finalize → return your results.

Return results ONLY by calling "finalize" with:
  { blocks: AgentBlock[], bus_patch: Partial<VariableBus> }

AgentBlock types: "summary" | "steps" | "referral" | "status" | "warning".

Heuristics:
- ALWAYS call route_decision first and adopt its decision/urgency.
  - You may escalate severity (e.g., bring_in → dispatch) if new facts demand it.
  - NEVER downgrade below route_decision (e.g., do not return monitor if router says dispatch).
- mode=triage:
  - After route_decision, call instructions_fetch(decision).
  - If decision is "referral" (or species policy requires), call referral_search and include a "referral" block.
  - Set bus_patch.triage.decision and bus_patch.triage.urgency to the final choice.
  - If returning referral info, set bus_patch.referral = { needed, validated, target, directions_url }.
- mode=patient_status: call status_lookup and return a "status" block; set bus_patch.patient_status accordingly.
- mode=referral: call referral_search and return a "referral" block; set bus_patch.referral.

Style:
- Keep blocks concise and high-signal.
- Do not invent phone numbers or URLs—use tool results only.
- Do NOT use markdown. For links, include plain text like "Directions: https://...".
- Always end by calling "finalize".
`.trim();

export const toolDefs = [
  // NEW: router tool
  {
    type: "function",
    function: {
      name: "route_decision",
      description: "Compute canonical decision/urgency and reasons for the current Variable Bus.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "referral_search",
      description: "Find referral partner for a species, using org policy/species metadata.",
      parameters: {
        type: "object",
        properties: {
          species_slug: { type: "string" },
          zip: { type: "string", description: "Optional ZIP for routing" },
        },
        required: ["species_slug"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "instructions_fetch",
      description: "Fetch concise steps for the given decision; uses species care_advice when available.",
      parameters: {
        type: "object",
        properties: {
          species_slug: { type: "string", nullable: true },
          decision: {
            type: "string",
            enum: ["monitor", "self_help", "bring_in", "referral", "dispatch", "unknown"],
          },
        },
        required: ["decision"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "status_lookup",
      description: "Retrieve patient status by case_id, phone, or species_text + admit_date.",
      parameters: {
        type: "object",
        properties: {
          case_id: { type: "string", nullable: true },
          phone: { type: "string", nullable: true },
          species_text: { type: "string", nullable: true },
          admit_date: { type: "string", nullable: true, description: "YYYY-MM-DD" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "finalize",
      description: "FINAL STEP. Return structured blocks + a minimal bus patch.",
      parameters: {
        type: "object",
        properties: {
          blocks: {
            type: "array",
            items: {
              type: "object",
              properties: {
                type: { type: "string", enum: ["summary", "steps", "referral", "status", "warning"] },
                title: { type: "string", nullable: true },
                text: { type: "string", nullable: true },
                lines: { type: "array", items: { type: "string" }, nullable: true },
              },
              required: ["type"],
              additionalProperties: false,
            },
          },
          bus_patch: { type: "object" }, // Partial<VariableBus>
        },
        required: ["blocks"],
        additionalProperties: false,
      },
    },
  },
] as const;

export type FinalizeArgs = {
  blocks: Array<{ type: "summary" | "steps" | "referral" | "status" | "warning"; title?: string; text?: string; lines?: string[] }>;
  bus_patch?: Partial<VariableBus>;
};
