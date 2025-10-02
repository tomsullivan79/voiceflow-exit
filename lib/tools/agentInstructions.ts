import fs from "node:fs/promises";
import path from "node:path";

type Bus = {
  mode?: "triage" | "patient_status" | "referral" | string;
  overlays?: { tone_overlay?: string | null; playbook?: string | null } | null;
  mode_overlay?: string | null;
  org?: { site_code?: string | null; timezone?: string | null } | null;
  caller?: { county?: string | null } | null;
};

export type AgentInstrResult = {
  content: string | null;
  sourcePath: string | null;
  placeholderApplied: boolean;
  cacheHit?: boolean;
};

const ROOT = process.cwd();
const AGENT_DIR = path.join(ROOT, "content", "instructions", "agent");

// ---- tiny in-memory cache ----
type CacheEntry = { text: string; t: number };
const CACHE = new Map<string, CacheEntry>();
const MAX_ITEMS = 200;
const TTL_MS = 5 * 60 * 1000;

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
    const first = CACHE.keys().next().value as string | undefined;
    if (first) CACHE.delete(first);
  }
  CACHE.set(key, { text, t: Date.now() });
}
// --------------------------------

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
  const tone = resolveTone(bus);          // "supportive" | ""
  const playbook = resolvePlaybook(bus);  // "onsite_help" | "after_hours_support" | "default"

  const rel: string[] = [];
  if (tone) rel.push(`${mode}.${playbook}.${tone}.md`);
            rel.push(`${mode}.${playbook}.md`);
  if (tone) rel.push(`${mode}.default.${tone}.md`);
            rel.push(`${mode}.default.md`);
            rel.push(`default.md`);
  return rel;
}

async function readAgent(relPath: string): Promise<{ text: string | null; cacheHit: boolean }> {
  const abs = path.join(AGENT_DIR, relPath);
  const key = `agent:${abs}`;
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
  // Optional global safety include (cached)
  const safetyRel = "_safety.md";
  const safetyRead = await readAgent(safetyRel);
  const safetyRaw = safetyRead.text ? safetyRead.text.replace(/<!--[\s\S]*?-->/g, "").trim() : "";

  const mode = (bus?.mode ?? "triage").toLowerCase();
  const tone = resolveTone(bus);
  const playbook = resolvePlaybook(bus);

  const paths: string[] = [];
  if (tone) paths.push(`${mode}.${playbook}.${tone}.md`);
           paths.push(`${mode}.${playbook}.md`);
  if (tone) paths.push(`${mode}.default.${tone}.md`);
           paths.push(`${mode}.default.md`);
           paths.push(`default.md`);

  for (const rel of paths) {
    const main = await readAgent(rel);
    if (main.text) {
      const combined = [safetyRaw, main.text].filter(Boolean).join("\n\n");
      const { text, applied } = applyPlaceholders(combined, bus);
      return {
        content: text,
        sourcePath: `agent/${rel}`,
        placeholderApplied: applied || Boolean(safetyRaw),
        cacheHit: main.cacheHit || safetyRead.cacheHit,
      };
    }
  }
  return { content: null, sourcePath: null, placeholderApplied: false, cacheHit: false };
}
