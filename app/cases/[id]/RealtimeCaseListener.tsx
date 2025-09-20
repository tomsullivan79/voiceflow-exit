// app/cases/[id]/RealtimeCaseListener.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

type Props = {
  conversationId: string | null | undefined;
};

export default function RealtimeCaseListener({ conversationId }: Props) {
  const router = useRouter();

  useEffect(() => {
    if (!conversationId) return;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    // Local, lightweight browser client (keeps this component independent)
    const supabase = createClient(url, anon, {
      auth: { persistSession: false },
      realtime: { params: { eventsPerSecond: 2 } },
    });

    const channel = supabase
      .channel(`case-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "conversation_messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        // Any new message inserted for this conversation -> refresh the page
        () => {
          // Debounce-like micro-guard: rely on Next.js cache semantics
          router.refresh();
        }
      )
      .subscribe((status) => {
        // no-op; could log status if needed
      });

    return () => {
      supabase.removeChannel(channel);
      supabase.realtime?.disconnect();
    };
  }, [conversationId, router]);

  return null;
}
