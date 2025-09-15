// app/api/chat/route.ts
import OpenAI from "openai";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { supabaseServerAuth } from "@/lib/supabaseServerAuth";

export const runtime = "nodejs";

const MODEL_TEXT = process.env.OPENAI_MODEL_TEXT || "gpt-4o-mini";
const MODEL_EMBED = process.env.OPENAI_MODEL_EMBED || "text-embedding-3-small";

function shouldRemember(_userText: string, explicitFlag?: boolean) {
  return explicitFlag === true; // strict: only when checkbox checked
}

async function embed(openai: OpenAI, text: string) {
  const { data } = await openai.embeddings.create({ model: MODEL_EMBED, input: text });
  return data[0].embedding;
}

export async function POST(req: Request) {
  const { messages, remember } = await req.json();

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  const sb = supabaseAdmin();

  // server-verified user (await the auth client)
  const sbAuth = await supabaseServerAuth();
  const { data: { user } } = await sbAuth.auth.getUser();
  const userId = user?.id ?? "default-user";

  const userMessage = Array.isArray(messages)
    ? [...messages].reverse().find((m) => m.role === "user")?.content ?? ""
    : "";

  const blocks: string[] = [];

  try {
    if (userMessage) {
      const qEmb = await embed(openai, userMessage);

      // 1) memory matches
      const { data: mem, error: memErr } = await sb.rpc("match_memories_l2", {
        query_embedding: qEmb,
        for_user: userId,
        match_count: 5,
      });
      if (memErr) console.error("match_memories_l2 error:", memErr);
      if (mem?.length) {
        blocks.push(mem.map((m: any, i: number) => `MEM #${i + 1}: ${m.content}`).join("\n"));
      }

      // 2) document chunk matches
      const { data: docs, error: docErr } = await sb.rpc("match_doc_chunks_l2", {
        query_embedding: qEmb,
        for_user: userId,
        match_count: 8,
      });
      if (docErr) console.error("match_doc_chunks_l2 error:", docErr);
      if (docs?.length) {
        blocks.push(docs.map((d: any, i: number) => `DOC #${i + 1}: ${d.content}`).join("\n"));
      }

      // 3) optional remember (strict checkbox)
      if (shouldRemember(userMessage, !!remember)) {
        sb.from("memory")
          .insert({ user_id: userId, content: userMessage, embedding: qEmb })
          .then(({ error }) => { if (error) console.error("memory insert error:", error); });
      }
    }
  } catch (e) {
    console.error("retrieval pipeline error:", e);
  }

  const context = blocks.length ? blocks.join("\n---\n") : "";
  const systemPreamble = context
    ? `Use the following user-specific context if relevant.\n${context}\n---\n`
    : `---\n`;

  // stream the model response
  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      try {
        const completion = await openai.chat.completions.create({
          model: MODEL_TEXT,
          stream: true,
          messages: [
            { role: "system", content: systemPreamble + "Answer helpfully and concisely." },
            ...(Array.isArray(messages) ? messages : []),
          ],
        });
        for await (const part of completion) {
          const delta = part.choices?.[0]?.delta?.content ?? "";
          if (delta) controller.enqueue(enc.encode(delta));
        }
      } catch (err: any) {
        controller.enqueue(new TextEncoder().encode(`\n[error] ${err?.message || String(err)}`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" },
  });
}
