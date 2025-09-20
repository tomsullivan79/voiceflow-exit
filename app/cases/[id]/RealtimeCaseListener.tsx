// app/cases/[id]/RealtimeCaseListener.tsx
"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

type Props = {
  conversationId: string | null | undefined;
};

export default function RealtimeCaseListener({ conversationId }: Props) {
  const router = useRouter();
  const refreshingRef = useRef(false);

  useEffect(() => {
    if (!conversationId) return;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    // IMPORTANT: carry the user's session so RLS allows postgres_changes.
    const supabase = createClient(url, anon, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      realtime: { params: { eventsPerSecond: 2 } },
    });

    // Optional: quick sanity log to ensure we have a session JWT.
    supabase.auth.getSession().then(({ data }) => {
      // eslint-disable-next-line no-console
      console.log(
        "[case-rt] session?",
        !!data.session,
        data.session ? "(exp " + data.session.expires_at + ")" : ""
      );
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
        (payload) => {
          // eslint-disable-next-line no-console
          console.log("[case-rt] INSERT received", payload?.new?.id || "");
          if (refreshingRef.current) return;
          refreshingRef.current = true;
          // Short delay to let server-rendered page pick up latest query
          setTimeout(() => {
            router.refresh();
            refreshingRef.current = false;
          }, 150);
        }
      )
      .subscribe((status) => {
        // eslint-disable-next-line no-console
        console.log("[case-rt] channel status:", status);
      });

    return () => {
      supabase.removeChannel(channel);
      // Don't force disconnect globally; other tabs/components may use realtime
    };
  }, [conversationId, router]);

  return null;
}
