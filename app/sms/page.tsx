// app/sms/page.tsx
import "server-only";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic"; // always render fresh
export const runtime = "nodejs";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE!;
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
  created_at: string;
};

type SearchParams = {
  q?: string;         // matches SID, to, from
  status?: string;    // Delivered, Undelivered, etc.
  limit?: string;     // default 200
};

async function fetchEvents(searchParams: SearchParams) {
  const supabase = getAdminClient();

  const q = (searchParams.q || "").trim();
  const status = (searchParams.status || "").trim();
  const limit = Math.min(Math.max(parseInt(searchParams.limit || "200", 10) || 200, 1), 1000);

  let query = supabase
    .from("sms_events")
    .select("id,message_sid,to_number,from_number,message_status,error_code,error_message,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status) {
    query = query.eq("message_status", status);
  }
  if (q) {
    // Basic contains filters for SID/To/From
    // (Supabase OR filters use .or() with ‘,’-separated clauses)
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
  const s = (status || "").toLowerCase();
  let cls =
    "inline-block rounded px-2 py-0.5 text-xs border";
  if (s === "delivered") cls += " bg-green-50 text-green-700 border-green-200";
  else if (s === "undelivered" || s === "failed") cls += " bg-red-50 text-red-700 border-red-200";
  else if (s === "sent" || s === "queued" || s === "accepted") cls += " bg-blue-50 text-blue-700 border-blue-200";
  else if (s === "receiving" || s === "received") cls += " bg-purple-50 text-purple-700 border-purple-200";
  else cls += " bg-gray-50 text-gray-700 border-gray-200";
  return <span className={cls}>{status || "—"}</span>;
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

export default async function SmsLogPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const events = await fetchEvents(searchParams);
  const q = searchParams.q || "";
  const status = searchParams.status || "";
  const limit = searchParams.limit || "200";

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold">SMS Delivery Log</h1>

      {/* Filters */}
      <form className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col">
          <label className="text-xs text-gray-600" htmlFor="q">Search (SID, To, From)</label>
          <input
            id="q"
            name="q"
            defaultValue={q}
            className="rounded border px-2 py-1"
            placeholder="e.g., SMxxxxxxxx, +15551234567"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-gray-600" htmlFor="status">Status</label>
          <select id="status" name="status" defaultValue={status} className="rounded border px-2 py-1">
            <option value="">(any)</option>
            <option>accepted</option>
            <option>queued</option>
            <option>sending</option>
            <option>sent</option>
            <option>delivered</option>
            <option>undelivered</option>
            <option>failed</option>
            <option>receiving</option>
            <option>received</option>
          </select>
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-gray-600" htmlFor="limit">Limit</label>
          <input id="limit" name="limit" defaultValue={limit} className="w-24 rounded border px-2 py-1" />
        </div>
        <button className="rounded bg-black px-4 py-2 text-white" type="submit">
          Apply
        </button>
      </form>

      {/* Table */}
      <div className="overflow-x-auto rounded border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-2">Time</th>
              <th className="p-2">SID</th>
              <th className="p-2">To</th>
              <th className="p-2">From</th>
              <th className="p-2">Status</th>
              <th className="p-2">Error</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => {
              const errTip = explainTwilioError(e.error_code);
              return (
                <tr key={e.id} className="border-t">
                  <td className="p-2 whitespace-nowrap">
                    {new Date(e.created_at).toLocaleString()}
                  </td>
                  <td className="p-2 font-mono">
                    {e.message_sid || "—"}
                  </td>
                  <td className="p-2">{e.to_number || "—"}</td>
                  <td className="p-2">{e.from_number || "—"}</td>
                  <td className="p-2"><StatusBadge status={e.message_status} /></td>
                  <td className="p-2">
                    {e.error_code ? (
                      <div className="space-y-0.5">
                        <div className="font-mono text-xs">Code {e.error_code}</div>
                        {errTip ? <div className="text-xs text-gray-600">{errTip}</div> : null}
                        {e.error_message ? <div className="text-xs text-gray-600">{e.error_message}</div> : null}
                      </div>
                    ) : "—"}
                  </td>
                </tr>
              );
            })}
            {events.length === 0 ? (
              <tr>
                <td className="p-4 text-center text-gray-500" colSpan={6}>
                  No events found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-500">
        Showing up to {limit} most recent events. Use filters above to refine.
      </p>
    </div>
  );
}
