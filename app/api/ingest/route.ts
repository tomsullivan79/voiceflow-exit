// app/api/ingest/route.ts
import { NextRequest } from "next/server";
import OpenAI from "openai";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { supabaseServerAuth } from "@/lib/supabaseServerAuth";
import { chunkText } from "@/lib/chunk";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = Number(process.env.INGEST_MAX_UPLOAD_BYTES || 8 * 1024 * 1024);
const MODEL_EMBED = process.env.OPENAI_MODEL_EMBED || "text-embedding-3-small";
const INGEST_MAX_CHUNKS = Number(process.env.INGEST_MAX_CHUNKS || 800);
const EMB_BATCH = 100;
const INS_BATCH = 200;

export async function POST(req: NextRequest) {
  try {
    // Auth (server-verified)
    const sbAuth = await supabaseServerAuth();
    const { data: { user } } = await sbAuth.auth.getUser();
    if (!user) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });

    // Parse form-data
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return Response.json({ ok: false, error: "missing file" }, { status: 400 });

    const size = file.size ?? 0;
    if (size > MAX_UPLOAD_BYTES) {
      return Response.json({
        ok: false,
        error: `File too large (${(size/1024/1024).toFixed(1)}MB > ${(MAX_UPLOAD_BYTES/1024/1024).toFixed(1)}MB). Raise INGEST_MAX_UPLOAD_BYTES or upload a smaller file.`
      }, { status: 413 });
    }

    const suppliedName = (form.get("name") as string) || file.name || "upload.txt";
    const name = suppliedName.trim();
    const ext = name.split(".").pop()?.toLowerCase() || "";
    const mime = file.type || "text/plain";

    // TXT/MD only (skip PDFs for now)
    if (!/(^txt$|^md$)/i.test(ext)) {
      return Response.json({
        ok: false,
        error: "Only .txt and .md supported right now. PDF OCR/extraction coming later."
      }, { status: 400 });
    }

    const sb = supabaseAdmin();

    // Upload original to Storage (private)
    const storagePath = `u/${user.id}/${Date.now()}-${name}`;
    const up = await sb.storage.from("docs").upload(storagePath, file, {
      contentType: mime,
      upsert: false,
    });
    if (up.error) {
      console.error("storage upload error:", up.error);
      return Response.json({ ok: false, error: up.error.message }, { status: 500 });
    }

    // Document record
    const docId = randomUUID();
    const { error: docErr } = await sb.from("documents").insert({
      id: docId,
      user_id: user.id,
      name,
      mime,
      size_bytes: size,
      storage_path: storagePath,
    });
    if (docErr) {
      console.error("documents insert error:", docErr);
      return Response.json({ ok: false, error: docErr.message }, { status: 500 });
    }

    // Extract text (plain)
    const raw = (await file.text()).replace(/\r/g, "").trim();
    const chunks = chunkText(raw, 1200, 200);
    if (chunks.length === 0) {
      return Response.json({ ok: false, error: "No content detected after chunking" }, { status: 400 });
    }
    const capped = chunks.slice(0, INGEST_MAX_CHUNKS);

    // Embed (batched)
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
    const inputs = capped.map(c => c.content);
    const vectors: number[][] = [];
    for (let i = 0; i < inputs.length; i += EMB_BATCH) {
      const slab = inputs.slice(i, i + EMB_BATCH);
      const emb = await openai.embeddings.create({ model: MODEL_EMBED, input: slab });
      vectors.push(...emb.data.map(d => d.embedding));
    }

    // Insert chunks (batched)
    const rows = capped.map((c, i) => ({
      document_id: docId,
      chunk_index: c.index,
      content: c.content,
      embedding: vectors[i] as any,
    }));
    for (let i = 0; i < rows.length; i += INS_BATCH) {
      const slice = rows.slice(i, i + INS_BATCH);
      const { error } = await sb.from("document_chunks").insert(slice);
      if (error) {
        console.error("chunk insert error:", error);
        return Response.json({ ok: false, error: error.message }, { status: 500 });
      }
    }

    return Response.json({
      ok: true,
      docId,
      chunks: rows.length,
      truncated: chunks.length > capped.length ? (chunks.length - capped.length) : 0
    });
  } catch (e: any) {
    console.error("ingest route error:", e);
    return Response.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
