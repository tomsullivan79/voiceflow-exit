import { supabaseAdmin } from "@/lib/supabaseServer";
import { supabaseServerAuth } from "@/lib/supabaseServerAuth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache"; 
import Link from "next/link";

export const dynamic = "force-dynamic";

// ✅ server action to close the case
export async function closeCase(formData: FormData) {
  "use server";
  const id = formData.get("id") as string;
  if (!id) return;
  const sb = supabaseAdmin();
  await sb
    .from("conversations")
    .update({ status: "closed", updated_at: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/cases");
  revalidatePath(`/cases/${id}`);
  redirect("/cases");
}

export default async function CaseDetail({ params }: { params: { id: string } }) {
  // 🔐 require login
  const sbAuth = await supabaseServerAuth();
  const { data: { user } } = await sbAuth.auth.getUser();
  if (!user) redirect("/auth");

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
      <p style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
        <Link href="/cases">← Cases</Link>
        <form action={closeCase}>
          <input type="hidden" name="id" value={conv.id} />
          <button
            type="submit"
            style={{padding:"6px 10px", border:"1px solid #ccc", borderRadius:6}}
            disabled={conv.status === "closed"}
            title={conv.status === "closed" ? "Already closed" : "Close this case"}
          >
            {conv.status === "closed" ? "Closed" : "Close case"}
          </button>
        </form>
      </p>

      <h1>{conv.title || "Case"}</h1>
      <p style={{opacity:0.8}}>{conv.phone} · {conv.status} · {new Date(conv.created_at).toLocaleString()}</p>

      <div style={{marginTop:16, border:"1px solid #eee", borderRadius:8, padding:12}}>
        {(msgs||[]).map((m:any, i:number) => (
          <div key={i} style={{padding:"8px 0", borderBottom: "1px solid #f3f3f3"}}>
            <div style={{fontSize:12, opacity:0.7}}>
              {m.role} · {new Date(m.created_at).toLocaleString()}
            </div>
            <div style={{whiteSpace:"pre-wrap"}}>{m.content}</div>
          </div>
        ))}
        {(!msgs || msgs.length===0) && <p>No messages yet.</p>}
      </div>
    </main>
  );
}
