// app/memories/page.tsx
import { supabaseAdmin } from "@/lib/supabaseServer";
import { supabaseServerAuth } from "@/lib/supabaseServerAuth";
import ClientList from "./client-list";

export const dynamic = "force-dynamic";

export default async function MemoriesPage() {
  const sbAuth = await supabaseServerAuth();
  const { data: { user } } = await sbAuth.auth.getUser();

  if (!user) {
    return (
      <main style={{ maxWidth: 820, margin: "40px auto", padding: 16 }}>
        <h1>Memories</h1>
        <p>You are not signed in. <a href="/auth">Go to Sign in</a></p>
      </main>
    );
  }

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("memory")
    .select("id, content, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return (
      <main style={{ maxWidth: 820, margin: "40px auto", padding: 16 }}>
        <h1>Memories</h1>
        <p style={{ color: "tomato" }}>Error: {error.message}</p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 820, margin: "40px auto", padding: 16 }}>
      <h1>Memories</h1>
      <p style={{ opacity: 0.8, marginBottom: 16 }}>{data?.length || 0} item(s)</p>
      <ClientList initialItems={data || []} />
    </main>
  );
}
