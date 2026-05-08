/**
 * useCoinSignal — 클라이언트 사이드 BBDX 시그널 계산.
 *
 * useCoinDetail 의 candles + indicators 를 그대로 사용 (이미 계산되어 있음).
 * v6.5 머지 후에는 백엔드 signals.scan(symbol) 으로 갈아끼울 수 있도록
 * 결과 형태를 forward-compatible 하게 제공.
 */

import { useMemo } from "react";
import { useCoinDetail } from "@/hooks/useMarketData";
import {
  decideEntry,
  detectAllCandlePatterns,
  detectBBStructure,
  isFallingKnife,
  calculateBollingerBandsSeries,
  volumeRatio,
} from "@/lib/indicators-client";
import type { TimeframeValue, EntryDecision } from "@shared/types";

export interface CoinSignal {
  symbol: string;
  price: number;
  entry: EntryDecision | null;
  /** 0~100 — base BBDX strength (현 구현은 entry 가 있을 때 80, 없을 때 0) */
  finalConfidence: number;
  stopLoss: number;
  /** 0~1 — onchain · macro multiplier 적용 후 사이즈 비율 (현재는 1.0) */
  sizeFactor: number;
  isFallingKnife: boolean;
  /** v6.5 forward-compatible — 7차원 breakdown. 현재는 undefined */
  dimensions?: {
    bbdx: number;
    pattern: number;
    structure: number;
    volume: number;
    pressure: number;
    onchain?: number;
    macro?: number;
  };
}

export function useCoinSignal(
  symbol: string | undefined,
  interval: TimeframeValue
) {
  const { data: detail, isLoading } = useCoinDetail(symbol, interval, 100);

  const signal = useMemo<CoinSignal | null>(() => {
    if (!detail || !symbol) return null;
    const { candles, indicators } = detail;
    const closes = candles.map((c) => c.close);
    const bbSeries = calculateBollingerBandsSeries(closes);
    const patterns = detectAllCandlePatterns(candles);
    const bbStructure = detectBBStructure(candles, bbSeries);
    const ratio = volumeRatio(candles);
    const fallingKnife = isFallingKnife(
      indicators.plusDi,
      indicators.minusDi,
      indicators.adx
    );
    const entry = fallingKnife
      ? null
      : decideEntry(candles, indicators, patterns, bbStructure, ratio);
    const price = candles[candles.length - 1]?.close ?? 0;
    const stopLoss = indicators.bbLower * 0.97;
    return {
      symbol,
      price,
      entry,
      finalConfidence: entry ? 80 : 0,
      stopLoss,
      sizeFactor: 1.0,
      isFallingKnife: fallingKnife,
    };
  }, [detail, symbol]);

  return { signal, isLoading };
}
