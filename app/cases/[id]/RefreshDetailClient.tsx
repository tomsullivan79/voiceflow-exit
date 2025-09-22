// app/cases/[id]/RefreshDetailClient.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "../../lib/supabaseBrowser";

export default function RefreshDetailClient({ conversationId }: { conversationId: string }) {
  const router = useRouter();

  useEffect(() => {
    if (!conversationId) return;

    const supa = supabaseBrowser();
    let poll: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      if (poll) return;
      console.debug("[case-rt] starting fallback polling");
      poll = setInterval(() => {
        router.refresh();
      }, 7000);
    };
    const stopPolling = () => {
      if (!poll) return;
      clearInterval(poll);
      poll = null;
      console.debug("[case-rt] stopped fallback polling");
    };

    startPolling();

    const channel = supa
      .channel(`case-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "conversation_messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          console.debug("[case-rt] message insert", payload.new);
          router.refresh();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversation_messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          console.debug("[case-rt] message update", payload.new);
          router.refresh();
        }
      )
      .subscribe((status) => {
        console.debug("[case-rt] channel status:", status);
        if (status === "SUBSCRIBED") stopPolling();
        if (status === "CLOSED" || status === "TIMED_OUT" || status === "CHANNEL_ERROR") startPolling();
      });

    return () => {
      supa.removeChannel(channel);
      stopPolling();
    };
  }, [conversationId, router]);

  return null;
}
