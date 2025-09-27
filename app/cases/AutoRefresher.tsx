// app/cases/AutoRefresher.tsx
"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export default function AutoRefresher() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  useEffect(() => {
    console.log("[cases-poll] mounted (list)");
    const id = setInterval(() => {
      const params = new URLSearchParams(search?.toString() || "");
      params.set("__ts", String(Date.now())); // cache-bust
      const url = `${pathname}?${params.toString()}`;
      console.log("[cases-poll] replace →", url);
      router.replace(url); // forces server re-render
    }, 5000);

    return () => clearInterval(id);
  }, [router, pathname, search]);

  return null;
}
