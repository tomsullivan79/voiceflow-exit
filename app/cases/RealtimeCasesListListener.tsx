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
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "conversation_messages" },
        () => {
          if (!cancelled) onChange?.();
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          // stop any polling fallback managed by parent
          onHeartbeatStop?.();
          // console.debug("[cases-rt] channel status:", status);
        }
      });

    // Optional polling heartbeat while subscribing/if dropped
    let timer: NodeJS.Timeout | null = null;
    const startHeartbeat = () => {
      if (timer) return;
      onHeartbeatStart?.();
      timer = setInterval(() => {
        fetch("/api/cases/heartbeat-list").catch(() => {});
      }, 15000);
    };
    const stopHeartbeat = () => {
      if (timer) clearInterval(timer);
      timer = null;
      onHeartbeatStop?.();
    };

    // Start heartbeat until SUBSCRIBED fires (parent should stop it there)
    startHeartbeat();

    return () => {
      cancelled = true;
      stopHeartbeat();
      supa.removeChannel(channel);
    };
  }, [onChange, onHeartbeatStart, onHeartbeatStop]);

  return null;
}
