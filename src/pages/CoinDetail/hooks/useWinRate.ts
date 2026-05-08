/**
 * useWinRate — 30/90/365 일 rolling 승률 + Wilson 95% CI.
 *
 * trpc.winRate.rolling 호출. 백엔드는 backtest 결과 캐시 기반.
 */

import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import type { TimeframeValue } from "@shared/types";

export interface WinRateWindow {
  windowDays: number;
  winRate: number;
  trades: number;
  ciLow: number;
  ciHigh: number;
}

const TF_MAP: Partial<Record<TimeframeValue, "1H" | "4H" | "1D" | "1W">> = {
  "1h": "1H",
  "4h": "4H",
  "6h": "4H", // 4H 로 근사 (백엔드가 6H 미지원)
  "1d": "1D",
  "1w": "1W",
  "1M": "1W", // 월봉은 주봉으로 근사
};

export function useWinRate(symbol: string | undefined, tf: TimeframeValue = "4h") {
  const query = trpc.winRate.rolling.useQuery(
    {
      symbol: symbol ?? "BTCUSDT",
      tf: TF_MAP[tf] ?? "4H",
      windows: [30, 90, 365],
    },
    {
      enabled: !!symbol,
      staleTime: 5 * 60_000,
      retry: 0,
    }
  );

  const windows = useMemo<WinRateWindow[]>(() => {
    const raw = query.data?.windows ?? [];
    return raw.map((w: any) => ({
      windowDays: w.days,
      winRate: w.winRate,
      trades: w.trades,
      ciLow: w.wilsonLow,
      ciHigh: w.wilsonHigh,
    }));
  }, [query.data]);

  return {
    windows,
    isLoading: query.isLoading,
    isAvailable: !query.isError && (query.data?.status ?? "real") !== "error",
    status: query.data?.status,
  };
}
