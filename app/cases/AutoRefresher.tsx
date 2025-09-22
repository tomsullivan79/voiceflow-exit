// app/cases/AutoRefresher.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AutoRefresher() {
  const router = useRouter();

  useEffect(() => {
    console.log("[cases-poll] mounted (list)");
    const id = setInterval(() => {
      console.log("[cases-poll] tick → router.refresh()");
      router.refresh();
    }, 5000);
    return () => clearInterval(id);
  }, [router]);

  return null;
}
