// app/dev/tools/page.tsx
import "server-only";
import { referralSearch } from "@/lib/tools/referralSearch";
import { statusLookup } from "@/lib/tools/statusLookup";
import { instructionsFetch } from "@/lib/tools/instructionsFetch";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SearchParams = Record<string, string | string[] | undefined>;

function readParam(sp: SearchParams, key: string, fallback = "") {
  const v = sp?.[key];
  if (Array.isArray(v)) return String(v[0] ?? fallback);
  return typeof v === "string" ? v : fallback;
}

function section(style: React.CSSProperties = {}) {
  return { border: "1px solid #d1d5db", background: "#fff", borderRadius: 8, padding: 12, ...style };
}

export default async function ToolsDevPage({ searchParams }: { searchParams: SearchParams }) {
  const species_slug = readParam(searchParams, "species_slug");
  const decision = readParam(searchParams, "decision", "bring_in") as any;
  const zip = readParam(searchParams, "zip");

  const case_id = readParam(searchParams, "case_id");
  const phone = readParam(searchParams, "phone");
  const admit_date = readParam(searchParams, "admit_date");
  const species_text = readParam(searchParams, "species_text");

  // Run tools if inputs present
  const referral = species_slug ? await referralSearch({ species_slug, zip }) : null;
  const instructions = species_slug ? await instructionsFetch({ species_slug, decision }) : await instructionsFetch({ decision });
  const status = (case_id || phone || (species_text && admit_date))
    ? await statusLookup({ case_id, phone, species_text, admit_date })
    : null;

  return (
    <main style={{ maxWidth: 1100, margin: "32px auto", padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: "#f9fafb", marginBottom: 8 }}>Dev — Tool Stubs</h1>
      <p style={{ color: "#cbd5e1", marginBottom: 16 }}>
        Quick harness to exercise <code>referralSearch</code>, <code>instructionsFetch</code>, and <code>statusLookup</code>.
      </p>

      {/* Controls */}
      <form method="get" action="/dev/tools" style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr 1fr 1fr" }}>
        <div>
          <label htmlFor="species_slug" style={{ fontSize: 12, color: "#4b5563" }}>species_slug</label>
          <input id="species_slug" name="species_slug" defaultValue={species_slug} placeholder="e.g., osprey" style={{ width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6 }} />
        </div>
        <div>
          <label htmlFor="decision" style={{ fontSize: 12, color: "#4b5563" }}>decision</label>
          <select id="decision" name="decision" defaultValue={decision} style={{ width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6 }}>
            <option value="monitor">monitor</option>
            <option value="self_help">self_help</option>
            <option value="bring_in">bring_in</option>
            <option value="referral">referral</option>
            <option value="dispatch">dispatch</option>
            <option value="unknown">unknown</option>
          </select>
        </div>
        <div>
          <label htmlFor="zip" style={{ fontSize: 12, color: "#4b5563" }}>zip (optional)</label>
          <input id="zip" name="zip" defaultValue={zip} placeholder="e.g., 55414" style={{ width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6 }} />
        </div>

        <div style={{ alignSelf: "end" }}>
          <button type="submit" style={{ width: "100%", padding: "8px 12px", background: "#111827", color: "#fff", borderRadius: 6 }}>
            Run
          </button>
        </div>
      </form>

      {/* Status lookup controls */}
      <div style={{ marginTop: 16 }}>
        <form method="get" action="/dev/tools" style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(5, 1fr)" }}>
          <div>
            <label htmlFor="case_id" style={{ fontSize: 12, color: "#4b5563" }}>case_id</label>
            <input id="case_id" name="case_id" defaultValue={case_id} placeholder="e.g., WT-ABC123" style={{ width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6 }} />
          </div>
          <div>
            <label htmlFor="phone" style={{ fontSize: 12, color: "#4b5563" }}>phone</label>
            <input id="phone" name="phone" defaultValue={phone} placeholder="+15551234567" style={{ width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6 }} />
          </div>
          <div>
            <label htmlFor="species_text" style={{ fontSize: 12, color: "#4b5563" }}>species_text</label>
            <input id="species_text" name="species_text" defaultValue={species_text} placeholder="e.g., raccoon" style={{ width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6 }} />
          </div>
          <div>
            <label htmlFor="admit_date" style={{ fontSize: 12, color: "#4b5563" }}>admit_date</label>
            <input id="admit_date" name="admit_date" defaultValue={admit_date} placeholder="YYYY-MM-DD" style={{ width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6 }} />
          </div>
          <div style={{ alignSelf: "end" }}>
            <button type="submit" style={{ width: "100%", padding: "8px 12px", background: "#111827", color: "#fff", borderRadius: 6 }}>
              Lookup
            </button>
          </div>
        </form>
      </div>

      {/* Output */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 16 }}>
        <section style={section()}>
          <h2 style={{ fontWeight: 700, marginBottom: 8 }}>Referral</h2>
          <pre style={{ margin: 0, fontSize: 12, overflowX: "auto" }}>
            {JSON.stringify(referral, null, 2)}
          </pre>
        </section>
        <section style={section()}>
          <h2 style={{ fontWeight: 700, marginBottom: 8 }}>Instructions</h2>
          <pre style={{ margin: 0, fontSize: 12, overflowX: "auto" }}>
            {JSON.stringify(instructions, null, 2)}
          </pre>
        </section>
        <section style={section()}>
          <h2 style={{ fontWeight: 700, marginBottom: 8 }}>Patient Status</h2>
          <pre style={{ margin: 0, fontSize: 12, overflowX: "auto" }}>
            {JSON.stringify(status, null, 2)}
          </pre>
        </section>
      </div>
    </main>
  );
}
