// lib/tools/curatedInstructions.ts
// Loads curated instruction markdown from /content/instructions/** with robust path resolution
// (so it works on Vercel/Next) and supports simple {{placeholders}} replaced from the Bus,
// including {{county_name}} which strips suffixes like "County", "Parish", "Borough", etc.

import { readFile, access } from 'node:fs/promises';
import path from 'node:path';

export type CuratedSteps = { title?: string; lines: string[]; source: string };

// ---------- FS helpers ----------

async function exists(p: string) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Try multiple candidate locations for the content folder that can occur in Next/Vercel builds.
 * Falls back to project root expectation if nothing is found.
 */
async function resolveContentRoot(): Promise<string> {
  const cwd = process.cwd();
  const here = typeof __dirname === 'string' ? __dirname : cwd;

  const candidates = [
    // dev / local — project root
    path.join(cwd, 'content', 'instructions'),
    // Next App Router server bundle variants
    path.join(cwd, '.next', 'server', 'app', 'api', 'agent', 'llm', 'route', 'content', 'instructions'),
    path.join(cwd, '.next', 'server', 'content', 'instructions'),
    // Standalone/monorepo-ish
    path.join(cwd, '..', 'content', 'instructions'),
    // Relative to compiled file location
    path.join(here, '..', '..', '..', 'content', 'instructions'),
    path.join(here, '..', '..', '..', '..', 'content', 'instructions'),
  ];

  for (const p of candidates) {
    if (await exists(p)) return p;
  }
  // Fallback to project-root expectation
  return path.join(cwd, 'content', 'instructions');
}

// ---------- Markdown parsing ----------

function parseMarkdown(md: string): { title?: string; lines: string[] } {
  const rows = md.split(/\r?\n/);
  let title: string | undefined;
  let i = 0;

  // Optional H1 title on the first line becomes the steps block title
  if (rows[0]?.trim().startsWith('#')) {
    title = rows[0].replace(/^#\s*/, '').trim();
    i = 1;
  }

  const out: string[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) {
      const t = para.join(' ').trim();
      if (t) out.push(t);
      para = [];
    }
  };

  for (; i < rows.length; i++) {
    const line = rows[i] ?? '';
    if (/^\s*$/.test(line)) {
      flush();
      continue;
    }
    const m = line.match(/^\s*(?:[-*]\s+|\d+\.\s+)(.+)$/);
    if (m) {
      flush();
      out.push(m[1].trim());
    } else {
      // Non-bulleted text lines get merged into a paragraph
      para.push(line.trim());
    }
  }
  flush();
  return { title, lines: out };
}

// ---------- Curated file selection ----------

/**
 * Select a curated doc based on the Bus.
 *
 * For mode='triage':
 *   1) triage/<decision>.<species_slug>.md
 *   2) triage/<decision>.default.md
 *
 * For mode='patient_status':
 *   - patient_status/default.md
 *
 * For mode='referral':
 *   1) referral/<species_slug>.md
 *   2) referral/default.md
 */
export async function loadCuratedSteps(bus: any): Promise<CuratedSteps | null> {
  const mode = bus?.mode ?? 'triage';
  const decision = bus?.triage?.decision;
  const slug = bus?.animal?.species_slug;

  const root = await resolveContentRoot();
  const base = path.join(root, mode);
  const candidates: string[] = [];

  if (mode === 'triage' && decision) {
    if (slug) candidates.push(`${decision}.${slug}.md`);
    candidates.push(`${decision}.default.md`);
  } else if (mode === 'patient_status') {
    candidates.push('default.md');
  } else if (mode === 'referral') {
    if (slug) candidates.push(`${slug}.md`);
    candidates.push('default.md');
  }

  for (const name of candidates) {
    const full = path.join(base, name);
    try {
      if (await exists(full)) {
        const raw = await readFile(full, 'utf8');
        const parsed = parseMarkdown(raw);
        return { ...parsed, source: `${mode}/${name}` };
      }
    } catch {
      // keep trying other candidates
    }
  }
  return null;
}

// ---------- Placeholder replacement ----------

function getByPath(obj: any, pathStr: string): any {
  if (!obj || !pathStr) return undefined;
  return pathStr.split('.').reduce((acc: any, key: string) => (acc == null ? acc : acc[key]), obj);
}

/** Strip common county-like suffixes once, case-insensitive. */
function countyName(raw?: string): string | undefined {
  if (!raw) return raw;
  const suffixes = [' County', ' Parish', ' Borough', ' Census Area', ' Municipality'];
  let out = String(raw);
  for (const s of suffixes) {
    const re = new RegExp(`${s}$`, 'i');
    out = out.replace(re, '');
  }
  return out.trim();
}

/**
 * Replace {{placeholders}} in provided lines with values from the Bus.
 *
 * Friendly keys:
 *   {{zip}}            -> caller.zip
 *   {{county}}         -> caller.county         (verbatim, e.g., "Hennepin County")
 *   {{county_name}}    -> caller.county         (suffix-stripped, e.g., "Hennepin")
 *   {{species}}        -> animal.species_text (fallback to species_slug)
 *   {{species_slug}}   -> animal.species_slug
 *   {{decision}}       -> triage.decision
 *   {{urgency}}        -> triage.urgency
 *   {{org_site}}       -> org.site_code
 *   {{org_timezone}}   -> org.timezone
 *
 * Also supports dotted paths directly, e.g., {{caller.zip}}, {{org.site_code}}.
 * Missing values are left as-is (the {{token}} remains) so authors can notice.
 */
export function applyCuratedPlaceholders(lines: string[], bus: any): string[] {
  const map: Record<string, string> = {
    zip: 'caller.zip',
    county: 'caller.county',
    county_name: 'caller.county',
    species: 'animal.species_text',
    species_slug: 'animal.species_slug',
    decision: 'triage.decision',
    urgency: 'triage.urgency',
    org_site: 'org.site_code',
    org_timezone: 'org.timezone',
  };

  const speciesText =
    getByPath(bus, 'animal.species_text') || getByPath(bus, 'animal.species_slug');

  // small cache for values that need pre-processing
  const cache: Record<string, string | undefined> = {
    species: speciesText,
    county_name: countyName(getByPath(bus, 'caller.county')),
  };

  const re = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g;

  return (lines || []).map((line) =>
    line.replace(re, (_m, key: string) => {
      // Try friendly key → path map first; allow dotted paths directly as a fallback
      const pathStr = map[key] || key;

      // Cached/precomputed value?
      if (cache[key] !== undefined) return String(cache[key]);

      // Pull value by path
      const raw = getByPath(bus, pathStr);
      if (raw === undefined || raw === null) return `{{${key}}}`;

      // Compute & cache on first sight
      const s = key === 'county_name' ? countyName(String(raw)) : String(raw);
      cache[key] = s;
      return s ?? `{{${key}}}`;
    })
  );
}
