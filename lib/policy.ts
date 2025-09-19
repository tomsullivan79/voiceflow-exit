// lib/policy.ts
import { supabaseAdmin } from '@/lib/supabaseServer';

export type IntakeStatus = 'accept' | 'conditional' | 'not_supported';

export type PolicyResult =
  | { type: 'out_of_scope'; public_message: string; referrals: any[] }
  | { type: 'org_intake'; status: IntakeStatus; public_message: string | null; referrals: any[] }
  | null;

/**
 * Resolve policy for a canonical wildlife species slug (e.g., "raccoon").
 * Returns either org intake policy, an out-of-scope policy, or null if none.
 */
export async function resolvePolicyForSpecies(
  speciesSlug: string,
  orgSlug = process.env.ORG_SLUG || 'wrc-mn'
): Promise<PolicyResult> {
  const supabase = supabaseAdmin();

  // 1) out-of-scope (dog/cat/etc.)
  const { data: oos, error: oosErr } = await supabase
    .from('out_of_scope_species')
    .select('public_message, referrals')
    .eq('slug', speciesSlug)
    .maybeSingle();
  if (!oosErr && oos) {
    return {
      type: 'out_of_scope',
      public_message: oos.public_message,
      referrals: (oos.referrals as any[]) ?? [],
    };
  }

  // 2) org intake policy for a recognized wildlife species
  const { data: pol, error: polErr } = await supabase
    .from('org_intake_policies')
    .select('intake_status, public_message, referrals')
    .eq('org_slug', orgSlug)
    .eq('species_slug', speciesSlug)
    .maybeSingle();

  if (!polErr && pol) {
    return {
      type: 'org_intake',
      status: pol.intake_status as IntakeStatus,
      public_message: pol.public_message ?? null,
      referrals: (pol.referrals as any[]) ?? [],
    };
  }

  return null;
}

/**
 * Ultra-light species matcher:
 *  - loads slugs + common_names + aliases once per request,
 *  - returns the first canonical slug found in the text (word-boundary match).
 * This is intentionally simple and fast to unblock the banner; we can swap later.
 */
export async function detectSpeciesSlugFromText(
  text: string
): Promise<string | null> {
  const q = (text || '').toLowerCase();
  if (!q) return null;

  const supabase = supabaseAdmin();

  // pull terms
  const [{ data: species }, { data: aliases }] = await Promise.all([
    supabase.from('species_meta').select('slug, common_name'),
    supabase.from('species_aliases').select('alias, canonical_slug'),
  ]);

  const terms: Array<{ term: string; canonical: string }> = [];

  (species ?? []).forEach((s: any) => {
    if (s.slug) terms.push({ term: String(s.slug).toLowerCase(), canonical: s.slug });
    if (s.common_name) terms.push({ term: String(s.common_name).toLowerCase(), canonical: s.slug });
  });
  (aliases ?? []).forEach((a: any) => {
    if (a.alias && a.canonical_slug) {
      terms.push({ term: String(a.alias).toLowerCase(), canonical: a.canonical_slug });
    }
  });

  // check simple word-boundary matches, longest terms first (avoid "cat" inside "bobcat")
  terms.sort((a, b) => b.term.length - a.term.length);

  for (const { term, canonical } of terms) {
    if (!term) continue;
    // word boundary: handles spaces/underscore/hyphen variants
    const pattern = new RegExp(`(?:^|\\b|_|-)${
      escapeRegExp(term)
    }(?:\\b|_|-|s\\b|$)`, 'i');
    if (pattern.test(q)) return canonical;
  }

  return null;
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
