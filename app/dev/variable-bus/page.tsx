// app/dev/variable-bus/page.tsx
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { createEmptyBus, mapSpeciesMetaToFlags, VariableBus, Mode } from "@/types/variableBus";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SearchParams = Record<string, string | string[] | undefined>;

function getEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE;
  const missing: string[] = [];
  if (!url) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!service) missing.push("SUPABASE_SERVICE_ROLE");
  return { url, service, missing };
}

function readParam(sp: SearchParams, key: string, fallback = "") {
  const v = sp?.[key];
  if (Array.isArray(v)) return String(v[0] ?? fallback);
  return typeof v === "string" ? v : fallback;
}

async function fetchSpeciesRow(url: string, service: string, slug: string) {
  const supabase = createClient(url, service, { auth: { persistSession: false } });
  // Try lookup view first; fall back to base table if needed
  let row: any | null = null;

  // Attempt species_meta_lookup
  let { data, error } = await supabase
    .from("species_meta_lookup")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (!error && data) row = data;

  if (!row) {
    const res = await supabase.from("species_meta").select("*").eq("slug", slug).maybeSingle();
    if (!res.error && res.data) row = res.data;
  }
  return row;
}

function hstack(style: React.CSSProperties = {}) {
  return { display: "flex", gap: 8, alignItems: "center", ...style };
}

export default async function VariableBusDev({ searchParams }: { searchParams: SearchParams }) {
  const { url, service, missing } = getEnv();

  const species_slug = readParam(searchParams, "species_slug").trim();
  const modeParam = (readParam(searchParams, "mode", "triage") as Mode);
  const supportive = readParam(searchParams, "supportive", "") === "1";

  // Build bus
  const bus: VariableBus = createEmptyBus(modeParam);
  if (supportive) bus.tone_overlay = "supportive";

  let speciesRow: any | null = null;
  if (species_slug && url && service) {
    speciesRow = await fetchSpeciesRow(url, service, species_slug);
    if (speciesRow) {
      bus.animal.species_slug = species_slug;
      bus.animal.species_text = speciesRow.common_name ?? species_slug;
      bus.species_flags = mapSpeciesMetaToFlags({
        dangerous: speciesRow.dangerous,
        rabies_vector: speciesRow.rabies_vector,
        referral_required: speciesRow.referral_required,
        intervention_needed: speciesRow.intervention_needed as any, // 'never'|'sometimes'|'always' supported
        after_hours_allowed: speciesRow.after_hours_allowed,
      });
    }
  }

  // Styles
  const border = "#d1d5db";
  const pageTitle = "#f9fafb";
  const pageSub = "#cbd5e1";
  const cardText = "#111827";

  return (
    <main style={{ maxWidth: 1100, margin: "32px auto", padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: pageTitle, marginBottom: 8 }}>
        Dev — Variable Bus Inspector
      </h1>
      <p style={{ color: pageSub, marginBottom: 16 }}>
        Enter a <code>species_slug</code> to load flags from Supabase and view the assembled Variable Bus.
      </p>

      {missing?.length ? (
        <div style={{ padding: 12, border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", marginBottom: 16 }}>
          Missing env vars: <b>{missing.join(", ")}</b>
        </div>
      ) : null}

      <form method="get" action="/dev/variable-bus" style={{ ...hstack({ marginBottom: 16, flexWrap: "wrap" }) }}>
        <div style={hstack()}>
          <label htmlFor="species_slug" style={{ fontSize: 12, color: "#4b5563" }}>species_slug</label>
          <input
            id="species_slug"
            name="species_slug"
            defaultValue={species_slug}
            placeholder="e.g., raccoon, big-brown-bat, osprey"
            style={{ padding: "8px 10px", border: `1px solid ${border}`, borderRadius: 6, minWidth: 320, color: cardText }}
          />
        </div>

        <div style={hstack()}>
          <label htmlFor="mode" style={{ fontSize: 12, color: "#4b5563" }}>mode</label>
          <select id="mode" name="mode" defaultValue={modeParam}
            style={{ padding: "8px 10px", border: `1px solid ${border}`, borderRadius: 6, color: cardText }}>
            <option value="triage">triage</option>
            <option value="patient_status">patient_status</option>
            <option value="referral">referral</option>
          </select>
        </div>

        <div style={hstack()}>
          <label htmlFor="supportive" style={{ fontSize: 12, color: "#4b5563" }}>supportive tone</label>
          <input type="checkbox" id="supportive" name="supportive" value="1" defaultChecked={supportive} />
        </div>

        <button type="submit" style={{ padding: "8px 12px", background: "#111827", color: "#fff", borderRadius: 6 }}>
          Update
        </button>
      </form>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <section style={{ border: `1px solid ${border}`, background: "#fff", borderRadius: 8, padding: 12 }}>
          <h2 style={{ fontWeight: 700, marginBottom: 8 }}>Variable Bus</h2>
          <pre style={{ margin: 0, fontSize: 12, overflowX: "auto" }}>{JSON.stringify(bus, null, 2)}</pre>
        </section>

        <section style={{ border: `1px solid ${border}`, background: "#fff", borderRadius: 8, padding: 12 }}>
          <h2 style={{ fontWeight: 700, marginBottom: 8 }}>Species Row (from DB)</h2>
          {speciesRow ? (
            <pre style={{ margin: 0, fontSize: 12, overflowX: "auto" }}>{JSON.stringify(speciesRow, null, 2)}</pre>
          ) : (
            <div style={{ color: "#4b5563" }}>No species loaded yet.</div>
          )}
        </section>
      </div>
    </main>
  );
}
