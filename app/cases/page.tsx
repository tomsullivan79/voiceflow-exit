// app/cases/page.tsx
import Link from "next/link";
import { supabaseAdmin } from "../../lib/supabaseServer";

export const dynamic = "force-dynamic";

type ActivityRow = {
  conversation_id: string;
  last_activity: string;
  message_count: number;
};

type ConversationRow = {
  id: string;
  title: string | null;
  created_at: string;
  closed_at: string | null;
};

async function getActivity(): Promise<ActivityRow[]> {
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("conversation_activity")
    .select("conversation_id, last_activity, message_count")
    .order("last_activity", { ascending: false })
    .limit(100);
  if (error) throw new Error(`activity_select_failed: ${error.message}`);
  return (data ?? []) as ActivityRow[];
}

async function getConversations(ids: string[]): Promise<Record<string, ConversationRow>> {
  if (ids.length === 0) return {};
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("conversations")
    .select("id, title, created_at, closed_at")
    .in("id", ids);
  if (error) throw new Error(`conversations_select_failed: ${error.message}`);
  const map: Record<string, ConversationRow> = {};
  for (const row of data ?? []) map[row.id] = row as ConversationRow;
  return map;
}

export default async function CasesPage() {
  // 1) Get activity ordered by latest message
  const activity = await getActivity();

  // 2) Pull corresponding conversation metadata
  const ids = activity.map((a) => a.conversation_id);
  const convMap = await getConversations(ids);

  return (
    <main className="wt-main">
      <div className="wt-wrap">
        <header className="wt-header">
          <h1>Cases</h1>
          <p className="wt-sub">Sorted by recent activity. Auto-refreshes every few seconds.</p>
        </header>

        <section>
          {activity.length === 0 ? (
            <div>No cases yet.</div>
          ) : (
            activity.map((a, i) => {
              const c = convMap[a.conversation_id];
              if (!c) return null;
              const created = new Date(c.created_at).toLocaleString("en-US", { timeZone: "America/Chicago" });
              const updated = new Date(a.last_activity).toLocaleString("en-US", { timeZone: "America/Chicago" });
              return (
                <div key={a.conversation_id}>
                  <Link
                    href={`/cases/${a.conversation_id}`}
                    style={{ display: "block", textDecoration: "none", color: "inherit" }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                      <div style={{ fontWeight: 700 }}>{c.title || "Untitled Case"}</div>
                      <div>{c.closed_at ? "Closed" : "Open"}</div>
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>
                      Created: {created} • Updated: {updated} • Messages: {a.message_count}
                    </div>
                  </Link>
                  {/* spacer between cases */}
                  {i < activity.length - 1 ? <div style={{ height: 12 }} /> : null}
                </div>
              );
            })
          )}
        </section>
      </div>
    </main>
  );
}
