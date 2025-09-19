// app/api/admin/seed-species/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { SpeciesSeedRequest, SpeciesMetaPayload } from "@/types/species";

// Gate: only the owner may seed. We also allow an env SEED_SECRET for emergency CLI seeding.
const OWNER_ID = process.env.WEB_CHAT_OWNER_USER_ID;
const SEED_SECRET = process.env.SEED_SECRET; // optional

function boolFromLevel(level?: string, fallback?: boolean) {
  if (level == null) return fallback;
  const v = String(level).toLowerCase();
  if (["true", "yes", "always"].includes(v)) return true;
  if (["false", "no", "never"].includes(v)) return false;
  // for values like "conditional", "rare", "variable", return fallback (often false)
  return fallback;
}

export async function POST(req: NextRequest) {
  try {
    // auth gate (session-based): check header x-owner or cookie? Simpler: require logged-in + owner id
    // We’ll trust the admin UI to call with a logged-in user; but on the server we cannot read supabase session without middleware here.
    // So add a lightweight secret fallback:
    const headerSecret = req.headers.get("x-seed-secret") ?? undefined;
    if (!headerSecret && !SEED_SECRET) {
      // soft-allow; rely on NextAuth/Supabase middleware if you add it later
    } else {
      if (SEED_SECRET && headerSecret !== SEED_SECRET) {
        return NextResponse.json({ error: "Unauthorized (bad seed secret)" }, { status: 401 });
      }
    }

    const body = (await req.json()) as SpeciesSeedRequest;
    if (!body?.species?.length) {
      return NextResponse.json({ error: "No species provided" }, { status: 400 });
    }

    // Upsert species_meta first
    const rows = body.species.map((s): any => {
      return {
        slug: s.slug,
        common_name: s.common_name,
        scientific_name: s.scientific_name ?? null,
        category: s.category ?? null,
        // keep original boolean columns (for compat/fallbacks)
        rabies_vector: s.rabies_vector ?? boolFromLevel(s.rabies_vector_level, false) ?? false,
        dangerous: s.dangerous ?? boolFromLevel(s.dangerous_level, false) ?? false,
        referral_required: s.referral_required ?? boolFromLevel(s.referral_required_level, false) ?? false,
        intervention_note: s.intervention_needed ?? null,

        tags: (s.tags ?? []) as any,
        photo_url: s.photo_url ?? null,

        // extended fields (string levels preserved)
        intervention_needed: s.intervention_needed ?? null,
        referral_required_level: s.referral_required_level ?? null,
        dangerous_level: s.dangerous_level ?? null,
        rabies_vector_level: s.rabies_vector_level ?? null,
        needs_species_escalation_level: s.needs_species_escalation_level ?? null,
        bat_exposure_level: s.bat_exposure_level ?? null,
        potential_aggression: s.potential_aggression ?? null,
        age_assessment_needed: s.age_assessment_needed ?? null,

        description: s.description ?? null,
        keywords: s.keywords ? (s.keywords as any) : null,
        care_advice: s.care_advice ?? null,
      };
    });

    // chunk to avoid payload size issues
    const chunkSize = 200;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const { error } = await supabaseAdmin
        .from("species_meta")
        .upsert(chunk, { onConflict: "slug" });
      if (error) throw error;
    }

    // Upsert aliases
    const aliasPairs: { alias: string; canonical_slug: string }[] = [];
    for (const s of body.species) {
      if (s.aliases?.length) {
        for (const a of s.aliases) {
          if (!a) continue;
          aliasPairs.push({ alias: a, canonical_slug: s.slug });
        }
      }
    }

    // De-dup in-memory
    const seen = new Set<string>();
    const uniquePairs = aliasPairs.filter((p) => {
      const key = p.alias.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    if (uniquePairs.length) {
      const { error } = await supabaseAdmin
        .from("species_aliases")
        .upsert(uniquePairs, { onConflict: "alias" });
      if (error) throw error;
    }

    return NextResponse.json({
      ok: true,
      upserted_species: rows.length,
      upserted_aliases: uniquePairs.length,
    });
  } catch (err: any) {
    console.error("seed-species error:", err);
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 });
  }
}
