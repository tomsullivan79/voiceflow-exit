// app/cases/[id]/page.tsx
import { supabaseAdmin } from "@/lib/supabaseServer";
import { supabaseServerAuth } from "@/lib/supabaseServerAuth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import twilio from "twilio";

export const dynamic = "force-dynamic";

// ✅ close case
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

// ✅ reply via SMS (respects DISABLE_OUTBOUND_SMS)
export async function sendReply(formData: FormData) {
  "use server";
  const id = formData.get("id") as string;
  const body = (formData.get("body") as string)?.trim();
  if (!id || !body) return;

  const sb = supabaseAdmin();
  const { data: conv } = await sb
    .from("conversations")
    .select("id, phone, status")
    .eq("id", id)
    .single();

  if (!conv?.phone) return;

  const disabled = process.env.DISABLE_OUTBOUND_SMS === "true";

  // Only send when enabled
  if (!disabled) {
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_AUTH_TOKEN!
    );

    const statusCallback =
      (process.env.NEXT_PUBLIC_SITE_URL || "https://app.wildtriage.org") +
      "/api/sms/status";

    const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
    const fromNumber = process.env.TWILIO_SMS_FROM;

    const createArgs: any = {
      to: conv.phone,
      body,
      statusCallback,
    };
    if (messagingServiceSid) createArgs.messagingServiceSid = messagingServiceSid;
    else if (fromNumber) createArgs.from = fromNumber;

    await client.messages.create(createArgs);
  }

  // Always log to the case so UI stays consistent
  await sb.from("conversation_messages").insert({
    conversation_id: id,
    role: "assistant",
    content: disabled ? `[not sent – A2P pending] ${body}` : body,
  });

  revalidatePath(`/cases/${id}`);
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

      {/* Reply box */}
      <div style={{marginTop:20, borderTop:"1px solid #eee", paddingTop:12}}>
        <form action={sendReply} style={{display:"flex", gap:8}}>
          <input type="hidden" name="id" value={conv.id} />
          <input
            name="body"
            type="text"
            placeholder="Type a reply to send via SMS…"
            required
            style={{flex:1, padding:"8px 10px", border:"1px solid #ccc", borderRadius:6}}
          />
          <button type="submit" style={{padding:"8px 12px"}} disabled={conv.status === "closed"}>
            Send
          </button>
        </form>
        {process.env.DISABLE_OUTBOUND_SMS === "true" && (
          <p style={{marginTop:8, fontSize:12, opacity:0.7}}>
            Outbound SMS is disabled (A2P pending). Replies will be logged but not sent.
          </p>
        )}
        {conv.status === "closed" && (
          <p style={{marginTop:4, fontSize:12, opacity:0.7}}>
            Reopen by changing status in the database (or inbound SMS will start a new case).
          </p>
        )}
      </div>
    </main>
  );
}
