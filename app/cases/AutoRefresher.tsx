// app/cases/AutoRefresher.tsx
"use client";

import { useEffect } from "react";

/**
 * Headless poller for /cases:
 * - hard reload every 10s while the tab is visible (ensures new conversations appear)
 * - no visible badge/log noise
 */
export default function AutoRefresher() {
  useEffect(() => {
    const start = () => {
      if ((window as any).__wt_cases_timer__) return;
      (window as any).__wt_cases_timer__ = setInterval(() => {
        if (document.visibilityState === "visible") {
          window.location.reload();
        }
      }, 10000);
    };
    const stop = () => {
      const t = (window as any).__wt_cases_timer__;
      if (t) clearInterval(t);
      (window as any).__wt_cases_timer__ = null;
    };

    start();
    const onVis = () => (document.visibilityState === "visible" ? start() : stop());
    document.addEventListener("visibilitychange", onVis);

    return () => {
      document.removeEventListener("visibilitychange", onVis);
      stop();
    };
  }, []);

  return null;
}
