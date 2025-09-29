// app/dev/agent/page.tsx
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { createEmptyBus, mapSpeciesMetaToFlags, VariableBus, Mode } from "@/types/variableBus";
import { runOptionA } from "@/lib/agent/runOptionA";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SearchParams = Record<string, string | string[] | undefined>;

function readParam(sp: SearchParams, key: string, fallback = "") {
  const v = sp?.[key];
  if (Array.isArray(v)) return String(v[0] ?? fallback);
  return typeof v === "string" ? v : fallback;
}

async function fetchSpeciesRow(slug: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !service || !slug) return null;
  const supabase = createClient(url, service, { auth: { persistSession: false } });
  const { data } = await supabase.from("species_meta_lookup").select("*").eq("slug", slug).maybeSingle();
  return data ?? null;
}

export default async function AgentDevPage({ searchParams }: { searchParams: SearchParams }) {
  const mode = (readParam(searchParams, "mode", "triage") as Mode);
  const species_slug = readParam(searchParams, "species_slug").trim() || "";
  const decision = readParam(searchParams, "decision", "unknown") as any;

  // patient lookup inputs (optional)
  const case_id = readParam(searchParams, "case_id");
  const phone = readParam(searchParams, "phone");
  const admit_date = readParam(searchParams, "admit_date");
  const species_text = readParam(searchParams, "species_text");

  // Build the bus
  const bus: VariableBus = createEmptyBus(mode);
  if (species_slug) {
    const row = await fetchSpeciesRow(species_slug);
    if (row) {
      bus.animal.species_slug = species_slug;
      bus.animal.species_text = row.common_name ?? species_slug;
      bus.species_flags = mapSpeciesMetaToFlags({
        dangerous: row.dangerous,
        rabies_vector: row.rabies_vector,
        referral_required: row.referral_required,
        intervention_needed: row.intervention_needed as any,
        after_hours_allowed: row.after_hours_allowed,
      });
    }
  }

  // Optionally seed decision (triage)
  if (mode === "triage") {
    bus.triage = { ...(bus.triage ?? {}), decision };
  }

  // Optionally seed patient lookup identifiers
  if (mode === "patient_status") {
    bus.patient_status = {
      ...(bus.patient_status ?? {}),
      case_id: case_id || undefined,
      lookup_identifiers: {
        species_text: species_text || undefined,
        admit_date: admit_date || undefined,
      },
    };
    bus.caller = { ...bus.caller, roles: bus.caller.roles ?? [], phone: phone || undefined };
  }

  const result = await runOptionA(bus);

  // Styles
  const border = "#d1d5db";
  const pageTitle = "#f9fafb";
  const pageSub = "#cbd5e1";

  return (
    <main style={{ maxWidth: 1100, margin: "32px auto", padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: pageTitle, marginBottom: 8 }}>Dev — Agent Runner (Option A)</h1>
      <p style={{ color: pageSub, marginBottom: 16 }}>
        Build a Variable Bus and run the single-agent orchestration. Supply <code>mode</code>, <code>species_slug</code>, and optional fields.
      </p>

      <form method="get" action="/dev/agent" style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(6, 1fr)" }}>
        <div>
          <label htmlFor="mode" style={{ fontSize: 12, color: "#4b5563" }}>mode</label>
          <select id="mode" name="mode" defaultValue={mode} style={{ width: "100%", padding: "8px 10px", border: `1px solid ${border}`, borderRadius: 6 }}>
            <option value="triage">triage</option>
            <option value="patient_status">patient_status</option>
            <option value="referral">referral</option>
          </select>
        </div>
        <div>
          <label htmlFor="species_slug" style={{ fontSize: 12, color: "#4b5563" }}>species_slug</label>
          <input id="species_slug" name="species_slug" defaultValue={species_slug} placeholder="e.g., osprey" style={{ width: "100%", padding: "8px 10px", border: `1px solid ${border}`, borderRadius: 6 }} />
        </div>
        <div>
          <label htmlFor="decision" style={{ fontSize: 12, color: "#4b5563" }}>triage decision (optional)</label>
          <select id="decision" name="decision" defaultValue={decision} style={{ width: "100%", padding: "8px 10px", border: `1px solid ${border}`, borderRadius: 6 }}>
            <option value="unknown">(auto)</option>
            <option value="monitor">monitor</option>
            <option value="self_help">self_help</option>
            <option value="bring_in">bring_in</option>
            <option value="referral">referral</option>
            <option value="dispatch">dispatch</option>
          </select>
        </div>
        <div>
          <label htmlFor="case_id" style={{ fontSize: 12, color: "#4b5563" }}>case_id (patient)</label>
          <input id="case_id" name="case_id" defaultValue={case_id} placeholder="WT-ABC123" style={{ width: "100%", padding: "8px 10px", border: `1px solid ${border}`, borderRadius: 6 }} />
        </div>
        <div>
          <label htmlFor="phone" style={{ fontSize: 12, color: "#4b5563" }}>phone (patient)</label>
          <input id="phone" name="phone" defaultValue={phone} placeholder="+15551234567" style={{ width: "100%", padding: "8px 10px", border: `1px solid ${border}`, borderRadius: 6 }} />
        </div>
        <div>
          <label htmlFor="admit_date" style={{ fontSize: 12, color: "#4b5563" }}>admit_date (patient)</label>
          <input id="admit_date" name="admit_date" defaultValue={admit_date} placeholder="YYYY-MM-DD" style={{ width: "100%", padding: "8px 10px", border: `1px solid ${border}`, borderRadius: 6 }} />
        </div>
        <div>
          <label htmlFor="species_text" style={{ fontSize: 12, color: "#4b5563" }}>species_text (patient)</label>
          <input id="species_text" name="species_text" defaultValue={species_text} placeholder="e.g., raccoon" style={{ width: "100%", padding: "8px 10px", border: `1px solid ${border}`, borderRadius: 6 }} />
        </div>
        <div style={{ alignSelf: "end" }}>
          <button type="submit" style={{ width: "100%", padding: "8px 12px", background: "#111827", color: "#fff", borderRadius: 6 }}>
            Run
          </button>
        </div>
      </form>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
        <section style={{ border: `1px solid ${border}`, background: "#fff", borderRadius: 8, padding: 12 }}>
          <h2 style={{ fontWeight: 700, marginBottom: 8 }}>Agent Result</h2>
          <pre style={{ margin: 0, fontSize: 12, overflowX: "auto" }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        </section>
        <section style={{ border: `1px solid ${border}`, background: "#fff", borderRadius: 8, padding: 12 }}>
          <h2 style={{ fontWeight: 700, marginBottom: 8 }}>Input Bus (for reference)</h2>
          <pre style={{ margin: 0, fontSize: 12, overflowX: "auto" }}>
            {JSON.stringify(bus, null, 2)}
          </pre>
        </section>
      </div>
    </main>
  );
}
