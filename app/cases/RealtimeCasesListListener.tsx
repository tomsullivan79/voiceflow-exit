// app/cases/RealtimeCasesListListener.tsx
"use client";

import { useEffect } from "react";
import { supabaseBrowser } from "../../lib/supabaseBrowser";

type Props = {
  onHeartbeatStart?: () => void;
  onHeartbeatStop?: () => void;
  onChange?: () => void;
};

export default function RealtimeCasesListListener({
  onHeartbeatStart,
  onHeartbeatStop,
  onChange,
}: Props) {
  useEffect(() => {
    let cancelled = false;
    const supa = supabaseBrowser();

    const channel = supa
      .channel("cases-list")
      // New messages (existing cases)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "conversation_messages" },
        () => {
          if (!cancelled) onChange?.();
        }
      )
      // New/updated conversations (new cases or title changes, status flips)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations" },
        () => {
          if (!cancelled) onChange?.();
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          onHeartbeatStop?.(); // parent should stop any polling fallback
        }
      });

    // Polling fallback while subscribing / on disconnects
    let timer: NodeJS.Timeout | null = null;
    const startHeartbeat = () => {
      if (timer) return;
      onHeartbeatStart?.();
      timer = setInterval(() => {
        fetch("/api/cases/heartbeat-list").catch(() => {});
      }, 15000);
    };
    const stopHeartbeat = () => {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
      onHeartbeatStop?.();
    };

    startHeartbeat();

    return () => {
      cancelled = true;
      stopHeartbeat();
      supa.removeChannel(channel);
    };
  }, [onChange, onHeartbeatStart, onHeartbeatStop]);

  return null;
}
