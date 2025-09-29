// lib/tools/instructionsFetch.ts
import { createClient } from "@supabase/supabase-js";

export type InstructionDecision = "monitor" | "self_help" | "bring_in" | "referral" | "dispatch" | "unknown";

export type InstructionsInput = {
  species_slug?: string;
  decision: InstructionDecision;
};

export type InstructionsResult = {
  decision: InstructionDecision;
  steps: string[];          // concise, numbered-friendly lines
  reference?: {             // long-form guidance, if any
    title: string;
    text: string;
  };
  source: "species_meta.care_advice" | "generic";
};

function genericSteps(decision: InstructionDecision): string[] {
  switch (decision) {
    case "monitor":
      return [
        "Observe from a distance for 2–4 hours.",
        "Keep people and pets away.",
        "If condition worsens, start containment and call back."
      ];
    case "self_help":
      return [
        "Prepare a ventilated cardboard box with a soft towel.",
        "Place the animal inside, keep in a dark, quiet room.",
        "Do not feed or give water unless specifically instructed."
      ];
    case "bring_in":
      return [
        "Line a ventilated box/kennel with a towel; no wire cages.",
        "Gently place the animal inside; keep dark, quiet, and warm.",
        "Transport directly to the center; avoid loud music and stops."
      ];
    case "referral":
      return [
        "Do not handle unless absolutely necessary and safe.",
        "Use a towel/blanket to cover and gently contain if required.",
        "Contact the referral partner for intake instructions."
      ];
    case "dispatch":
      return [
        "For immediate safety, call local non-emergency dispatch or Animal Control.",
        "Provide exact location and species description.",
        "Maintain safe distance until responders arrive."
      ];
    default:
      return ["No specific steps available."];
  }
}

/**
 * Pulls care_advice when available and splits into concise steps.
 * Fallback to generic steps based on the decision.
 */
export async function instructionsFetch(
  input: InstructionsInput
): Promise<InstructionsResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE;

  if (!input.species_slug || !url || !service) {
    return { decision: input.decision, steps: genericSteps(input.decision), source: "generic" };
  }

  try {
    const supabase = createClient(url, service, { auth: { persistSession: false } });
    const { data } = await supabase
      .from("species_meta")
      .select("common_name, care_advice")
      .eq("slug", input.species_slug)
      .maybeSingle();

    if (data?.care_advice) {
      // Split on bullet markers or line breaks into concise steps
      const raw = String(data.care_advice);
      const parts = raw
        .split(/\n|\r|▸/g)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      // Keep up to ~8 concise lines
      const steps = parts.slice(0, 8);
      return {
        decision: input.decision,
        steps: steps.length ? steps : genericSteps(input.decision),
        reference: { title: data.common_name ?? input.species_slug, text: raw },
        source: "species_meta.care_advice",
      };
    }
  } catch {
    // ignore and fall through
  }

  return { decision: input.decision, steps: genericSteps(input.decision), source: "generic" };
}
