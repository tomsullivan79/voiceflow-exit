// app/cases/RealtimeCasesListListener.tsx
"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

export default function RealtimeCasesListListener() {
  const router = useRouter();
  const pollTimerRef = useRef<number | null>(null);
  const lastSeenIdRef = useRef<string | null>(null);
  const refreshingRef = useRef(false);
  const safetyRef = useRef<number | null>(null); // NEW: keep safety timeout id

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const supabase = createClient(url, anon, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      realtime: { params: { eventsPerSecond: 2 } },
    });

    const log = (...args: any[]) => console.log("[cases-rt]", ...args);

    const refreshSoon = () => {
      if (refreshingRef.current) return;
      refreshingRef.current = true;
      setTimeout(() => {
        router.refresh();
        refreshingRef.current = false;
      }, 120);
    };

    const pollOnce = async () => {
      try {
        const res = await fetch("/api/cases/heartbeat-list", { cache: "no-store" });
        const json = await res.json();
        if (!json?.ok) {
          log("heartbeat-list error:", json?.error);
          return;
        }
        const latestId = json.latest_id as string | null;
        if (lastSeenIdRef.current === null) {
          lastSeenIdRef.current = latestId;
          log("heartbeat-list baseline:", latestId);
          return;
        }
        if (latestId && latestId !== lastSeenIdRef.current) {
          lastSeenIdRef.current = latestId;
          log("heartbeat-list change:", latestId);
          refreshSoon();
        }
      } catch (e) {
        log("heartbeat-list fetch failed:", (e as Error).message);
      }
    };

    const startPolling = () => {
      if (pollTimerRef.current) return;
      void pollOnce();
      pollTimerRef.current = window.setInterval(pollOnce, 7000);
      log("polling started (7s)");
    };

    supabase.auth.getSession().then(({ data }) => {
      const hasSession = !!data.session;
      log("session?", hasSession);

      if (!hasSession) {
        startPolling();
        return;
      }

      const channel = supabase
        .channel("cases-list")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "conversation_messages" },
          (payload) => {
            log("message INSERT", payload?.new?.id || "");
            refreshSoon();
          }
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "conversations", filter: "closed_at=is.not.null" },
          (payload) => {
            log("conversation UPDATE (closed)", payload?.new?.id || "");
            refreshSoon();
          }
        )
        .subscribe((status) => {
          log("channel status:", status);
          if (status === "SUBSCRIBED") {
            // NEW: cancel safety fallback if realtime is healthy
            if (safetyRef.current) {
              window.clearTimeout(safetyRef.current);
              safetyRef.current = null;
            }
          } else {
            startPolling();
          }
        });

      // Safety: if we don’t get SUBSCRIBED in 10s, start polling
      safetyRef.current = window.setTimeout(startPolling, 10000);

      return () => {
        if (safetyRef.current) {
          window.clearTimeout(safetyRef.current);
          safetyRef.current = null;
        }
        supabase.removeChannel(channel);
      };
    });

    return () => {
      if (pollTimerRef.current) {
        window.clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [router]);

  return null;
}
