"use client";
import { useState } from "react";

type Item = { id: string; content: string; created_at: string };

export default function ClientList({ initialItems }: { initialItems: Item[] }) {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [busy, setBusy] = useState<string | null>(null);
  const [busyAll, setBusyAll] = useState(false);

  async function delOne(id: string) {
    setBusy(id);
    const res = await fetch("/api/memories/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const json = await res.json();
    setBusy(null);
    if (json.ok) setItems(items.filter((i) => i.id !== id));
    else alert(json.error || "Delete failed");
  }

  async function delAll() {
    if (!confirm("Delete ALL your memories? This cannot be undone.")) return;
    setBusyAll(true);
    const res = await fetch("/api/memories/delete-all", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: "YES" }),
    });
    const json = await res.json();
    setBusyAll(false);
    if (json.ok) setItems([]);
    else alert(json.error || "Delete-all failed");
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <button onClick={delAll} disabled={busyAll || items.length === 0}>
          {busyAll ? "Deleting…" : "Delete all"}
        </button>
      </div>

      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {items.map((m) => (
          <li key={m.id} style={{
            border: "1px solid #333", borderRadius: 8, padding: 12, marginBottom: 10
          }}>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>
              {new Date(m.created_at).toLocaleString()}
            </div>
            <div style={{ whiteSpace: "pre-wrap" }}>{m.content}</div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
              <button onClick={() => delOne(m.id)} disabled={busy === m.id}>
                {busy === m.id ? "Deleting…" : "Delete"}
              </button>
            </div>
          </li>
        ))}
        {items.length === 0 && <li>No memories yet.</li>}
      </ul>
    </>
  );
}
