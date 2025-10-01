// lib/tools/curatedInstructions.ts
// Minimal loader to read curated instruction markdown from /content/instructions.
// No dependencies. Titles come from a leading "# Heading" in the .md file.
// Lines are parsed from -/*/1. bullets. Non-bulleted paragraphs are captured as single lines.

import { readFile } from 'node:fs/promises';
import path from 'node:path';

export type CuratedSteps = { title?: string; lines: string[]; source: string };

function joinRoot(...p: string[]) {
  return path.join(process.cwd(), ...p);
}

function parseMarkdown(md: string): { title?: string; lines: string[] } {
  const rows = md.split(/\r?\n/);
  let title: string | undefined;
  let i = 0;

  // Optional H1 title
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
 * For other modes we start simple:
 *   patient_status/default.md
 *   referral/<species_slug>.md, referral/default.md
 */
export async function loadCuratedSteps(bus: any): Promise<CuratedSteps | null> {
  const mode = bus?.mode ?? 'triage';
  const decision = bus?.triage?.decision;
  const slug = bus?.animal?.species_slug;

  const base = joinRoot('content', 'instructions', mode);
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
    try {
      const full = path.join(base, name);
      const raw = await readFile(full, 'utf8');
      const parsed = parseMarkdown(raw);
      return { ...parsed, source: `${mode}/${name}` };
    } catch {
      // keep trying
    }
  }
  return null;
}
