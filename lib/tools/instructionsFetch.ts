// lib/tools/instructionsFetch.ts
import { createClient } from "@supabase/supabase-js";

type Decision = "monitor" | "self_help" | "bring_in" | "referral" | "dispatch" | "unknown";

type Args = {
  species_slug?: string | null;
  decision: Decision;
};

type Out = { steps: string[]; source: string };

export async function instructionsFetch({ species_slug, decision }: Args): Promise<Out> {
  // Public Health Escalation (formerly "dispatch") — decision-specific steps
  if (decision === "dispatch") {
    return {
      steps: [
        "Do not touch the animal. Keep people and pets away.",
        "If a bat was in a room with a sleeping person or with a child/elder/impaired individual, treat as potential rabies exposure.",
        "Close interior doors and confine the area if safe to do so.",
        "If the animal is already contained (e.g., in a box), keep it closed and in a low-traffic room.",
        "Contact your local Public Health Department or Animal Control for exposure guidance and testing instructions.",
        "If anyone had direct contact, bite, or scratch: wash the area with soap and water for 15 minutes and seek medical care immediately.",
        "If advised to submit the animal for testing, follow their instructions for safe transport; do not attempt handling without guidance.",
      ],
      source: "playbook.public_health",
    };
  }

  // For other decisions, try species_meta care advice
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE;

  if (species_slug && url && service) {
    const supabase = createClient(url, service, { auth: { persistSession: false } });
    const { data, error } = await supabase
      .from("species_meta_lookup")
      .select("care_advice")
      .eq("slug", species_slug)
      .maybeSingle();

    if (!error && data?.care_advice) {
      const lines = data.care_advice
        .split(/\n+/)
        .map((s: string) => s.trim())
        .filter(Boolean);
      return { steps: lines, source: "species_meta.care_advice" };
    }
  }

  // Safe fallback if nothing else
  const fallback: Record<Decision, string[]> = {
    monitor: [
      "Observe from a distance. Do not feed or give water.",
      "Keep pets and people away; re-check in a few hours.",
    ],
    self_help: [
      "Place the animal in a ventilated cardboard box with a towel.",
      "Keep dark, warm, and quiet. Do not feed or give water.",
    ],
    bring_in: [
      "Carefully place the animal in a ventilated box/kennel with a towel.",
      "Keep dark, warm, and quiet. Transport to the center during open hours.",
    ],
    referral: [
      "Follow the referral instructions provided for this species/region.",
      "Call the partner organization before transporting if advised.",
    ],
    dispatch: [
      // This path should have been handled above; keep a minimal safety copy.
      "Keep people and pets away; do not handle.",
      "Contact local Public Health/Animal Control for exposure guidance.",
    ],
    unknown: [
      "Keep people and pets away and do not feed or give water.",
      "We’ll determine the next steps once more info is available.",
    ],
  };

  return { steps: fallback[decision] ?? fallback.unknown, source: "fallback.default" };
}
