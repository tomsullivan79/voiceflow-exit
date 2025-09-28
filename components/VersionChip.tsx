// components/VersionChip.tsx
"use client";

import { useEffect, useState } from "react";

type V = { commit: string; built_at: string };

export default function VersionChip() {
  const [v, setV] = useState<V | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as V;
        if (alive) setV(data);
      } catch {/* ignore */}
    };
    load();
    // refresh occasionally during long sessions (optional)
    const t = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  if (!v) return null;

  return (
    <div
      className="fixed bottom-3 right-3 z-50 rounded-full border bg-white/90 backdrop-blur px-3 py-1 text-xs text-gray-700 shadow"
      title={`Built at ${v.built_at}`}
    >
      <span className="font-medium">commit</span>&nbsp;{v.commit}
      <span className="mx-1 text-gray-400">·</span>
      <span className="font-medium">built</span>&nbsp;{v.built_at}
    </div>
  );
}
