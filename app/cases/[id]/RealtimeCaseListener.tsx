// app/cases/[id]/RealtimeCaseListener.tsx
"use client";

import { useEffect } from "react";
import { supabaseBrowser } from "../../../lib/supabaseBrowser";

type Props = {
  conversationId: string;
  onChange?: () => void;
  onHeartbeat?: (info: string) => void;
};

export default function RealtimeCaseListener({ conversationId, onChange, onHeartbeat }: Props) {
  useEffect(() => {
    if (!conversationId) return;

    let cancelled = false;
    const supa = supabaseBrowser();

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
        () => {
          if (!cancelled) onChange?.();
        }
      )
      .subscribe(async (status) => {
        // Optional heartbeat to poke ISR/cache or just log liveness
        try {
          const res = await fetch(`/api/cases/heartbeat?conversation_id=${encodeURIComponent(conversationId)}`);
          const txt = await res.text();
          onHeartbeat?.(`[case-rt:${status}] ${txt.slice(0, 80)}`);
        } catch {
          onHeartbeat?.(`[case-rt:${status}] heartbeat fetch failed`);
        }
      });

    return () => {
      cancelled = true;
      supa.removeChannel(channel);
    };
  }, [conversationId, onChange, onHeartbeat]);

  return null;
}
