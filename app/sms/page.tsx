// app/sms/page.tsx
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE;
  const missing: string[] = [];
  if (!url) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!anon) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!service) missing.push("SUPABASE_SERVICE_ROLE");
  return { url, anon, service, missing };
}

function readParam(sp: Record<string, string | string[] | undefined>, key: string, fallback = "") {
  const v = sp?.[key];
  if (Array.isArray(v)) return String(v[0] ?? fallback);
  return typeof v === "string" ? v : fallback;
}

function getAdminClient(url: string, service: string) {
  return createClient(url, service, { auth: { persistSession: false } });
}

async function requireSession(url: string, anon: string) {
  const cookieStore = cookies();
  const supabase = createServerClient(url, anon, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      // no-ops in server components (prevents “Cookies can only be modified…” error)
      set() {},
      remove() {},
    },
  });
  const { data } = await supabase.auth.getUser();
  if (!data?.user) redirect("/auth");
}

type SmsEvent = {
  id: number;
  message_sid: string | null;
  to_number: string | null;
  from_number: string | null;
  message_status: string | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
};

type SearchParams = Record<string, string | string[] | undefined>;

async function fetchEvents(url: string, service: string, sp: SearchParams) {
  const supabase = getAdminClient(url, service);

  const q = readParam(sp, "q").trim();
  const status = readParam(sp, "message_status").trim().toLowerCase();
  const limitNum = Math.min(Math.max(parseInt(readParam(sp, "limit", "200"), 10) || 200, 1), 1000);

  let query = supabase
    .from("sms_events")
    .select("id,message_sid,to_number,from_number,message_status,error_code,error_message,created_at")
    .order("created_at", { ascending: false })
    .limit(limitNum);

  if (status) query = query.eq("message_status", status);
  if (q) {
    query = query.or(
      [
        `message_sid.ilike.%${q}%`,
        `to_number.ilike.%${q}%`,
        `from_number.ilike.%${q}%`,
      ].join(",")
    );
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as SmsEvent[];
}

function StatusBadge({ status }: { status: string | null }) {
  return <span>{status || "—"}</span>;
}

function explainTwilioError(code?: string | null) {
  switch (code) {
    case "30003": return "Unreachable handset (off/out of service).";
    case "30004": return "Blocked by carrier or user.";
    case "30005": return "Unknown or inactive number.";
    case "30006": return "Landline or unreachable route.";
    case "30007": return "Carrier filter (spam).";
    case "30034": return "A2P 10DLC registration/campaign issue.";
    default: return null;
  }
}

export default async function SmsLogPage({ searchParams }: { searchParams: SearchParams }) {
  const { url, anon, service, missing } = getEnv();

  if (missing.length > 0) {
    return (
      <main style={{ maxWidth: 1024, margin: "32px auto", padding: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 16 }}>SMS Delivery Log</h1>
        <div style={{ padding: 12, border: "1px solid #fecaca", background: "#fef2f2" }}>
          Missing required environment variables: <b>{missing.join(", ")}</b>.
        </div>
      </main>
    );
  }

  await requireSession(url!, anon!);
  const events = await fetchEvents(url!, service!, searchParams);

  const q = readParam(searchParams, "q");
  const message_status = readParam(searchParams, "message_status");
  const limit = readParam(searchParams, "limit", "200");

  return (
    <main style={{ maxWidth: 1024, margin: "32px auto", padding: 24 }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 4 }}>SMS Delivery Log</h1>
        <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 16 }}>
          Search and inspect delivery receipts from Twilio.
        </p>
      </div>

      {/* Filters */}
      <div style={{ border: "1px solid #e5e7eb", background: "#fff", padding: 16, marginBottom: 16 }}>
        <form method="get" action="/sms" style={{ display: "grid", gap: 12, gridTemplateColumns: "2fr 1fr 1fr 1fr" }}>
          <div>
            <label htmlFor="q" style={{ display: "block", fontSize: 12, color: "#6b7280" }}>
              Search (SID, To, From)
            </label>
            <input id="q" name="q" defaultValue={q} placeholder="e.g., SM..., +1555..." style={{ width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 4 }} />
          </div>
          <div>
            <label htmlFor="message_status" style={{ display: "block", fontSize: 12, color: "#6b7280" }}>
              Status
            </label>
            <select id="message_status" name="message_status" defaultValue={message_status} style={{ width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 4 }}>
              <option value="">(any)</option>
              <option value="accepted">accepted</option>
              <option value="queued">queued</option>
              <option value="sending">sending</option>
              <option value="sent">sent</option>
              <option value="delivered">delivered</option>
              <option value="undelivered">undelivered</option>
              <option value="failed">failed</option>
              <option value="receiving">receiving</option>
              <option value="received">received</option>
            </select>
          </div>
          <div>
            <label htmlFor="limit" style={{ display: "block", fontSize: 12, color: "#6b7280" }}>
              Limit
            </label>
            <input id="limit" name="limit" defaultValue={limit} style={{ width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 4 }} />
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "end" }}>
            <button type="submit" style={{ flex: 1, padding: "8px 12px", background: "#111827", color: "#fff", borderRadius: 4 }}>
              Apply
            </button>
            <a href="/sms" style={{ flex: 1, padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 4, textAlign: "center", fontSize: 14 }}>
              Clear
            </a>
          </div>
        </form>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", background: "#fff" }}>
        <table style={{ width: "100%", fontSize: 14, borderCollapse: "collapse" }}>
          <thead style={{ background: "#f9fafb", textAlign: "left" }}>
            <tr>
              <th style={{ padding: 12 }}>Time</th>
              <th style={{ padding: 12 }}>SID</th>
              <th style={{ padding: 12 }}>To</th>
              <th style={{ padding: 12 }}>From</th>
              <th style={{ padding: 12 }}>Status</th>
              <th style={{ padding: 12 }}>Error</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => {
              const errTip = explainTwilioError(e.error_code);
              return (
                <tr key={e.id} style={{ borderTop: "1px solid #e5e7eb", verticalAlign: "top" }}>
                  <td style={{ padding: 12, whiteSpace: "nowrap" }}>{new Date(e.created_at).toLocaleString()}</td>
                  <td style={{ padding: 12, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{e.message_sid || "—"}</td>
                  <td style={{ padding: 12 }}>{e.to_number || "—"}</td>
                  <td style={{ padding: 12 }}>{e.from_number || "—"}</td>
                  <td style={{ padding: 12 }}><StatusBadge status={e.message_status} /></td>
                  <td style={{ padding: 12 }}>
                    {e.error_code ? (
                      <div>
                        <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12 }}>Code {e.error_code}</div>
                        {errTip ? <div style={{ fontSize: 12, color: "#6b7280" }}>{errTip}</div> : null}
                        {e.error_message ? <div style={{ fontSize: 12, color: "#6b7280" }}>{e.error_message}</div> : null}
                      </div>
                    ) : "—"}
                  </td>
                </tr>
              );
            })}
            {events.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 16, textAlign: "center", color: "#6b7280" }}>No events found.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <p style={{ color: "#6b7280", fontSize: 12 }}>Showing up to {limit} most recent events.</p>
    </main>
  );
}
