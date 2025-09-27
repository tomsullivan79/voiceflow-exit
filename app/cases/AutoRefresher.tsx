// app/cases/AutoRefresher.tsx
"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Visible, self-checking poller for /cases.
 * - Shows a tiny badge so you can verify it's mounted.
 * - Hard reloads every 5s when the tab is visible.
 */
export default function AutoRefresher() {
  const [tick, setTick] = useState(0);
  const rafRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const start = () => {
      if (intervalRef.current) return;
      intervalRef.current = setInterval(() => {
        // only refresh when the tab is foregrounded
        if (document.visibilityState === "visible") {
          setTick((t) => t + 1);
          // Hard reload to defeat any caches/stale data
          window.location.reload();
        }
      }, 5000);
    };
    const stop = () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
    };

    // Start immediately
    start();

    // If tab visibility changes, we pause/resume
    const onVis = () => {
      if (document.visibilityState === "visible") start();
      else stop();
    };
    document.addEventListener("visibilitychange", onVis);

    // One animation frame log to prove mount (and avoid noisy console)
    rafRef.current = requestAnimationFrame(() => {
      // eslint-disable-next-line no-console
      console.log("[cases-poll] mounted; badge will tick every 5s when tab visible");
    });

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVis);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Visible badge (non-intrusive)
  return (
    <div
      style={{
        position: "fixed",
        right: 12,
        bottom: 12,
        padding: "6px 10px",
        borderRadius: 8,
        fontSize: 12,
        opacity: 0.7,
        background: "rgba(0,0,0,0.06)",
        color: "inherit",
        zIndex: 10_000,
      }}
      aria-live="polite"
    >
      Auto-refresh: {tick}
    </div>
  );
}
