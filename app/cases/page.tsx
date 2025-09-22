// app/cases/page.tsx
import Link from "next/link";
import { supabaseAdmin } from "../../lib/supabaseServer";
import RefreshListClient from "./RefreshListClient";

export const dynamic = "force-dynamic";

type ConversationRow = {
  id: string;
  title: string | null;
  created_at: string;
  closed_at: string | null;
};

async function getConversations(): Promise<ConversationRow[]> {
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("conversations")
    .select("id, title, created_at, closed_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(`conversations_select_failed: ${error.message}`);
  return (data ?? []) as ConversationRow[];
}

export default async function CasesPage() {
  const rows = await getConversations();

  return (
    <main className="wt-main">
      {/* Client bridge for realtime list refresh */}
      <RefreshListClient />

      <div className="wt-wrap">
        <header className="wt-header">
          <h1>Cases</h1>
          <p className="wt-sub">Newest first. This list live-updates on new activity.</p>
        </header>

        <section className="wt-list">
          {rows.length === 0 ? (
            <div className="wt-card">No cases yet.</div>
          ) : (
            rows.map((c) => (
              <Link key={c.id} href={`/cases/${c.id}`} className="wt-card wt-case">
                <div className="wt-row">
                  <div className="wt-title">{c.title || "Untitled Case"}</div>
                  <div className={`wt-badge ${c.closed_at ? "wt-badge-closed" : "wt-badge-open"}`}>
                    {c.closed_at ? "Closed" : "Open"}
                  </div>
                </div>
                <div className="wt-meta">
                  <span>
                    Created:{" "}
                    {new Date(c.created_at).toLocaleString("en-US", { timeZone: "America/Chicago" })}
                  </span>
                  {c.closed_at && (
                    <span>
                      {" "}
                      • Closed:{" "}
                      {new Date(c.closed_at).toLocaleString("en-US", { timeZone: "America/Chicago" })}
                    </span>
                  )}
                </div>
              </Link>
            ))
          )}
        </section>
      </div>
    </main>
  );
}
