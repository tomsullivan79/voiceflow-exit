import { supabaseAdmin } from "@/lib/supabaseServer";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function CaseDetail({ params }: { params: { id: string } }) {
  const sb = supabaseAdmin();
  const { data: conv } = await sb
    .from("conversations")
    .select("id, title, phone, status, created_at")
    .eq("id", params.id)
    .single();

  const { data: msgs } = await sb
    .from("conversation_messages")
    .select("role, content, created_at")
    .eq("conversation_id", params.id)
    .order("created_at", { ascending: true })
    .limit(500);

  if (!conv) {
    return <main style={{maxWidth:820, margin:"40px auto", padding:16}}>
      <p><Link href="/cases">← Cases</Link></p>
      <p style={{color:"tomato"}}>Case not found.</p>
    </main>;
  }

  return (
    <main style={{maxWidth:820, margin:"40px auto", padding:16}}>
      <p><Link href="/cases">← Cases</Link></p>
      <h1>{conv.title || "Case"}</h1>
      <p style={{opacity:0.8}}>{conv.phone} · {conv.status} · {new Date(conv.created_at).toLocaleString()}</p>

      <div style={{marginTop:16, border:"1px solid #eee", borderRadius:8, padding:12}}>
        {(msgs||[]).map((m:any, i:number) => (
          <div key={i} style={{padding:"8px 0", borderBottom: "1px solid #f3f3f3"}}>
            <div style={{fontSize:12, opacity:0.7}}>{m.role} · {new Date(m.created_at).toLocaleString()}</div>
            <div style={{whiteSpace:"pre-wrap"}}>{m.content}</div>
          </div>
        ))}
        {(!msgs || msgs.length===0) && <p>No messages yet.</p>}
      </div>
    </main>
  );
}
