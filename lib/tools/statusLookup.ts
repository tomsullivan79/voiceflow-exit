// lib/tools/statusLookup.ts
export type PatientStatus =
  | "stable"
  | "guarded"
  | "critical"
  | "euthanized"
  | "released"
  | "unknown";

export type StatusLookupInput = {
  case_id?: string;
  phone?: string;          // E.164 or raw
  species_text?: string;
  admit_date?: string;     // YYYY-MM-DD
};

export type StatusLookupResult = {
  matched: boolean;
  matchedBy?: "case_id" | "phone" | "fuzzy";
  patient: {
    case_id?: string;
    status: PatientStatus;
    status_description?: string;
    admit_date?: string;
    release_date?: string | null;
    last_update_at?: string;
    species_text?: string;
  };
  source: "mock";
};

/**
 * Stubbed status lookup:
 * - Deterministic mock so demos are stable.
 * - No DB calls yet. Returns a plausible shape.
 */
export async function statusLookup(
  input: StatusLookupInput
): Promise<StatusLookupResult> {
  const nowIso = new Date().toISOString();

  // deterministic status by hashing a key
  const key =
    (input.case_id ?? "") + "|" + (input.phone ?? "") + "|" + (input.admit_date ?? "");
  const hash = [...key].reduce((a, c) => (a * 33 + c.charCodeAt(0)) >>> 0, 5381);
  const bucket = hash % 5;

  const statuses: PatientStatus[] = ["stable", "guarded", "critical", "released", "euthanized"];
  const status = statuses[bucket];

  const descriptions: Record<PatientStatus, string> = {
    stable:
      "Patient is stable and recovering under routine care. No action needed from you right now.",
    guarded:
      "Condition is guarded. Patient requires close monitoring and supportive care.",
    critical:
      "Condition is critical and receiving intensive care. Prognosis is uncertain.",
    released:
      "Patient recovered and was released back to the wild.",
    euthanized:
      "Patient’s injuries were not survivable; humane euthanasia was performed to end suffering.",
    unknown: "No status available yet."
  };

  const matched =
    !!input.case_id || !!input.phone || (!!input.species_text && !!input.admit_date);
  let matchedBy: StatusLookupResult["matchedBy"] = undefined;
  if (input.case_id) matchedBy = "case_id";
  else if (input.phone) matchedBy = "phone";
  else if (input.species_text && input.admit_date) matchedBy = "fuzzy";

  // If status is released, create a plausible release date ≥ admit_date
  let release_date: string | null = null;
  if (status === "released") {
    const base = input.admit_date ? new Date(input.admit_date) : new Date();
    const d = new Date(base);
    d.setDate(base.getDate() + 21);
    release_date = d.toISOString().slice(0, 10);
  }

  return {
    matched,
    matchedBy,
    patient: {
      case_id: input.case_id ?? `WT-${hash.toString(36).toUpperCase()}`,
      status,
      status_description: descriptions[status],
      admit_date: input.admit_date ?? nowIso.slice(0, 10),
      release_date,
      last_update_at: nowIso,
      species_text: input.species_text,
    },
    source: "mock",
  };
}
