// lib/tools/curatedInstructions.ts
// Loads curated instruction markdown from /content/instructions/** with robust path resolution
// and supports simple {{placeholders}} replaced from the Bus.

import { readFile, access } from 'node:fs/promises';
import path from 'node:path';

export type CuratedSteps = { title?: string; lines: string[]; source: string };

async function exists(p: string) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

// Try multiple candidate locations that can occur in Next/Vercel builds.
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

function parseMarkdown(md: string): { title?: string; lines: string[] } {
  const rows = md.split(/\r?\n/);
  let title: string | undefined;
  let i = 0;

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
      para.push(line.trim());
    }
  }
  flush();
  return { title, lines: out };
}

/**
 * Looks for a curated doc based on the bus.
 * Priority (for mode='triage'):
 *   1) triage/<decision>.<species_slug>.md
 *   2) triage/<decision>.default.md
 * For other modes:
 *   patient_status/default.md
 *   referral/<species_slug>.md, referral/default.md
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
      // continue
    }
  }
  return null;
}

// -------------------- Placeholders --------------------

function getByPath(obj: any, pathStr: string): any {
  if (!obj || !pathStr) return undefined;
  return pathStr.split('.').reduce((acc: any, key: string) => (acc == null ? acc : acc[key]), obj);
}

/**
 * Replace {{placeholders}} in provided lines with values from the Bus.
 * Supported friendly keys:
 *   {{zip}}            -> caller.zip
 *   {{county}}         -> caller.county
 *   {{species}}        -> animal.species_text (falls back to species_slug)
 *   {{species_slug}}   -> animal.species_slug
 *   {{decision}}       -> triage.decision
 *   {{urgency}}        -> triage.urgency
 *   {{org_site}}       -> org.site_code
 *   {{org_timezone}}   -> org.timezone
 *
 * Also supports dotted paths directly, e.g. {{caller.zip}}, {{org.site_code}}.
 * Missing values are left as-is (the {{token}} remains), so authors notice.
 */
export function applyCuratedPlaceholders(lines: string[], bus: any): string[] {
  const map: Record<string, string> = {
    zip: 'caller.zip',
    county: 'caller.county',
    species: 'animal.species_text',
    species_slug: 'animal.species_slug',
    decision: 'triage.decision',
    urgency: 'triage.urgency',
    org_site: 'org.site_code',
    org_timezone: 'org.timezone',
  };

  const speciesText = getByPath(bus, 'animal.species_text') || getByPath(bus, 'animal.species_slug');
  const cache: Record<string, string | undefined> = {
    species: speciesText,
  };

  const re = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g;

  return (lines || []).map((line) =>
    line.replace(re, (_m, key: string) => {
      // Try friendly map first
      const pathStr = map[key] || key; // allow dotted paths directly
      const cached = cache[key];
      if (cached !== undefined) return String(cached);
      const val = getByPath(bus, pathStr);
      if (val === undefined || val === null) return `{{${key}}}`; // leave token
      const s = String(val);
      cache[key] = s;
      return s;
    })
  );
}
