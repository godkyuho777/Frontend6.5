/**
 * Single-coin Fibonacci + Trendline analysis hook.
 * Fetches klines from Bybit and runs `analyzeFibonacci` client-side.
 */

import { useCallback, useEffect, useState } from "react";
import { fetchKlines } from "@/lib/bybit-client";
import { analyzeFibonacci, type FibonacciAnalysis } from "@/lib/fibonacci-engine";
import type { Candle, TimeframeValue } from "@shared/types";

interface FibDetailState {
  analysis: FibonacciAnalysis | null;
  candles: Candle[];
  isLoading: boolean;
  error: string | null;
}

export function useFibonacciDetail(symbol: string, timeframe: TimeframeValue = "1d") {
  const [state, setState] = useState<FibDetailState>({
    analysis: null,
    candles: [],
    isLoading: true,
    error: null,
  });

  const fetchData = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const candles = await fetchKlines(symbol, timeframe, 200);
      if (candles.length < 30) {
        setState({
          analysis: null,
          candles: [],
          isLoading: false,
          error: "Insufficient data",
        });
        return;
      }

      const analysis = analyzeFibonacci(candles);
      setState({ analysis, candles, isLoading: false, error: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to analyze";
      setState((prev) => ({ ...prev, isLoading: false, error: message }));
    }
  }, [symbol, timeframe]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { ...state, refetch: fetchData };
}
