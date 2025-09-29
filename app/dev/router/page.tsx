// app/dev/router/page.tsx
import "server-only";
import { createEmptyBus, VariableBus } from "@/types/variableBus";
import { routeDecision } from "@/lib/agent/router";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SearchParams = Record<string, string | string[] | undefined>;
const yes = (v?: string) => v === "1" || v === "true";

function read(sp: SearchParams, k: string, d = "") {
  const v = sp?.[k];
  if (Array.isArray(v)) return String(v[0] ?? d);
  return typeof v === "string" ? v : d;
}

export default async function RouterDev({ searchParams }: { searchParams: SearchParams }) {
  const bus: VariableBus = createEmptyBus("triage");

  // Quick param toggles (no DB calls, pure in-memory)
  bus.animal.species_slug = read(searchParams, "slug", "osprey");
  bus.animal.species_text = read(searchParams, "name", "Osprey");
  bus.animal.observed_condition = (read(searchParams, "cond") as any) || "unknown";
  bus.animal.situation = (read(searchParams, "sit") as any) || "unknown";
  bus.animal.age_class = (read(searchParams, "age") as any) || "unknown";
  bus.animal.contained = yes(read(searchParams, "contained"));
  bus.animal.aggressive_behavior = yes(read(searchParams, "aggr"));

  bus.exposure = {
    human_bite_possible: yes(read(searchParams, "bite")),
    bat_sleeping_area: yes(read(searchParams, "batroom")),
    notes: read(searchParams, "xnote"),
  };

  bus.species_flags = {
    dangerous: yes(read(searchParams, "danger")),
    rabies_vector: yes(read(searchParams, "rabies")),
    referral_required: yes(read(searchParams, "referral")),
    intervention_needed: yes(read(searchParams, "interv")),
    after_hours_allowed: yes(read(searchParams, "ah_allow")),
  };

  bus.org.after_hours = yes(read(searchParams, "ah"));
  bus.org.after_hours_rule = (read(searchParams, "ah_rule") as any) || "deflect";

  const routed = routeDecision(bus);

  const border = "#d1d5db";
  const pageTitle = "#f9fafb";
  const pageSub = "#cbd5e1";

  return (
    <main style={{ maxWidth: 1100, margin: "32px auto", padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: pageTitle, marginBottom: 8 }}>Dev — Router Heuristics</h1>
      <p style={{ color: pageSub, marginBottom: 16 }}>
        Pass flags in the query string to simulate cases (e.g., <code>?slug=osprey&referral=1&ah=1&ah_rule=deflect</code>).
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <section style={{ border: `1px solid ${border}`, background: "#fff", borderRadius: 8, padding: 12 }}>
          <h2 style={{ fontWeight: 700, marginBottom: 8 }}>Result</h2>
          <pre style={{ margin: 0, fontSize: 12 }}>{JSON.stringify(routed, null, 2)}</pre>
        </section>
        <section style={{ border: `1px solid ${border}`, background: "#fff", borderRadius: 8, padding: 12 }}>
          <h2 style={{ fontWeight: 700, marginBottom: 8 }}>Input Bus (subset)</h2>
          <pre style={{ margin: 0, fontSize: 12 }}>{JSON.stringify({
            species_flags: bus.species_flags,
            animal: {
              species_slug: bus.animal.species_slug,
              observed_condition: bus.animal.observed_condition,
              situation: bus.animal.situation,
              age_class: bus.animal.age_class,
              contained: bus.animal.contained,
              aggressive_behavior: bus.animal.aggressive_behavior,
            },
            exposure: bus.exposure,
            org: { after_hours: bus.org.after_hours, after_hours_rule: bus.org.after_hours_rule },
          }, null, 2)}</pre>
        </section>
      </div>
    </main>
  );
}
