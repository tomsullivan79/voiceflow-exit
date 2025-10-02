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
};

const ROOT = process.cwd();
const CONTENT_DIR = path.join(ROOT, "content", "instructions");

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

  // ORDER (general): species.tone → group.tone → default.tone → species → group → default
  if (tone) {
    if (species) relPaths.push(`${mode}/${decision}.${species}.${tone}.md`);
    if (group)   relPaths.push(`${mode}/${decision}.${group}.${tone}.md`);
                 relPaths.push(`${mode}/${decision}.default.${tone}.md`);
  }
  if (species)  relPaths.push(`${mode}/${decision}.${species}.md`);
  if (group)    relPaths.push(`${mode}/${decision}.${group}.md`);
                relPaths.push(`${mode}/${decision}.default.md`);

  // Mode-specific **extras**:
  if (mode === "referral") {
    // Prefer top-level group files (we created `referral/raptor.supportive.md`)
    if (tone && group) relPaths.unshift(`referral/${group}.${tone}.md`);
    if (group)         relPaths.push(`referral/${group}.md`);

    // Keep existing defaults
    if (tone) relPaths.unshift(`referral/default.${tone}.md`);
    relPaths.push(`referral/default.md`);
  } else if (mode === "patient_status") {
    if (tone) relPaths.unshift(`patient_status/default.${tone}.md`);
    relPaths.push(`patient_status/default.md`);
  }

  return { relPaths };
}

async function tryRead(relPath: string): Promise<string | null> {
  const abs = path.join(CONTENT_DIR, relPath);
  try {
    const buf = await fs.readFile(abs);
    return buf.toString("utf8");
  } catch {
    return null;
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
    const raw = await tryRead(rel);
    if (raw) {
      const { text, applied } = applyPlaceholders(raw, bus);
      return { content: text, sourcePath: rel, placeholderApplied: applied };
    }
  }
  return { content: null, sourcePath: null, placeholderApplied: false };
}
