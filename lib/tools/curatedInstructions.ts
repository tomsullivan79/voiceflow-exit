// lib/tools/curatedInstructions.ts
// Loads curated instruction markdown from /content/instructions/** with robust path resolution
// for Vercel/Next packaging. Returns { title?, lines[], source } or null.

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
    // Resolve relative to compiled file location
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
