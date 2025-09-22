// app/cases/RefreshListClient.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "../lib/supabaseBrowser"; // note: path is from /app/cases/*

export default function RefreshListClient() {
  const router = useRouter();

  useEffect(() => {
    const supa = supabaseBrowser();
    let poll: ReturnType<typeof setInterval> | null = null;

    // start a gentle polling fallback that stops once realtime confirms subscribed
    const startPolling = () => {
      if (poll) return;
      console.debug("[cases-rt] starting fallback polling");
      poll = setInterval(() => {
        router.refresh();
      }, 7000);
    };
    const stopPolling = () => {
      if (!poll) return;
      clearInterval(poll);
      poll = null;
      console.debug("[cases-rt] stopped fallback polling");
    };

    startPolling(); // begin immediately until realtime connects

    const channel = supa
      .channel("cases-list", { config: { broadcast: { ack: false } } })
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "conversation_messages" },
        (payload) => {
          console.debug("[cases-rt] message insert", payload.new);
          router.refresh();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations" },
        (payload) => {
          console.debug("[cases-rt] conversation change", payload.eventType, payload.new || payload.old);
          router.refresh();
        }
      )
      .subscribe((status) => {
        console.debug("[cases-rt] channel status:", status);
        if (status === "SUBSCRIBED") stopPolling();
        if (status === "CLOSED" || status === "TIMED_OUT" || status === "CHANNEL_ERROR") startPolling();
      });

    return () => {
      supa.removeChannel(channel);
      stopPolling();
    };
  }, [router]);

  return null;
}
