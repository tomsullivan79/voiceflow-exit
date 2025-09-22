// app/cases/[id]/AutoRefresher.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AutoRefresher({ conversationId }: { conversationId: string }) {
  const router = useRouter();

  useEffect(() => {
    console.log("[case-poll] mounted (detail)", conversationId);
    const id = setInterval(() => {
      console.log("[case-poll] tick → router.refresh()", conversationId);
      router.refresh();
    }, 5000);
    return () => clearInterval(id);
  }, [conversationId, router]);

  return null;
}
