// app/cases/RealtimeCasesListListener.tsx
"use client";

import { useEffect } from "react";
import { supabaseBrowser } from "../../lib/supabaseBrowser";

type Props = { onChange?: () => void };

export default function RealtimeCasesListListener({ onChange }: Props) {
  useEffect(() => {
    const supa = supabaseBrowser();

    const channel = supa
      .channel("cases-list", { config: { broadcast: { ack: false } } })
      // Any message insert (new activity on existing case)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "conversation_messages" },
        (payload) => {
          console.debug("[cases-rt] message insert", payload.new);
          onChange?.();
        }
      )
      // Any conversation insert/update (new case or changes)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations" },
        (payload) => {
          console.debug("[cases-rt] conversation change", payload.eventType, payload.new || payload.old);
          onChange?.();
        }
      )
      .subscribe((status) => {
        console.debug("[cases-rt] channel status:", status);
      });

    return () => {
      supa.removeChannel(channel);
    };
  }, [onChange]);

  return null;
}
