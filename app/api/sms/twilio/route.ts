// app/api/sms/twilio/route.ts
import { NextRequest } from "next/server";
import OpenAI from "openai";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { verifyTwilioSignature } from "@/lib/twilio";

export const runtime = "nodejs";

const MODEL_TEXT = process.env.OPENAI_MODEL_TEXT || "gpt-4o-mini";
const MODEL_EMBED = process.env.OPENAI_MODEL_EMBED || "text-embedding-3-small";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://app.wildtriage.org";
const TWILIO_STATUS_CB = `${SITE_URL}/api/sms/status`;

async function embed(openai: OpenAI, text: string) {
  const { data } = await openai.embeddings.create({ model: MODEL_EMBED, input: text });
  return data[0].embedding;
}

function twimlMessage(text: string) {
  const safe = text.replace(/[^\S\r\n]+/g, " ");
  // include a statusCallback so Twilio posts delivery receipts
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message statusCallback="${TWILIO_STATUS_CB}">${safe}</Message>
</Response>`;
}

export async function POST(req: NextRequest) {
  try {
    // Read raw body (Twilio posts x-www-form-urlencoded)
    const bodyText = await req.text();
    const params = Object.fromEntries(new URLSearchParams(bodyText));
    const signature = req.headers.get("x-twilio-signature");
    const url = `${SITE_URL}/api/sms/twilio`;

    // Verify signature
    const ok = verifyTwilioSignature({
      authToken: process.env.TWILIO_AUTH_TOKEN!,
      signature,
      url,
      params,
    });
    if (!ok) {
      // Return empty TwiML to avoid retries but do nothing
      return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`, {
        status: 200,
        headers: { "Content-Type": "text/xml" },
      });
    }

    const from = params["From"] || "";
    const text = (params["Body"] || "").trim();

    // Compliance keywords — let Twilio Advanced Opt-Out handle replies.
    const kw = text.toUpperCase();
    if (["STOP","STOPALL","UNSUBSCRIBE","CANCEL","END","QUIT","HELP","START","UNSTOP"].includes(kw)) {
      return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`, {
        headers: { "Content-Type": "text/xml" },
      });
    }

    if (!text) {
      return new Response(twimlMessage(""), { headers: { "Content-Type": "text/xml" } });
    }

    // Derive user id partitioned by phone
    const userId = `sms:${from}`;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
    const sb = supabaseAdmin();

    // Retrieval
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

    const reply =
      completion.choices?.[0]?.message?.content?.trim() ||
      "Sorry, I couldn’t generate a reply.";

    return new Response(twimlMessage(reply.slice(0, 1500)), {
      headers: { "Content-Type": "text/xml" },
    });
  } catch (e: any) {
    console.error("twilio webhook error:", e);
    return new Response(twimlMessage("Server error."), {
      status: 200, // Twilio expects 200
      headers: { "Content-Type": "text/xml" },
    });
  }
}
