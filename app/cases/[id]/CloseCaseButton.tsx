// app/cases/[id]/CloseCaseButton.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CloseCaseButton({ conversationId }: { conversationId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onClose() {
    if (loading) return;
    const ok = window.confirm("Close this case? You can re-open later by clearing 'closed_at' in DB.");
    if (!ok) return;
    setLoading(true);
    try {
      const res = await fetch("/api/cases/close", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversation_id: conversationId }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(`Close failed: ${j?.error || res.statusText}`);
      } else {
        router.refresh(); // reflect closed badge immediately
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button className="wt-btn wt-btn-danger" onClick={onClose} disabled={loading}>
      {loading ? "Closing…" : "Close Case"}
    </button>
  );
}
