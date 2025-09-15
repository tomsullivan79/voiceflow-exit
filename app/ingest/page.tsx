"use client";
import { useState } from "react";

export default function IngestPage() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string>("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setStatus("Uploading…");
    const fd = new FormData();
    fd.append("file", file);
    fd.append("name", file.name);

    try {
     const res = await fetch("/api/ingest", { method: "POST", body: fd });
     const json = await res.json();
     if (!res.ok || !json.ok) {
      setStatus(`Error: ${json.error || res.statusText}`);
      return;
     }
     setStatus(`Ingested ${json.chunks} chunks (docId: ${json.docId})`);
   } catch (err: any) {
     setStatus(`Network/Server error: ${err?.message || String(err)}`);
   }
    setFile(null);
  }

  return (
    <main style={{ maxWidth: 720, margin: "40px auto", padding: 16 }}>
      <h1>Upload knowledge (TXT/MD)</h1>
      <form onSubmit={onSubmit} style={{ marginTop: 16 }}>
        <input
          type="file"
          accept=".txt,.md,text/plain,text/markdown"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
        <div style={{ marginTop: 12 }}>
          <button type="submit" disabled={!file}>Ingest</button>
        </div>
      </form>
      <p style={{ marginTop: 12 }}>{status}</p>
      <p style={{ opacity: 0.7, marginTop: 8 }}>
        TXT/MD supported. PDF support will be added later.
      </p>
    </main>
  );
}
