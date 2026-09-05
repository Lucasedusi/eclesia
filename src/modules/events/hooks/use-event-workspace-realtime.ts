"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const WORKSPACE_REALTIME_TABLES = [
  "event_registrations",
  "event_registration_items",
  "event_registration_field_values",
  "event_payments",
  "event_groups",
  "event_documents",
  "event_payment_settings",
  "event_expenses",
] as const;

const REFRESH_DEBOUNCE_MS = 180;
const FALLBACK_REFRESH_MS = 5_000;

export function useEventWorkspaceRealtime(eventId: string) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let mounted = true;
    let refreshTimer: number | null = null;
    let fallbackTimer: number | null = null;

    const scheduleRefresh = (delay = REFRESH_DEBOUNCE_MS) => {
      if (!mounted) return;
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        refreshTimer = null;
        router.refresh();
      }, delay);
    };

    const startFallback = () => {
      if (fallbackTimer !== null) return;
      fallbackTimer = window.setInterval(scheduleRefresh, FALLBACK_REFRESH_MS);
    };

    const stopFallback = () => {
      if (fallbackTimer === null) return;
      window.clearInterval(fallbackTimer);
      fallbackTimer = null;
    };

    let channel = supabase.channel(`event-workspace:${eventId}`);
    for (const table of WORKSPACE_REALTIME_TABLES) {
      channel = channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `event_id=eq.${eventId}` },
        () => scheduleRefresh(),
      );
    }

    channel.subscribe((status) => {
      if (!mounted) return;
      if (status === "SUBSCRIBED") {
        stopFallback();
        scheduleRefresh(0);
        return;
      }
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") startFallback();
    });

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") scheduleRefresh(0);
    };
    const refreshWhenOnline = () => scheduleRefresh(0);

    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener("online", refreshWhenOnline);

    return () => {
      mounted = false;
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      stopFallback();
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener("online", refreshWhenOnline);
      void supabase.removeChannel(channel);
    };
  }, [eventId, router]);
}
