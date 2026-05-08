/**
 * useCoinMeta — 코인 메타데이터 (시총, 거래량, dominance, ssrZScore).
 *
 * 백엔드 trpc.coin.meta (CoinGecko Free 기반) 호출.
 * status: "real" | "stub" | "error" 그대로 노출하여 UI 가 결정.
 */

import { useMemo } from "react";
import { trpc } from "@/lib/trpc";

export interface CoinMeta {
  symbol: string;
  mcap: number | null;
  volume24h: number | null;
  supply: number | null;
  dominance: number | null;
  ssrZScore: number | null;
  status: "real" | "stub" | "error" | "loading";
  detail?: string;
}

export function useCoinMeta(symbol: string | undefined) {
  const metaQuery = trpc.coin.meta.useQuery(
    { symbol: symbol ?? "BTCUSDT" },
    {
      enabled: !!symbol,
      staleTime: 60_000,
      retry: 0,
    }
  );

  const meta = useMemo<CoinMeta | null>(() => {
    if (!symbol) return null;
    if (!metaQuery.data) {
      return {
        symbol,
        mcap: null,
        volume24h: null,
        supply: null,
        dominance: null,
        ssrZScore: null,
        status: metaQuery.isError ? "error" : "loading",
        detail: metaQuery.error?.message,
      };
    }
    const d = metaQuery.data;
    return {
      symbol: d.symbol,
      mcap: d.mcap,
      volume24h: d.volume24h,
      supply: d.circulatingSupply,
      dominance: d.dominance,
      ssrZScore: d.ssrZScore,
      status: d.status,
      detail: d.detail,
    };
  }, [symbol, metaQuery.data, metaQuery.isError, metaQuery.error]);

  return { meta, isLoading: metaQuery.isLoading };
}
