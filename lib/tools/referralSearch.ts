// lib/tools/referralSearch.ts
import { createClient } from "@supabase/supabase-js";

export type ReferralInput = {
  species_slug: string;
  zip?: string;
};

export type ReferralResult = {
  needed: boolean;
  target: {
    name: string;
    phone?: string;
    url?: string;
    coverage?: string;
    directions_url?: string;
  } | null;
  source: "rules+species_meta" | "fallback";
};

function mapsUrlFor(name: string) {
  const q = encodeURIComponent(name);
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

/**
 * Simple rule:
 * - If species category is 'raptor' OR species_meta.referral_required = true → route to TRC.
 * - Else → return null target (WRC handles).
 */
export async function referralSearch(
  input: ReferralInput
): Promise<ReferralResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE;

  let category: string | undefined;
  let referral_required = false;

  if (url && service) {
    try {
      const supabase = createClient(url, service, { auth: { persistSession: false } });
      const { data } = await supabase
        .from("species_meta_lookup")
        .select("category, referral_required")
        .eq("slug", input.species_slug)
        .maybeSingle();
      if (data) {
        category = data.category ?? undefined;
        referral_required = !!data.referral_required;
      }
    } catch {
      // swallow; we'll use fallback rules
    }
  }

  const isRaptor = (category ?? "").toLowerCase() === "raptor";
  const needsReferral = referral_required || isRaptor;

  if (!needsReferral) {
    return { needed: false, target: null, source: "rules+species_meta" };
  }

  // The Raptor Center (TRC) default handoff
  const TRC = {
    name: "The Raptor Center (TRC)",
    phone: "612-624-4745",
    url: "https://raptor.umn.edu/",
    coverage: "Raptors: admissions daily (8–5); call first.",
  };

  return {
    needed: true,
    target: {
      ...TRC,
      directions_url: mapsUrlFor(TRC.name),
    },
    source: "rules+species_meta",
  };
}
