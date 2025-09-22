// app/cases/page.tsx
import Link from "next/link";
import { supabaseAdmin } from "../../lib/supabaseServer";
import AutoRefresher from "./AutoRefresher";

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
      <AutoRefresher />

      <div className="wt-wrap">
        <header className="wt-header">
          <h1>Cases</h1>
          <p className="wt-sub">Newest first. This list live-updates on new activity.</p>
        </header>

        <section>
          {rows.length === 0 ? (
            <div>No cases yet.</div>
          ) : (
            rows.map((c, i) => (
              <div key={c.id}>
                <a
                  href={`/cases/${c.id}`}
                  style={{ display: "block", textDecoration: "none", color: "inherit" }}
                >
                  <div style={{ fontWeight: 700 }}>{c.title || "Untitled Case"}</div>
                  <div>{c.closed_at ? "Closed" : "Open"}</div>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>
                    Created:{" "}
                    {new Date(c.created_at).toLocaleString("en-US", {
                      timeZone: "America/Chicago",
                    })}
                    {c.closed_at && (
                      <>
                        {" "}
                        • Closed:{" "}
                        {new Date(c.closed_at).toLocaleString("en-US", {
                          timeZone: "America/Chicago",
                        })}
                      </>
                    )}
                  </div>
                </a>
                {/* spacer between cases */}
                {i < rows.length - 1 ? <div style={{ height: 12 }} /> : null}
              </div>
            ))
          )}
        </section>
      </div>
    </main>
  );
}
