// lib/policy.ts
import { supabaseAdmin } from '@/lib/supabaseServer';

type OutOfScopePolicy = {
  type: 'out_of_scope';
  public_message: string | null;
  referrals: any[]; // kept loose for now
};

type IntakeStatus = 'accept' | 'conditional' | 'not_supported';

type OrgIntakePolicy = {
  type: 'org_intake';
  status: IntakeStatus;
  public_message: string | null;
  referrals: any[];
};

export type ResolvedPolicy = OutOfScopePolicy | OrgIntakePolicy | null;

/** Basic fold + normalize to compare human text robustly */
function normalize(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '') // strip diacritics
      .replace(/[_\-]+/g, ' ')         // underscores/hyphens → space
      .replace(/[^a-z0-9]+/g, ' ')     // non-alphanum → space
      .replace(/\s+/g, ' ')            // collapse spaces
      .trim()
  );
}

/** Make a list of candidate needles (singular + naive plural) */
function expandTerm(term: string): string[] {
  const t = normalize(term);
  if (!t) return [];
  const out = new Set<string>([t]);
  // naive pluralization for common words, e.g., dog → dogs, fawn → fawns, mouse → mice (special-case)
  if (t === 'mouse') out.add('mice');
  else if (t.endsWith('y') && !/[aeiou]y$/.test(t)) out.add(t.slice(0, -1) + 'ies');
  else if (!t.endsWith('s')) out.add(t + 's');
  return Array.from(out);
}

/** Pads both haystack and needle with spaces to preserve word-ish boundaries */
function includesWholeWord(hay: string, needle: string): boolean {
  const h = ` ${normalize(hay)} `;
  const n = ` ${normalize(needle)} `;
  return h.includes(n);
}

export async function detectSpeciesSlugFromText(text: string): Promise<string | null> {
  const supa = supabaseAdmin();

  // Normalize the query once
  const q = ` ${normalize(text)} `;

  // 1) Load canonical species + common names
  const [{ data: species, error: speciesErr }, { data: aliases, error: aliasErr }, { data: oos, error: oosErr }] =
    await Promise.all([
      supa.from('species_meta').select('slug, common_name'),
      supa.from('species_aliases').select('alias, canonical_slug'),
      supa.from('out_of_scope_species').select('slug, display_name'),
    ]);

  if (speciesErr) {
    console.error('[policy] species_meta error:', speciesErr);
  }
  if (aliasErr) {
    console.error('[policy] species_aliases error:', aliasErr);
  }
  if (oosErr) {
    console.error('[policy] out_of_scope_species error:', oosErr);
  }

  // Gazetteer for pets/synonyms that people use frequently
  const synonymMap: Record<string, string> = {
    puppy: 'dog',
    pup: 'dog',
    doggo: 'dog',
    hound: 'dog',
    pooch: 'dog',
    kitty: 'cat',
    kitten: 'cat',
    kittycat: 'cat',
  };

  type Term = { term: string; canonical: string };
  const terms: Term[] = [];

  // 2) Out-of-scope rows (e.g., dog/cat) get top priority
  for (const row of oos ?? []) {
    const canonical = row.slug;
    const candidates = new Set<string>([row.slug, row.display_name].filter(Boolean) as string[]);
    // add synonyms for pets
    if (canonical === 'dog') Object.keys(synonymMap).forEach((k) => synonymMap[k] === 'dog' && candidates.add(k));
    if (canonical === 'cat') Object.keys(synonymMap).forEach((k) => synonymMap[k] === 'cat' && candidates.add(k));
    for (const c of candidates) expandTerm(c).forEach((t) => terms.push({ term: t, canonical }));
  }

  // 3) Canonical wildlife species (slug + common_name)
  for (const row of species ?? []) {
    const canonical = row.slug as string;
    const candidates = new Set<string>([row.slug, row.common_name].filter(Boolean) as string[]);
    for (const c of candidates) expandTerm(c).forEach((t) => terms.push({ term: t, canonical }));
  }

  // 4) Aliases
  for (const a of aliases ?? []) {
    const canonical = a.canonical_slug as string;
    expandTerm(a.alias as string).forEach((t) => terms.push({ term: t, canonical }));
  }

  // 5) Greedy but safe-ish matching with spaced boundaries
  for (const { term, canonical } of terms) {
    if (q.includes(` ${term} `)) {
      return canonical;
    }
  }

  // 6) Fallback: single-word needles without space guards (helps for punctuation edge cases)
  for (const { term, canonical } of terms) {
    if (!term.includes(' ') && normalize(text).includes(term)) {
      return canonical;
    }
  }

  return null;
}

export async function resolvePolicyForSpecies(slug: string, orgSlug = process.env.ORG_SLUG || 'wrc-mn'): Promise<ResolvedPolicy> {
  const supa = supabaseAdmin();

  // A) Out-of-scope first (dog/cat/etc.)
  const { data: oos, error: oosErr } = await supa
    .from('out_of_scope_species')
    .select('public_message, referrals')
    .eq('slug', slug)
    .maybeSingle();

  if (oosErr) {
    console.error('[policy] out_of_scope lookup error:', oosErr);
  }
  if (oos) {
    return {
      type: 'out_of_scope',
      public_message: (oos as any).public_message ?? null,
      referrals: (oos as any).referrals ?? [],
    };
  }

  // B) Org-specific intake policy
  const { data: pol, error: polErr } = await supa
    .from('org_intake_policies')
    .select('intake_status, public_message, referrals')
    .eq('org_slug', orgSlug)
    .eq('species_slug', slug)
    .maybeSingle();

  if (polErr) {
    console.error('[policy] org_intake_policies lookup error:', polErr);
  }
  if (pol) {
    return {
      type: 'org_intake',
      status: (pol as any).intake_status as IntakeStatus,
      public_message: (pol as any).public_message ?? null,
      referrals: (pol as any).referrals ?? [],
    };
  }

  return null;
}
