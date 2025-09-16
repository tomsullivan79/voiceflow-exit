// app/api/sms/twilio/route.ts
import { NextRequest } from "next/server";
import OpenAI from "openai";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { verifyTwilioSignature } from "@/lib/twilio";

export const runtime = "nodejs";

const MODEL_TEXT = process.env.OPENAI_MODEL_TEXT || "gpt-4o-mini";
const MODEL_EMBED = process.env.OPENAI_MODEL_EMBED || "text-embedding-3-small";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://app.wildtriage.org";
const TWILIO_STATUS_CB = `${SITE_URL}/api/sms/status`; // not enabled yet; safe to leave

function twimlMessage(text: string) {
  const safe = text.replace(/[^\S\r\n]+/g, " ");
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message statusCallback="${TWILIO_STATUS_CB}">${safe}</Message>
</Response>`;
}

async function embed(openai: OpenAI, text: string) {
  const { data } = await openai.embeddings.create({ model: MODEL_EMBED, input: text });
  return data[0].embedding;
}

export async function POST(req: NextRequest) {
  try {
    // Raw body (x-www-form-urlencoded)
    const bodyText = await req.text();
    const params = Object.fromEntries(new URLSearchParams(bodyText));
    const signature = req.headers.get("x-twilio-signature");
    const url = `${SITE_URL}/api/sms/twilio`;

    // Verify Twilio signature
    const ok = verifyTwilioSignature({
      authToken: process.env.TWILIO_AUTH_TOKEN!,
      signature,
      url,
      params,
    });
    if (!ok) {
      return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`, {
        status: 200,
        headers: { "Content-Type": "text/xml" },
      });
    }

    const from = params["From"] || "";
    const text = (params["Body"] || "").trim();
    const userId = `sms:${from}`;

    // Compliance keywords — let Twilio's Advanced Opt-Out handle the reply.
    const kw = text.toUpperCase();
    if (["STOP","STOPALL","UNSUBSCRIBE","CANCEL","END","QUIT","HELP","START","UNSTOP"].includes(kw)) {
      return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`, {
        headers: { "Content-Type": "text/xml" },
      });
    }

    if (!text) {
      return new Response(twimlMessage(""), { headers: { "Content-Type": "text/xml" } });
    }

    const sb = supabaseAdmin();
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

    // --- Get or create an OPEN conversation for this phone ---
    let conversationId: string | null = null;

    const { data: existing, error: findErr } = await sb
      .from("conversations")
      .select("id")
      .eq("user_id", userId)
      .eq("channel", "sms")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(1);

    if (findErr) console.error("find conversation error:", findErr);

    if (existing && existing.length) {
      conversationId = existing[0].id;
    } else {
      const title = text.slice(0, 80) || "Conversation";
      const { data: created, error: createErr } = await sb
        .from("conversations")
        .insert({ user_id: userId, channel: "sms", phone: from, title, status: "open" })
        .select("id")
        .single();
      if (createErr) {
        console.error("create conversation error:", createErr);
      } else {
        conversationId = created?.id || null;
      }
    }

    // Log user's inbound message (best-effort)
    if (conversationId) {
      await sb.from("conversation_messages").insert({
        conversation_id: conversationId,
        role: "user",
        content: text,
      });
    }

    // Retrieval (memories + docs)
    const qEmb = await embed(openai, text);
    const { data: mem } = await sb.rpc("match_memories_l2", {
      query_embedding: qEmb, for_user: userId, match_count: 5,
    });
    const { data: docs } = await sb.rpc("match_doc_chunks_l2", {
      query_embedding: qEmb, for_user: userId, match_count: 8,
    });

    const memBlock = (mem || []).map((m: any, i: number) => `MEM #${i + 1}: ${m.content}`).join("\n");
    const docBlock = (docs || []).map((d: any, i: number) => `DOC #${i + 1}: ${d.content}`).join("\n");
    const context = [memBlock, docBlock].filter(Boolean).join("\n---\n");
    const systemPreamble = context
      ? `Use the following user-specific context if relevant.\n${context}\n---\n`
      : `---\n`;

    const completion = await openai.chat.completions.create({
      model: MODEL_TEXT,
      messages: [
        { role: "system", content: systemPreamble + "Answer briefly and helpfully." },
        { role: "user", content: text },
      ],
      temperature: 0.3,
      max_tokens: 300,
    });

    const reply = completion.choices?.[0]?.message?.content?.trim()
      || "Sorry, I couldn’t generate a reply.";

    // Log assistant's reply (best-effort)
    if (conversationId) {
      await sb.from("conversation_messages").insert({
        conversation_id: conversationId,
        role: "assistant",
        content: reply,
      });
    }

    // Respond with TwiML (includes statusCallback URL but that's fine if not enabled yet)
    return new Response(twimlMessage(reply.slice(0, 1500)), {
      headers: { "Content-Type": "text/xml" },
    });
  } catch (e: any) {
    console.error("twilio webhook error:", e);
    return new Response(twimlMessage("Server error."), {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  }
}
