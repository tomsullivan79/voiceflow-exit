// scripts/merge_species.ts
// Usage: npx ts-node scripts/merge_species.ts
// Reads:  data/species-meta-lookup.json  and  data/species-meta.json
// Writes: data/species-merged.json  with shape: { species: [...] }

import * as fs from "fs";
import * as path from "path";

// ---------- Types ----------
type LookupEntry = {
  slug?: string;
  common_name?: string;
  category?: string;
  // triage booleans or levels
  intervention_needed?: string;
  referral_required?: boolean;
  referral_required_level?: string;
  dangerous?: boolean;
  dangerous_level?: string;
  rabies_vector?: boolean;
  rabies_vector_level?: string;
  needs_species_escalation?: boolean;
  needs_species_escalation_level?: string;
  bat_exposure?: boolean;
  bat_exposure_level?: string;
  potential_aggression?: string;
  age_assessment_needed?: boolean;
  aliases?: string[]; // optional, if provided in lookup
};

type MetaEntry = {
  slug?: string; // canonical if present
  common_name?: string;
  scientific_name?: string;
  category?: string;
  description?: string;
  care_advice?: string;
  keywords?: {
    shape?: string[];
    color?: string[];
    behavior?: string[];
    environment?: string[];
  };
  alias_for?: string; // means: THIS entry is an alias for canonical slug
  aliases?: string[]; // or the alternates to fold into this canonical
};

type SpeciesMetaPayload = {
  slug: string;
  common_name: string;
  scientific_name?: string;
  category?:
    | "mammal"
    | "bird"
    | "reptile"
    | "amphibian"
    | "other"
    | "rodent"
    | "songbird"
    | string;
  intervention_needed?: string;
  referral_required_level?: string;
  dangerous_level?: string;
  rabies_vector_level?: string;
  needs_species_escalation_level?: string;
  bat_exposure_level?: string;
  potential_aggression?: string;
  age_assessment_needed?: boolean;
  // booleans kept for fallback compatibility
  referral_required?: boolean;
  dangerous?: boolean;
  rabies_vector?: boolean;
  description?: string;
  keywords?: MetaEntry["keywords"];
  care_advice?: string;
  tags?: string[];
  photo_url?: string;
  aliases?: string[];
};

type SpeciesSeed = { species: SpeciesMetaPayload[] };

// ---------- Helpers ----------
const DATA_DIR = path.join(process.cwd(), "data");
const LOOKUP_PATH = path.join(DATA_DIR, "species-meta-lookup.json");
const META_PATH = path.join(DATA_DIR, "species-meta.json");
const OUT_PATH = path.join(DATA_DIR, "species-merged.json");

function toSlug(s?: string) {
  if (!s) return undefined;
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function arrayify<T>(x: any): T[] {
  if (!x) return [];
  return Array.isArray(x) ? x : [x];
}

function loadJSON<T>(p: string): T {
  const raw = fs.readFileSync(p, "utf8");
  return JSON.parse(raw);
}

// Accepts either an array of entries or an object map { key: entry }
function normalizeLookup(input: any): Record<string, LookupEntry> {
  const out: Record<string, LookupEntry> = {};
  if (Array.isArray(input)) {
    for (const e of input as LookupEntry[]) {
      const slug = toSlug(e.slug || e.common_name);
      if (!slug) continue; // guard: don't index with undefined
      out[slug] = { ...e, slug };
    }
  } else if (input && typeof input === "object") {
    for (const k of Object.keys(input)) {
      const rec = input[k] as LookupEntry;
      const slug = toSlug(rec?.slug || rec?.common_name || k);
      if (!slug) continue; // guard: don't index with undefined
      out[slug] = { ...rec, slug, common_name: rec?.common_name ?? k };
    }
  }
  return out;
}

function normalizeMeta(input: any): Record<string, MetaEntry> {
  const out: Record<string, MetaEntry> = {};
  if (Array.isArray(input)) {
    for (const e of input as MetaEntry[]) {
      const slug = toSlug(e.slug || e.common_name);
      if (!slug) continue; // guard
      out[slug] = { ...e, slug };
    }
  } else if (input && typeof input === "object") {
    for (const k of Object.keys(input)) {
      const rec = input[k] as MetaEntry;
      const slug = toSlug(rec?.slug || rec?.common_name || k);
      if (!slug) continue; // guard
      out[slug] = { ...rec, slug, common_name: rec?.common_name ?? k };
    }
  }
  return out;
}

// Merge strategy:
// 1) union of keys from lookup and meta
// 2) if meta.alias_for exists, treat this meta slug as an alias → attach to canonical (alias_for)
function merge(
  lookupMap: Record<string, LookupEntry>,
  metaMap: Record<string, MetaEntry>
): SpeciesSeed {
  // Build canonical map and collect alias edges
  const canonical: Record<string, SpeciesMetaPayload> = {};
  const aliasPairs: Array<{ alias: string; canonical: string }> = [];

  // Seed from meta (richer names/desc)
  for (const slug of Object.keys(metaMap)) {
    const m = metaMap[slug];
    if (m.alias_for) {
      // record alias for later folding
      const target = toSlug(m.alias_for);
      if (target) aliasPairs.push({ alias: slug, canonical: target });
      continue;
    }
    canonical[slug] = {
      slug,
      common_name: m.common_name || slug.replace(/_/g, " "),
      scientific_name: m.scientific_name,
      category: (m.category as any) || undefined,
      description: m.description,
      care_advice: m.care_advice,
      keywords: m.keywords,
      aliases: arrayify<string>(m.aliases),
    };
  }

  // Add entries that exist only in lookup
  for (const slug of Object.keys(lookupMap)) {
    if (!canonical[slug]) {
      const l = lookupMap[slug];
      canonical[slug] = {
        slug,
        common_name: l.common_name || slug.replace(/_/g, " "),
        category: (l.category as any) || undefined,
        aliases: arrayify<string>(l.aliases),
      };
    }
  }

  // Merge lookup triage fields into canonical
  for (const slug of Object.keys(lookupMap)) {
    const l = lookupMap[slug];
    const c = canonical[slug];
    if (!c) continue;
    // keep levels if present, otherwise leave undefined (API will handle fallbacks)
    c.intervention_needed = l.intervention_needed ?? c.intervention_needed;
    c.referral_required_level =
      l.referral_required_level ?? c.referral_required_level;
    c.dangerous_level = l.dangerous_level ?? c.dangerous_level;
    c.rabies_vector_level = l.rabies_vector_level ?? c.rabies_vector_level;
    c.needs_species_escalation_level =
      l.needs_species_escalation_level ?? c.needs_species_escalation_level;
    c.bat_exposure_level = l.bat_exposure_level ?? c.bat_exposure_level;
    c.potential_aggression = l.potential_aggression ?? c.potential_aggression;
    c.age_assessment_needed =
      l.age_assessment_needed ?? c.age_assessment_needed;

    // also carry boolean fallbacks if lookup provides them
    c.referral_required = l.referral_required ?? c.referral_required;
    c.dangerous = l.dangerous ?? c.dangerous;
    c.rabies_vector = l.rabies_vector ?? c.rabies_vector;
  }

  // Fold alias edges from meta.alias_for into canonical
  for (const { alias, canonical: target } of aliasPairs) {
    const t = canonical[target];
    if (!t) {
      // If canonical target not yet present, create a stub so alias isn't lost
      canonical[target] = {
        slug: target,
        common_name: target.replace(/_/g, " "),
        aliases: [alias],
      };
    } else {
      t.aliases = Array.from(new Set([...(t.aliases ?? []), alias]));
    }
  }

  // Dedupe and normalize aliases to slugs
  for (const slug of Object.keys(canonical)) {
    const c = canonical[slug];
    if (c.aliases?.length) {
      const norm = c.aliases
        .map((a) => toSlug(a))
        .filter((s): s is string => !!s);
      c.aliases = Array.from(new Set(norm));
    }
  }

  // Emit as array, sorted for sanity
  const species = Object.values(canonical).sort((a, b) =>
    a.slug.localeCompare(b.slug)
  );
  return { species };
}

function main() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

  if (!fs.existsSync(LOOKUP_PATH) || !fs.existsSync(META_PATH)) {
    console.error(
      `Missing input.\nPlace your files here as JSON:\n  ${LOOKUP_PATH}\n  ${META_PATH}\n` +
        `See README in this file header for format hints.`
    );
    process.exit(1);
  }

  const lookupRaw = loadJSON<any>(LOOKUP_PATH);
  const metaRaw = loadJSON<any>(META_PATH);

  const lookupMap = normalizeLookup(lookupRaw);
  const metaMap = normalizeMeta(metaRaw);

  const merged = merge(lookupMap, metaMap);
  fs.writeFileSync(OUT_PATH, JSON.stringify(merged, null, 2), "utf8");
  console.log(`Wrote ${OUT_PATH} with ${merged.species.length} species.`);
}

main();
