import { createClient } from '@supabase/supabase-js';

export type PublicHealthContact = {
  id: string;
  region_type: 'zip' | 'county';
  region_value: string;
  name: string;
  phone: string | null;
  url: string | null;
  hours: string | null;
  notes: string | null;
  priority: number;
  active: boolean;
};

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE!;
  if (!url || !key) throw new Error('Missing Supabase env (URL or SERVICE_ROLE)');
  return createClient(url, key, { auth: { persistSession: false } });
}

async function findBy(
  region_type: 'zip' | 'county',
  region_value: string
): Promise<PublicHealthContact | null> {
  const supabase = admin();
  const { data, error } = await supabase
    .from('public_health_contacts')
    .select('*')
    .eq('active', true)
    .eq('region_type', region_type)
    .eq('region_value', region_value)
    .order('priority', { ascending: true })
    .order('name', { ascending: true })
    .limit(1);

  if (error) throw error;
  return data && data.length ? (data[0] as PublicHealthContact) : null;
}

/**
 * Lookup order:
 * 1) zip (if provided)
 * 2) county (fallback if provided)
 */
export async function publicHealthLookup(args: {
  zip?: string;
  county?: string;
}): Promise<{ best: PublicHealthContact | null; via: 'zip' | 'county' | 'none' }> {
  if (args.zip) {
    const hit = await findBy('zip', args.zip);
    if (hit) return { best: hit, via: 'zip' };
  }
  if (args.county) {
    const hit = await findBy('county', args.county);
    if (hit) return { best: hit, via: 'county' };
  }
  return { best: null, via: 'none' };
}
