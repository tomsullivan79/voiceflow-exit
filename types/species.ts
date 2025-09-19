// types/species.ts
export type SpeciesMetaPayload = {
  slug: string;                  // canonical, unique (e.g., "snapping_turtle")
  common_name: string;           // "Snapping Turtle"
  scientific_name?: string;
  category?: "mammal" | "bird" | "reptile" | "amphibian" | "other";
  // triage levels (string to preserve values like "always" | "conditional" | "rare" | "false" | "true" etc.)
  intervention_needed?: string;
  referral_required_level?: string;
  dangerous_level?: string;
  rabies_vector_level?: string;
  needs_species_escalation_level?: string;
  bat_exposure_level?: string;
  potential_aggression?: string;
  age_assessment_needed?: boolean;

  // booleans from your original minimal set (optional; we compute fallbacks)
  referral_required?: boolean;
  dangerous?: boolean;
  rabies_vector?: boolean;

  // rich fields
  description?: string;
  keywords?: {
    shape?: string[];
    color?: string[];
    behavior?: string[];
    environment?: string[];
  };
  care_advice?: string;
  tags?: string[];
  photo_url?: string;

  // aliases like ["snapper","chelydra","common_snapping_turtle"]
  aliases?: string[];
};

export type SpeciesSeedRequest = {
  // you can send many at once
  species: SpeciesMetaPayload[];
};
