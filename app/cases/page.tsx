import { supabaseAdmin } from "@/lib/supabaseServer";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function CasesPage() {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("conversations")
    .select("id, title, phone, status, created_at")
    .eq("channel", "sms")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return (
      <main style={{maxWidth:820, margin:"40px auto", padding:16}}>
        <h1>Cases</h1>
        <p style={{color:"tomato"}}>Error: {error.message}</p>
      </main>
    );
  }

  return (
    <main style={{maxWidth:820, margin:"40px auto", padding:16}}>
      <h1>Cases (SMS)</h1>
      <ul style={{listStyle:"none", padding:0}}>
        {(data || []).map((c: any) => (
          <li key={c.id} style={{padding:"12px 0", borderBottom:"1px solid #eee"}}>
            <div style={{display:"flex", justifyContent:"space-between", gap:12}}>
              <div>
                <Link href={`/cases/${c.id}`} style={{fontWeight:600}}>
                  {c.title || c.id}
                </Link>
                <div style={{opacity:0.8, fontSize:14}}>
                  {c.phone} · {c.status} · {new Date(c.created_at).toLocaleString()}
                </div>
              </div>
              <div>
                <Link href={`/cases/${c.id}`}>Open</Link>
              </div>
            </div>
          </li>
        ))}
      </ul>
      {(!data || data.length === 0) && (
        <p style={{opacity:0.8, marginTop:12}}>No cases yet. Text your Twilio number to create one.</p>
      )}
    </main>
  );
}
