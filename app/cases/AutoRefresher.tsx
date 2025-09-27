// app/cases/AutoRefresher.tsx
"use client";

import { useEffect } from "react";

export default function AutoRefresher() {
  useEffect(() => {
    console.log("[cases-poll] mounted (list)");
    const id = setInterval(() => {
      console.log("[cases-poll] hard reload");
      // Hard reload ensures brand-new conversations show up even if
      // any cache layer or data memoization is being stubborn.
      window.location.reload();
    }, 5000); // keep at 5s to match /chat testing cadence

    return () => clearInterval(id);
  }, []);

  return null;
}
