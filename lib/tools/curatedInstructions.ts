import fs from "node:fs/promises";
import path from "node:path";
import { speciesToGroup } from "@/lib/data/speciesGroups";

type Bus = {
  mode?: "triage" | "patient_status" | "referral" | string;
  overlays?: { tone_overlay?: string | null } | null;
  mode_overlay?: string | null;
  animal?: { species_slug?: string | null } | null;
  triage?: { decision?: string | null } | null;
  caller?: { zip?: string | null; county?: string | null } | null;
  org?: { site_code?: string | null; timezone?: string | null } | null;
};

export type CuratedResult = {
  content: string | null;
  sourcePath: string | null;
  placeholderApplied: boolean;
  cacheHit?: boolean;
};

const ROOT = process.cwd();
const CONTENT_DIR = path.join(ROOT, "content", "instructions");

// ---- tiny in-memory cache ----
type CacheEntry = { text: string; t: number };
const CACHE = new Map<string, CacheEntry>();
const MAX_ITEMS = 200;
const TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCached(key: string): string | null {
  const e = CACHE.get(key);
  if (!e) return null;
  if (Date.now() - e.t > TTL_MS) {
    CACHE.delete(key);
    return null;
  }
  return e.text;
}
function setCached(key: string, text: string) {
  if (CACHE.size >= MAX_ITEMS) {
    // Drop oldest-ish entry (Map iteration order is insertion order)
    const first = CACHE.keys().next().value as string | undefined;
    if (first) CACHE.delete(first);
  }
  CACHE.set(key, { text, t: Date.now() });
}
// --------------------------------

function cleanSlug(v?: string | null): string | null {
  if (!v) return null;
  return String(v).trim().toLowerCase().replace(/\s+/g, "-");
}

function countyNameOnly(county?: string | null): string | null {
  if (!county) return null;
  return county.trim().replace(/\s+(County|Parish|Borough|Municipio)$/i, "");
}

function resolveTone(bus: Bus): string | null {
  const oTone = bus?.overlays?.tone_overlay?.trim().toLowerCase() || null;
  const alt = bus?.mode_overlay?.trim().toLowerCase() || null;
  return oTone || (alt === "supportive" ? "supportive" : null);
}

function preferredCandidates(bus: Bus): { relPaths: string[] } {
  const mode = bus?.mode || "triage";
  const decision = cleanSlug(bus?.triage?.decision) || "default";
  const species = cleanSlug(bus?.animal?.species_slug) || null;
  const group = speciesToGroup(species) || null;
  const tone = resolveTone(bus);

  const relPaths: string[] = [];

  // General order for triage/patient_status
  if (tone) {
    if (species) relPaths.push(`${mode}/${decision}.${species}.${tone}.md`);
    if (group)   relPaths.push(`${mode}/${decision}.${group}.${tone}.md`);
                 relPaths.push(`${mode}/${decision}.default.${tone}.md`);
  }
  if (species)  relPaths.push(`${mode}/${decision}.${species}.md`);
  if (group)    relPaths.push(`${mode}/${decision}.${group}.md`);
                relPaths.push(`${mode}/${decision}.default.md`);

  // Referral-mode extras (prefer top-level group before default)
  if (mode === "referral") {
    const extras: string[] = [];
    if (tone && group) extras.push(`referral/${group}.${tone}.md`);
    if (tone)          extras.push(`referral/default.${tone}.md`);
    if (group)         extras.push(`referral/${group}.md`);
                       extras.push(`referral/default.md`);
    relPaths.unshift(...extras);
  } else if (mode === "patient_status") {
    const extras: string[] = [];
    if (tone) extras.push(`patient_status/default.${tone}.md`);
              extras.push(`patient_status/default.md`);
    relPaths.unshift(...extras);
  }

  return { relPaths };
}

async function tryRead(relPath: string): Promise<{ text: string | null; cacheHit: boolean }> {
  const abs = path.join(CONTENT_DIR, relPath);
  const key = `curated:${abs}`;
  const hit = getCached(key);
  if (hit != null) return { text: hit, cacheHit: true };
  try {
    const buf = await fs.readFile(abs);
    const text = buf.toString("utf8");
    setCached(key, text);
    return { text, cacheHit: false };
  } catch {
    return { text: null, cacheHit: false };
  }
}

function applyPlaceholders(raw: string, bus: Bus): { text: string; applied: boolean } {
  const zip = bus?.caller?.zip ?? "";
  const county = bus?.caller?.county ?? "";
  const county_name = countyNameOnly(county) ?? "";
  const species = bus?.animal?.species_slug ? bus.animal.species_slug.replace(/-/g, " ") : "";
  const species_slug = bus?.animal?.species_slug ?? "";
  const decision = bus?.triage?.decision ?? "";
  const org_site = bus?.org?.site_code ?? "";
  const org_timezone = bus?.org?.timezone ?? "";
  const urgency = "";

  let text = raw;
  const before = text;

  const map: Record<string, string> = {
    "{{zip}}": String(zip),
    "{{county}}": String(county),
    "{{county_name}}": String(county_name),
    "{{species}}": String(species),
    "{{species_slug}}": String(species_slug),
    "{{decision}}": String(decision),
    "{{urgency}}": String(urgency),
    "{{org_site}}": String(org_site),
    "{{org_timezone}}": String(org_timezone),
  };

  text = text.replace(/<!--[\s\S]*?-->/g, "");
  for (const [k, v] of Object.entries(map)) text = text.split(k).join(v);

  return { text, applied: text !== before };
}

export async function getCuratedInstructions(bus: Bus): Promise<CuratedResult> {
  const { relPaths } = preferredCandidates(bus);
  for (const rel of relPaths) {
    const { text: raw, cacheHit } = await tryRead(rel);
    if (raw) {
      const { text, applied } = applyPlaceholders(raw, bus);
      return { content: text, sourcePath: rel, placeholderApplied: applied, cacheHit };
    }
  }
  return { content: null, sourcePath: null, placeholderApplied: false, cacheHit: false };
}
