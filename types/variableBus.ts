// types/variableBus.ts
export type Mode = 'triage' | 'patient_status' | 'referral';

export type VariableBus = {
  mode: Mode;
  tone_overlay?: 'supportive';
  playbook?: 'onsite_help';
  distress_level?: 0 | 1 | 2 | 3;

  caller: {
    name?: string;
    first_name?: string;
    phone?: string;         // E.164
    email?: string;
    address_text?: string;
    roles: Array<'rescuer' | 'contact' | 'admitter'>;
  };

  lookup_admitter?: {
    name?: string;
    phone?: string;
    message?: string;
  };

  preferences: {
    preferred_contact_method?: 'email' | 'phone' | 'sms';
    wants_status_updates?: boolean;
    status_update_scope?: 'next' | 'all';
  };

  consent: {
    to_text?: boolean;
    to_share?: boolean;
    to_post_help_request?: boolean;
  };

  animal: {
    species_text?: string;
    species_slug?: string;
    species_identified_method?: 'named' | 'inferred';
    species_confidence?: number;            // 0–1
    age_class?: 'neonate' | 'juvenile' | 'adult' | 'unknown';
    observed_condition?: 'sick' | 'injured' | 'stable' | 'unknown';
    situation?: 'sick' | 'injured' | 'orphaned' | 'abandoned' | 'unknown';
    aggressive_behavior?: boolean;
    contained?: boolean;
    count?: number;
    found_location_text?: string;
    found_geo?: { lat: number; lon: number };
    observation_time_iso?: string;
  };

  species_flags: {
    dangerous: boolean;
    rabies_vector: boolean;
    referral_required: boolean;
    intervention_needed: boolean;           // derived: 'always'|'sometimes'|'never' -> boolean bias
    after_hours_allowed: boolean;
  };

  triage: {
    decision?: 'monitor' | 'self_help' | 'bring_in' | 'referral' | 'dispatch' | 'unknown';
    urgency?: 'low' | 'medium' | 'high' | 'critical' | 'unknown';
    instructions_id?: string | null;
    arrival_committed?: boolean;
    overnight_guidance_provided?: boolean;
    caution_required?: boolean;
  };

  patient_status?: {
    case_id?: string;
    status?: 'stable' | 'guarded' | 'critical' | 'euthanized' | 'released' | 'unknown';
    status_description?: string;
    admit_date?: string;                     // YYYY-MM-DD
    release_date?: string;                   // YYYY-MM-DD
    last_update_at?: string;                 // ISO
    lookup_identifiers?: {
      species_text?: string;
      admit_date?: string;                   // from caller
    };
  };

  referral?: {
    needed?: boolean;
    validated?: boolean;
    target_id?: string | null;
    target?: { name?: string; phone?: string; url?: string; coverage?: string } | null;
    directions_url?: string | null;
  };

  conversation: {
    last_agent_action?: string;
    prior_steps?: string[];
    history_summary?: string;
    fallback_outcome?: 'retriaged' | 'user_declined' | 'escalated' | null;
    human_handoff?: { requested?: boolean; reason?: 'policy' | 'user_request' | 'after_hours' | 'tool_error' } | null;
    previous_routing_category?: string | null;
  };

  org: {
    site_code: string;                       // e.g., 'WRCMN'
    timezone: string;                        // IANA, 'America/Chicago'
    after_hours: boolean;
    after_hours_rule?: 'deflect' | 'intake_limited' | 'info_only' | 'escalate';
  };

  onsite_help?: {
    needs_help: boolean;
    help_request_posted?: boolean;
  };

  evidence?: Array<{
    type: 'photo' | 'video' | 'audio' | 'note';
    url?: string;
    caption?: string;
  }>;

  exposure?: {
    bat_sleeping_area?: boolean;
    human_bite_possible?: boolean;
    notes?: string;
  };

  system: {
    channel: 'web' | 'sms' | 'phone';
    system_time: string;                     // ISO, org tz
    feature_flags?: Record<string, boolean>;
    language?: string;                       // 'en', 'es', etc.
  };
};

// Convenience initializer
export function createEmptyBus(mode: Mode, tz = 'America/Chicago'): VariableBus {
  return {
    mode,
    caller: { roles: [] },
    preferences: {},
    consent: {},
    animal: {},
    species_flags: {
      dangerous: false,
      rabies_vector: false,
      referral_required: false,
      intervention_needed: false,
      after_hours_allowed: false,
    },
    triage: {},
    conversation: {},
    org: { site_code: 'WRCMN', timezone: tz, after_hours: false },
    system: { channel: 'web', system_time: new Date().toISOString() },
  };
}

// Helper: map species_meta row into flags
export function mapSpeciesMetaToFlags(row: {
  dangerous?: boolean;
  rabies_vector?: boolean;
  referral_required?: boolean;
  intervention_needed?: 'never' | 'sometimes' | 'always' | boolean;
  after_hours_allowed?: boolean;
}): VariableBus['species_flags'] {
  const intervention =
    typeof row.intervention_needed === 'boolean'
      ? row.intervention_needed
      : row.intervention_needed === 'always'
        ? true
        : row.intervention_needed === 'never'
          ? false
          : false; // 'sometimes' -> default false, triage can still escalate
  return {
    dangerous: !!row.dangerous,
    rabies_vector: !!row.rabies_vector,
    referral_required: !!row.referral_required,
    intervention_needed: intervention,
    after_hours_allowed: !!row.after_hours_allowed,
  };
}
