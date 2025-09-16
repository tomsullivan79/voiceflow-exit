// app/sms/[sid]/page.tsx
import "server-only";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !serviceKey) throw new Error("Missing Supabase env vars.");
  return createClient(url, serviceKey, { auth: { persistSession: false } });
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

export default async function SmsSidPage({
  params,
}: { params: { sid: string } }) {
  const supabase = getAdminClient();
  const sid = params.sid;

  const { data: events, error } = await supabase
    .from("sms_events")
    .select("*")
    .eq("message_sid", sid)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const latest = events?.[0];

  return (
    <div className="mx-auto max-w-4xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Delivery History</h1>
        <Link className="text-sm text-blue-600 underline" href="/sms">
          ← Back to SMS Log
        </Link>
      </div>

      <div className="rounded border p-4">
        <div className="text-sm text-gray-600">Message SID</div>
        <div className="font-mono">{sid}</div>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <div className="text-sm text-gray-600">To</div>
            <div>{latest?.to_number ?? "—"}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">From</div>
            <div>{latest?.from_number ?? "—"}</div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-medium">Events</h2>
        <div className="rounded border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="p-2">Time</th>
                <th className="p-2">Status</th>
                <th className="p-2">Error</th>
                <th className="p-2">Details</th>
              </tr>
            </thead>
            <tbody>
              {(events || []).map((e) => {
                const errTip = explainTwilioError(e.error_code);
                return (
                  <tr key={e.id} className="border-t align-top">
                    <td className="p-2 whitespace-nowrap">
                      {new Date(e.created_at).toLocaleString()}
                    </td>
                    <td className="p-2">{e.message_status ?? "—"}</td>
                    <td className="p-2">
                      {e.error_code ? (
                        <div className="space-y-0.5">
                          <div className="font-mono text-xs">Code {e.error_code}</div>
                          {errTip ? <div className="text-xs text-gray-600">{errTip}</div> : null}
                          {e.error_message ? <div className="text-xs text-gray-600">{e.error_message}</div> : null}
                        </div>
                      ) : "—"}
                    </td>
                    <td className="p-2">
                      <details>
                        <summary className="cursor-pointer text-blue-700 underline">Payload</summary>
                        <pre className="mt-2 overflow-auto rounded bg-gray-50 p-2 text-xs">
                          {JSON.stringify(e.payload ?? {}, null, 2)}
                        </pre>
                      </details>
                    </td>
                  </tr>
                );
              })}
              {(!events || events.length === 0) ? (
                <tr>
                  <td className="p-4 text-center text-gray-500" colSpan={4}>
                    No events recorded for this SID.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
