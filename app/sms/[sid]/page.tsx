// app/sms/[sid]/page.tsx
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Central Time formatter (SSR-safe)
const ctFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Chicago",
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
  timeZoneName: "short", // CST/CDT
});
function fmtCT(iso: string) {
  const d = new Date(iso);
  return ctFmt.format(d);
}

function getEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const service = process.env.SUPABASE_SERVICE_ROLE!;
  if (!url || !anon || !service) throw new Error("Missing Supabase env vars.");
  return { url, anon, service };
}

async function requireSession(url: string, anon: string) {
  const cookieStore = await cookies(); // Next 15: cookies() is async
  const supabase = createServerClient(url, anon, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      // no-ops in server components to avoid Next.js cookies mutation error
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
  payload: any | null;
  created_at: string;
};

function getAdminClient(url: string, service: string) {
  return createClient(url, service, { auth: { persistSession: false } });
}

async function fetchBySid(url: string, service: string, sid: string) {
  const supabase = getAdminClient(url, service);

  const { data, error } = await supabase
    .from("sms_events")
    .select(
      "id,message_sid,to_number,from_number,message_status,error_code,error_message,payload,created_at"
    )
    .eq("message_sid", sid)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const events = (data || []) as SmsEvent[];
  // heuristics for header
  const latest = events[0];
  const to = latest?.to_number ?? "—";
  const from = latest?.from_number ?? "—";
  return { events, to, from };
}

function StatusBadge({ status }: { status: string | null }) {
  const s = (status || "").toLowerCase();
  let bg = "#e5e7eb",
    fg = "#111827";
  if (s === "delivered") {
    bg = "#d1fae5";
    fg = "#065f46";
  } else if (s === "failed" || s === "undelivered") {
    bg = "#fee2e2";
    fg = "#991b1b";
  } else if (s === "sent" || s === "queued" || s === "accepted") {
    bg = "#dbeafe";
    fg = "#1e40af";
  } else if (s === "receiving" || s === "received") {
    bg = "#ede9fe";
    fg = "#5b21b6";
  }
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        background: bg,
        color: fg,
        whiteSpace: "nowrap",
      }}
    >
      {status || "—"}
    </span>
  );
}

function explainTwilioError(code?: string | null) {
  switch (code) {
    case "30003":
      return "Unreachable handset (off/out of service).";
    case "30004":
      return "Blocked by carrier or user.";
    case "30005":
      return "Unknown or inactive number.";
    case "30006":
      return "Landline or unreachable route.";
    case "30007":
      return "Carrier filter (spam).";
    case "30034":
      return "A2P 10DLC registration/campaign issue.";
    default:
      return null;
  }
}

export default async function SmsDetailPage({
  params,
}: {
  params: { sid: string };
}) {
  const { url, anon, service } = getEnv();
  await requireSession(url, anon);

  const sid = params.sid;
  const { events, to, from } = await fetchBySid(url, service, sid);

  // palette
  const pageTitle = "#f9fafb";
  const pageSub = "#cbd5e1";
  const border = "#d1d5db";
  const cardText = "#111827";
  const subtle = "#6b7280";

  return (
    <main style={{ maxWidth: 900, margin: "32px auto", padding: 24 }}>
      {/* Header */}
      <div style={{ marginBottom: 12 }}>
        <Link
          href="/sms"
          style={{ color: "#93c5fd", textDecoration: "underline", display: "inline-block", marginBottom: 8 }}
        >
          ← Back to SMS Log
        </Link>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: pageTitle, margin: 0 }}>
          Delivery History
        </h1>
        <p style={{ color: pageSub, marginTop: 4 }}>
          Message SID <span style={{ fontFamily: "ui-monospace, Menlo, monospace" }}>{sid}</span> • Times shown in Central Time
        </p>
      </div>

      {/* Summary card */}
      <div
        style={{
          border: `1px solid ${border}`,
          background: "#ffffff",
          color: cardText,
          borderRadius: 8,
          padding: 16,
          marginBottom: 16,
          display: "grid",
          gap: 8,
        }}
      >
        <div><strong>To</strong> {to || "—"}</div>
        <div><strong>From</strong> {from || "—"}</div>
      </div>

      {/* Events table */}
      <div
        style={{
          border: `1px solid ${border}`,
          background: "#ffffff",
          color: cardText,
          borderRadius: 8,
          overflowX: "auto",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead style={{ background: "#e5e7eb" }}>
            <tr>
              {["Time (CT)", "Status", "Error", "Details"].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: 12,
                    textAlign: "left",
                    borderBottom: `1px solid ${border}`,
                    fontWeight: 700,
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {events.map((e) => {
              const errTip = explainTwilioError(e.error_code);
              return (
                <tr key={e.id} style={{ borderTop: `1px solid ${border}`, verticalAlign: "top" }}>
                  <td style={{ padding: 12, whiteSpace: "nowrap" }}>
                    {fmtCT(e.created_at)}
                  </td>
                  <td style={{ padding: 12 }}>
                    <StatusBadge status={e.message_status} />
                  </td>
                  <td style={{ padding: 12 }}>
                    {e.error_code ? (
                      <div>
                        <div
                          style={{
                            fontFamily:
                              "ui-monospace, SFMono-Regular, Menlo, monospace",
                            fontSize: 12,
                            color: "#111827",
                          }}
                        >
                          Code {e.error_code}
                        </div>
                        {errTip ? (
                          <div style={{ fontSize: 12, color: subtle }}>{errTip}</div>
                        ) : null}
                        {e.error_message ? (
                          <div style={{ fontSize: 12, color: subtle }}>
                            {e.error_message}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td style={{ padding: 12 }}>
                    {e.payload ? (
                      <details>
                        <summary style={{ cursor: "pointer", color: "#1e40af" }}>
                          Payload
                        </summary>
                        <pre
                          style={{
                            marginTop: 8,
                            background: "#f9fafb",
                            border: `1px solid ${border}`,
                            padding: 12,
                            borderRadius: 6,
                            overflowX: "auto",
                            fontSize: 12,
                          }}
                        >
{JSON.stringify(e.payload, null, 2)}
                        </pre>
                      </details>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}
            {events.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: 16, textAlign: "center", color: subtle }}>
                  No events for this SID.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <p style={{ color: pageSub, fontSize: 12, marginTop: 8 }}>
        Events are shown newest first.
      </p>
    </main>
  );
}
