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
                  <span>Created: {new Date(c.created_at).toLocaleString("en-US", { timeZone: "America/Chicago" })}</span>
                  {c.closed_at && (
                    <span> • Closed: {new Date(c.closed_at).toLocaleString("en-US", { timeZone: "America/Chicago" })}</span>
                  )}
                </div>
              </Link>
            ))
          )}
        </section>
      </div>

      <style jsx>{`
        .wt-main { min-height: 60vh; }
        .wt-wrap { max-width: 900px; margin: 0 auto; padding: 24px 16px; }
        .wt-header h1 { margin: 0; font-size: 24px; }
        .wt-sub { margin: 6px 0 12px; opacity: 0.7; }
        .wt-list { display: grid; gap: 12px; }
        .wt-card {
          border-radius: 16px; padding: 14px; border: 1px solid rgba(0,0,0,0.08); background: #fff;
        }
        @media (prefers-color-scheme: dark) {
          .wt-card { background: #161616; border-color: rgba(255,255,255,0.12); }
        }
        .wt-case { text-decoration: none; color: inherit; display: block; }
        .wt-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
        .wt-title { font-weight: 700; }
        .wt-meta { margin-top: 6px; font-size: 12px; opacity: 0.75; }
        .wt-badge {
          padding: 4px 8px; border-radius: 999px; font-size: 12px; border: 1px solid transparent;
        }
        .wt-badge-open { background: #e8f5e9; border-color: #c8e6c9; color: #1b5e20; }
        .wt-badge-closed { background: #fff7ed; border-color: #ffedd5; color: #9a3412; }
        @media (prefers-color-scheme: dark) {
          .wt-badge-open { background: rgba(76,175,80,0.15); border-color: rgba(200,230,201,0.35); color: #9ae6b4; }
          .wt-badge-closed { background: rgba(253,186,116,0.15); border-color: rgba(254,215,170,0.35); color: #fbbf24; }
        }
      `}</style>
    </main>
  );
}
