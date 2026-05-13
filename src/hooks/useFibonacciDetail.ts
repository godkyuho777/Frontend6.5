/**
 * Single-coin Fibonacci + Trendline analysis hook.
 * Fetches klines from Bybit and runs `analyzeFibonacci` client-side.
 *
 * 2026-05-14: TimeframeValue → FibTimeframe (1h/4h/1d) 매핑 후 analyzeFibonacci 에 전달.
 * 그 외 TF (6h/1w/1M) 는 가장 가까운 지원 TF 로 fallback.
 */

import { useCallback, useEffect, useState } from "react";
import { fetchKlines } from "@/lib/bybit-client";
import {
  analyzeFibonacci,
  type FibonacciAnalysis,
  type FibTimeframe,
} from "@/lib/fibonacci-engine";
import type { Candle, TimeframeValue } from "@shared/types";

interface FibDetailState {
  analysis: FibonacciAnalysis | null;
  candles: Candle[];
  isLoading: boolean;
  error: string | null;
  /** 실제 분석에 사용된 fib TF (TimeframeValue → FibTimeframe 매핑 후) */
  fibTf: FibTimeframe;
}

/**
 * 일반 TimeframeValue (1h/4h/6h/1d/1w/1M) → FibTimeframe (1h/4h/1d) 매핑.
 * 6h → 4h, 1w/1M → 1d 로 fallback.
 */
function toFibTimeframe(tf: TimeframeValue): FibTimeframe {
  if (tf === "1h") return "1h";
  if (tf === "4h" || tf === "6h") return "4h";
  return "1d";
}

export function useFibonacciDetail(symbol: string, timeframe: TimeframeValue = "1d") {
  const fibTf = toFibTimeframe(timeframe);

  const [state, setState] = useState<FibDetailState>({
    analysis: null,
    candles: [],
    isLoading: true,
    error: null,
    fibTf,
  });

  const fetchData = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null, fibTf }));

    try {
      const candles = await fetchKlines(symbol, timeframe, 200);
      if (candles.length < 30) {
        setState({
          analysis: null,
          candles: [],
          isLoading: false,
          error: "Insufficient data",
          fibTf,
        });
        return;
      }

      const analysis = analyzeFibonacci(candles, fibTf);
      setState({ analysis, candles, isLoading: false, error: null, fibTf });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to analyze";
      setState((prev) => ({ ...prev, isLoading: false, error: message, fibTf }));
    }
  }, [symbol, timeframe, fibTf]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { ...state, refetch: fetchData };
}
