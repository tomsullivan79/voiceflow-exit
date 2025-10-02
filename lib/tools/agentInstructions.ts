import fs from "node:fs/promises";
import path from "node:path";

type Bus = {
  mode?: "triage" | "patient_status" | "referral" | string;
  overlays?: { tone_overlay?: string | null; playbook?: string | null } | null;
  mode_overlay?: string | null; // tolerated; not used here
  org?: { site_code?: string | null; timezone?: string | null } | null;
  caller?: { county?: string | null } | null;
};

export type AgentInstrResult = {
  content: string | null;
  sourcePath: string | null;
  placeholderApplied: boolean;
};

const ROOT = process.cwd();
const CONTENT_DIR = path.join(ROOT, "content", "instructions", "agent");

function clean(v?: string | null) {
  return (v ?? "").trim().toLowerCase().replace(/\s+/g, "_");
}

function countyNameOnly(county?: string | null): string {
  if (!county) return "";
  return county.trim().replace(/\s+(County|Parish|Borough|Municipio)$/i, "");
}

function resolveTone(bus: Bus) {
  const t = bus?.overlays?.tone_overlay ?? "";
  return clean(t) || ""; // e.g., supportive
}

function resolvePlaybook(bus: Bus) {
  const p = bus?.overlays?.playbook ?? "";
  return clean(p) || "default"; // e.g., onsite_help
}

function candidatePaths(bus: Bus): string[] {
  const mode = (bus?.mode ?? "triage").toLowerCase();
  const tone = resolveTone(bus);          // e.g., "supportive"
  const playbook = resolvePlaybook(bus);  // e.g., "onsite_help"

  const rel: string[] = [];

  // Most specific → least specific
  if (tone) rel.push(`${mode}.${playbook}.${tone}.md`);
            rel.push(`${mode}.${playbook}.md`);
  if (tone) rel.push(`${mode}.default.${tone}.md`);
            rel.push(`${mode}.default.md`);
            rel.push(`default.md`);

  return rel;
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

function applyPlaceholders(raw: string, bus: Bus) {
  const county = bus?.caller?.county ?? "";
  const county_name = countyNameOnly(county);
  const org_site = bus?.org?.site_code ?? "";
  const org_timezone = bus?.org?.timezone ?? "";

  let text = raw.replace(/<!--[\s\S]*?-->/g, "");

  const map: Record<string, string> = {
    "{{county}}": county,
    "{{county_name}}": county_name,
    "{{org_site}}": org_site,
    "{{org_timezone}}": org_timezone,
  };
  for (const [k, v] of Object.entries(map)) text = text.split(k).join(v);

  return { text, applied: text !== raw };
}

export async function getAgentInstructions(bus: Bus): Promise<AgentInstrResult> {
  const paths = candidatePaths(bus);
  for (const rel of paths) {
    const md = await tryRead(rel);
    if (md) {
      const { text, applied } = applyPlaceholders(md, bus);
      return { content: text, sourcePath: `agent/${rel}`, placeholderApplied: applied };
    }
  }
  return { content: null, sourcePath: null, placeholderApplied: false };
}
