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
  const lastSeenIdRef = useRef<string | null>(null);
  const pollTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!conversationId) return;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const supabase = createClient(url, anon, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      realtime: { params: { eventsPerSecond: 2 } },
    });

    const log = (...args: any[]) => {
      // eslint-disable-next-line no-console
      console.log("[case-rt]", ...args);
    };

    // Polling fallback
    const pollOnce = async () => {
      try {
        const res = await fetch(
          `/api/cases/heartbeat?conversation_id=${encodeURIComponent(conversationId)}`,
          { cache: "no-store" }
        );
        const json = await res.json();
        if (!json?.ok) {
          log("heartbeat error:", json?.error);
          return;
        }
        const latestId = json.latest_id as string | null;
        if (lastSeenIdRef.current === null) {
          // initialize baseline
          lastSeenIdRef.current = latestId;
          log("heartbeat baseline:", latestId);
          return;
        }
        if (latestId && latestId !== lastSeenIdRef.current) {
          log("heartbeat change detected:", latestId);
          lastSeenIdRef.current = latestId;
          if (!refreshingRef.current) {
            refreshingRef.current = true;
            setTimeout(() => {
              router.refresh();
              refreshingRef.current = false;
            }, 100);
          }
        }
      } catch (e) {
        log("heartbeat fetch failed:", (e as Error).message);
      }
    };

    const startPolling = () => {
      if (pollTimerRef.current) return;
      // immediate check, then every 5s
      void pollOnce();
      pollTimerRef.current = window.setInterval(pollOnce, 5000);
      log("polling started (5s)");
    };

    // Try to use realtime if we have a session; otherwise poll
    supabase.auth.getSession().then(({ data }) => {
      const hasSession = !!data.session;
      log("session?", hasSession);

      if (!hasSession) {
        startPolling();
        return;
      }

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
            log("INSERT received", payload?.new?.id || "");
            if (refreshingRef.current) return;
            refreshingRef.current = true;
            setTimeout(() => {
              router.refresh();
              refreshingRef.current = false;
            }, 150);
          }
        )
        .subscribe((status) => {
          log("channel status:", status);
          // If subscription ever fails, fall back to polling
          if (status !== "SUBSCRIBED") {
            startPolling();
          }
        });

      // Safety: also start polling after 10s if we never get a realtime event
      const safetyTimer = window.setTimeout(() => {
        startPolling();
      }, 10000);

      const cleanup = () => {
        window.clearTimeout(safetyTimer);
        supabase.removeChannel(channel);
      };

      // Save cleanup in ref
      (cleanup as any).keep = true;
      (RealtimeCaseListener as any)._cleanup = cleanup;
    });

    return () => {
      // Stop polling
      if (pollTimerRef.current) {
        window.clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      // Stop realtime channel
      const c = (RealtimeCaseListener as any)._cleanup;
      if (typeof c === "function") c();
    };
  }, [conversationId, router]);

  return null;
}
