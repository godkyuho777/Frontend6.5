/**
 * useUpcomingEvents — 코인별 예정 이벤트 (token unlock, mainnet upgrade 등).
 *
 * trpc.events.list 호출 — symbol + global 이벤트 모두 horizon 30 일.
 */

import { useMemo } from "react";
import { trpc } from "@/lib/trpc";

export interface UpcomingEvent {
  id: string;
  date: string;
  daysUntil: number;
  title: string;
  description: string;
  eventType: "unlock" | "upgrade" | "fork" | "listing" | "other";
}

const EVENT_TYPE_MAP: Record<string, UpcomingEvent["eventType"]> = {
  unlock: "unlock",
  fork: "fork",
  listing: "listing",
  halving: "upgrade",
  macro: "other",
  custom: "other",
};

export function useUpcomingEvents(symbol: string | undefined) {
  const query = trpc.events.list.useQuery(
    { symbol, days: 30 },
    {
      enabled: !!symbol,
      staleTime: 60_000,
      retry: 0,
    }
  );

  const events = useMemo<UpcomingEvent[]>(() => {
    const raw = query.data?.events ?? [];
    const now = Date.now();
    return raw.map((e: any) => {
      const dateMs = new Date(e.scheduledAt).getTime();
      const daysUntil = Math.max(0, Math.round((dateMs - now) / 86_400_000));
      return {
        id: String(e.id),
        date: e.scheduledAt,
        daysUntil,
        title: e.title,
        description: e.description ?? "",
        eventType: EVENT_TYPE_MAP[e.eventType] ?? "other",
      };
    });
  }, [query.data]);

  return {
    events,
    isLoading: query.isLoading,
    isAvailable: !query.isError,
  };
}
