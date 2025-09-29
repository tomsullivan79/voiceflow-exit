// lib/agent/promptContract.ts
import { VariableBus } from "@/types/variableBus";

export const SYSTEM_PROMPT = `
You are the WildTriage Single Agent.

Contract:
- Input: a Variable Bus (JSON) describing caller, species, flags, and mode.
- You may call tools to fetch patient status, referral targets, or care instructions.
- Return results ONLY by calling the tool "finalize" with:
  { blocks: AgentBlock[], bus_patch: Partial<VariableBus> }
- AgentBlock types: "summary" | "steps" | "referral" | "status" | "warning"

Heuristics:
- mode=triage → pick a decision based on bus.triage.decision (if set) or species flags.
  - If species requires referral, include a "referral" block.
  - Always include a "steps" block using instructions_fetch (species care advice) when available.
- mode=patient_status → call status_lookup with available identifiers; return a "status" block.
- mode=referral → call referral_search and return a "referral" block.

Style:
- Keep blocks concise. Use short, high-signal lines.
- Do not invent phone numbers or URLs—use tool results.
- Do not output prose; ALWAYS end by calling "finalize".
`.trim();

export const toolDefs = [
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
