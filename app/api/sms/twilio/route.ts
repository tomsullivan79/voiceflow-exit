import { NextRequest } from "next/server";
import OpenAI from "openai";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const runtime = "nodejs";

const MODEL_TEXT = process.env.OPENAI_MODEL_TEXT || "gpt-4o-mini";
const MODEL_EMBED = process.env.OPENAI_MODEL_EMBED || "text-embedding-3-small";

// reuse strict remember if you want later
const SHOULD_AUTO_REMEMBER = false; // keep false for SMS unless you add an explicit keyword

async function embed(openai: OpenAI, text: string) {
  const { data } = await openai.embeddings.create({ model: MODEL_EMBED, input: text });
  return data[0].embedding;
}

// Build minimal TwiML
function twimlMessage(text: string) {
  // Twilio requires XML
  const safe = text.replace(/[^\S\r\n]+/g, " "); // collapse weird whitespace
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${safe}</Message></Response>`;
}

export async function POST(req: NextRequest) {
  try {
    // Twilio posts application/x-www-form-urlencoded
    const bodyText = await req.text();
    const params = new URLSearchParams(bodyText);

    const from = params.get("From") || "";
    const to = params.get("To") || "";
    const text = params.get("Body")?.trim() || "";

    if (!text) {
      return new Response(twimlMessage(""), { headers: { "Content-Type": "text/xml" } });
    }

    // Derive a stable user id from the sender (partition memories per phone number)
    const userId = `sms:${from}`;

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
    const sb = supabaseAdmin();

    // 1) Embed query
    const qEmb = await embed(openai, text);

    // 2) Retrieve memories
    const { data: mem } = await sb.rpc("match_memories_l2", {
      query_embedding: qEmb,
      for_user: userId,
      match_count: 5,
    });

    // 3) Retrieve document chunks
    const { data: docs } = await sb.rpc("match_doc_chunks_l2", {
      query_embedding: qEmb,
      for_user: userId,
      match_count: 8,
    });

    const memBlock = (mem || []).map((m: any, i: number) => `MEM #${i + 1}: ${m.content}`).join("\n");
    const docBlock = (docs || []).map((d: any, i: number) => `DOC #${i + 1}: ${d.content}`).join("\n");
    const context = [memBlock, docBlock].filter(Boolean).join("\n---\n");

    const systemPreamble = context
      ? `Use the following user-specific context if relevant.\n${context}\n---\n`
      : `---\n`;

    // 4) Single-shot completion (SMS cannot stream)
    const completion = await openai.chat.completions.create({
      model: MODEL_TEXT,
      stream: false,
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

    // 5) (Optional) Save the user message as a memory on keyword
    if (SHOULD_AUTO_REMEMBER) {
      await sb.from("memory").insert({
        user_id: userId,
        content: text,
        embedding: qEmb,
      });
    }

    // 6) Return TwiML
    return new Response(twimlMessage(reply.slice(0, 1500)), {
      headers: { "Content-Type": "text/xml" },
    });
  } catch (e: any) {
    console.error("twilio webhook error:", e);
    return new Response(twimlMessage("Server error."), {
      status: 200, // Twilio expects 200; we can still send a generic message
      headers: { "Content-Type": "text/xml" },
    });
  }
}
