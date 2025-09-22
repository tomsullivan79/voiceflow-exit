// app/cases/[id]/RealtimeCaseListener.tsx
"use client";

import { useEffect } from "react";
import { supabaseBrowser } from "../../../lib/supabaseBrowser";

type Props = { conversationId: string; onChange?: () => void };

export default function RealtimeCaseListener({ conversationId, onChange }: Props) {
  useEffect(() => {
    if (!conversationId) return;

    const supa = supabaseBrowser();

    const channel = supa
      .channel(`case-${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "conversation_messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          console.debug("[case-rt] message insert", payload.new);
          onChange?.();
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "conversation_messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          console.debug("[case-rt] message update", payload.new);
          onChange?.();
        }
      )
      .subscribe((status) => {
        console.debug("[case-rt] channel status:", status);
      });

    return () => {
      supa.removeChannel(channel);
    };
  }, [conversationId, onChange]);

  return null;
}
