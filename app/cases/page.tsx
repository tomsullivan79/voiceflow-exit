// app/cases/page.tsx
import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !anon || !service) throw new Error("Missing Supabase env vars.");
  return { url, anon, service };
}

async function requireSession(url: string, anon: string) {
  const cookieStore = cookies();
  const supabase = createServerClient(url, anon, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      // no-ops to avoid Next “Cookies can only be modified…” error
      set() {},
      remove() {},
    },
  });
  const { data } = await supabase.auth.getUser();
  if (!data?.user) redirect("/auth");
}

function getAdminClient(url: string, service: string) {
  return createClient(url, service, { auth: { persistSession: false } });
}

type ConversationRow = Record<string, any>;

async function fetchConversations(url: string, service: string) {
  const supabase = getAdminClient(url, service);
  const { data, error } = await supabase
    .from("conversations")
    .select("*") // avoid referencing columns that may not exist
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as ConversationRow[];
}

function StatusBadge({ closed_at }: { closed_at: string | null }) {
  const isClosed = !!closed_at;
  const bg = isClosed ? "#fee2e2" : "#d1fae5";
  const fg = isClosed ? "#991b1b" : "#065f46";
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
      {isClosed ? "Closed" : "Open"}
    </span>
  );
}

export default async function CasesPage() {
  const { url, anon, service } = getEnv();
  await requireSession(url, anon);
  const cases = await fetchConversations(url, service);

  // palette
  const pageTitle = "#f9fafb";
  const pageSub = "#cbd5e1";
  const cardText = "#111827";
  const subtle = "#6b7280";
  const border = "#d1d5db";

  return (
    <main style={{ maxWidth: 900, margin: "32px auto", padding: 24 }}>
      <h1 style={{ fontSize: 32, fontWeight: 800, color: pageTitle, marginBottom: 4 }}>
        Cases (SMS)
      </h1>
      <p style={{ color: pageSub, marginBottom: 16 }}>
        Click a case to view messages and delivery status.
      </p>

      <div style={{ display: "grid", gap: 12 }}>
        {cases.map((c) => {
          const phone =
            c.participant_phone ??
            c.phone ??
            c.msisdn ??
            c.from_number ??
            c.to_number ??
            null;

          return (
            <div
              key={c.id}
              style={{
                border: `1px solid ${border}`,
                background: "#ffffff",
                color: cardText,
                borderRadius: 8,
                padding: 14,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <Link
                  href={`/cases/${c.id}`}
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: "#1e40af",
                    textDecoration: "underline",
                  }}
                >
                  {c.title || c.id}
                </Link>
                <StatusBadge closed_at={c.closed_at ?? null} />
              </div>

              <div
                style={{
                  marginTop: 6,
                  color: subtle,
                  fontSize: 14,
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <span>{phone || "—"}</span>
                <span>•</span>
                <span>
                  {(c.closed_at ? "closed" : "open") + " • "}{new Date(c.created_at).toLocaleString()}
                </span>
              </div>
            </div>
          );
        })}

        {cases.length === 0 ? (
          <div
            style={{
              border: `1px solid ${border}`,
              background: "#ffffff",
              color: subtle,
              borderRadius: 8,
              padding: 16,
              textAlign: "center",
            }}
          >
            No cases yet.
          </div>
        ) : null}
      </div>
    </main>
  );
}
