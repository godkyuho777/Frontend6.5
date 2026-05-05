/**
 * Client-side market data hook
 * 브라우저에서 직접 바이비트 API를 호출하여 시장 데이터를 가져옵니다.
 * 배포 서버의 외부 API 차단 문제를 우회합니다.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type { CoinScanResult, TimeframeValue } from "@shared/types";
import { TOP_COINS } from "@shared/types";
import { fetchKlines, fetchAll24hTickers } from "@/lib/bybit-client";
import {
  calculateAllIndicators,
  calculateBollingerBandsSeries,
  calculateEMA,
  calculateSignalStrengthV2,
  calculateVWAP,
  decideEntry,
  decideExit,
  decideVwapSignal,
  detectAllCandlePatterns,
  detectBBStructure,
  detectPullback,
  emaPosition,
  isFallingKnife,
  isInFibZone,
  pressureLabel,
  reversalProbability,
  volumeConfirmationFromRatio,
  volumeRatio,
  vwapPosition,
} from "@/lib/indicators-client";

interface ScanPageResult {
  coins: CoinScanResult[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// 인메모리 캐시
const scanCache = new Map<string, { data: CoinScanResult; timestamp: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10분

function cacheKey(symbol: string, interval: TimeframeValue): string {
  return `${symbol}:${interval}`;
}

/**
 * 단일 코인 스캔
 */
async function scanCoin(
  symbol: string,
  interval: TimeframeValue,
  tickerData?: { price: number; change24h: number; volume24h: number }
): Promise<CoinScanResult | null> {
  const key = cacheKey(symbol, interval);
  const cached = scanCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    if (tickerData) {
      // Refresh price-derived fields without recomputing patterns / decisions.
      cached.data.price = tickerData.price;
      cached.data.change24h = tickerData.change24h;
      cached.data.volume24h = tickerData.volume24h;
      cached.data.isStopLossHit =
        tickerData.price <= cached.data.stopLossPrice;
      // VWAP/EMA positions are price-relative — recompute cheaply.
      cached.data.vwapPosition = vwapPosition(tickerData.price, cached.data.vwap);
      cached.data.emaPosition = emaPosition(tickerData.price, cached.data.ema9);
    }
    return cached.data;
  }

  try {
    const candles = await fetchKlines(symbol, interval, 100);
    if (!candles.length) return null;

    const indicators = calculateAllIndicators(candles);
    const price = tickerData?.price ?? candles[candles.length - 1].close;
    const change24h = tickerData?.change24h ?? 0;
    const volume24h = tickerData?.volume24h ?? 0;

    // 피보나치 시그널 추가
    let fibSignal: CoinScanResult["fibSignal"];
    if (indicators.fibLevels) {
      for (const f of indicators.fibLevels) {
        if (f.isGoldenZone && isInFibZone(price, f.price)) {
          fibSignal = { level: f.level, price: f.price, type: f.level >= 0.5 ? "buy" : "sell" };
          break;
        }
      }
    }

    // BBDX-PATTERN v6.1 — match backend scan output
    const closes = candles.map((c) => c.close);
    const bbSeries = calculateBollingerBandsSeries(closes);
    const candlePatterns = detectAllCandlePatterns(candles);
    const bbStructure = detectBBStructure(candles, bbSeries);
    const ratio = volumeRatio(candles);
    const volConfirmation = volumeConfirmationFromRatio(ratio);
    const reversalProb = reversalProbability(indicators.adx);
    const pressure = pressureLabel(indicators.plusDi, indicators.minusDi);
    const pressureStrong =
      Math.abs(indicators.plusDi - indicators.minusDi) > 5;
    const fallingKnife = isFallingKnife(
      indicators.plusDi,
      indicators.minusDi,
      indicators.adx
    );
    const entryDecision = fallingKnife
      ? null
      : decideEntry(candles, indicators, candlePatterns, bbStructure, ratio);
    const bearishPatterns = candlePatterns.filter(
      (p) => p.bias === "bearish"
    );
    const exitDecision = decideExit(price, indicators, bearishPatterns);
    const stopLossPrice = indicators.bbLower * 0.97;
    const isStopLossHit = price <= stopLossPrice;

    // VWAP Strategy ──
    const vwap = indicators.vwap ?? calculateVWAP(candles);
    const ema9 = indicators.ema9 ?? calculateEMA(closes, 9);
    const vwapPos = vwapPosition(price, vwap);
    const emaPos = emaPosition(price, ema9);
    const pullbackDetected = detectPullback(candles, vwap, ema9);
    const vwapSignal = decideVwapSignal(price, vwap, ema9, pullbackDetected, ratio);

    const result: CoinScanResult = {
      symbol,
      price,
      change24h,
      volume24h,
      indicators,
      // Legacy boolean fields — derived from rich decisions for back-compat
      isEntrySignal: entryDecision != null || !!fibSignal,
      isExitSignal: exitDecision != null,
      signalStrength: calculateSignalStrengthV2(price, indicators, volConfirmation),
      fibSignal,
      // BBDX-PATTERN v6.1 fields
      pressure,
      pressureStrong,
      reversalProb,
      volumeRatio: ratio,
      volumeConfirmation: volConfirmation,
      candlePatterns,
      bbStructure,
      entryDecision,
      exitDecision,
      stopLossPrice,
      isStopLossHit,
      isFallingKnife: fallingKnife,
      // VWAP Strategy fields
      vwap,
      ema9,
      vwapPosition: vwapPos,
      emaPosition: emaPos,
      pullbackDetected,
      vwapSignal,
    };

    scanCache.set(key, { data: result, timestamp: Date.now() });
    return result;
  } catch (error: any) {
    console.warn(`[Scanner] Failed to scan ${symbol}:`, error.message);
    return null;
  }
}

/**
 * 페이지 단위 코인 스캔 (클라이언트 사이드)
 */
async function scanCoinsPage(
  page: number,
  pageSize: number,
  interval: TimeframeValue
): Promise<ScanPageResult> {
  const total = TOP_COINS.length;
  const totalPages = Math.ceil(total / pageSize);
  const startIdx = (page - 1) * pageSize;
  const pageSymbols = TOP_COINS.slice(startIdx, startIdx + pageSize);

  if (pageSymbols.length === 0) {
    return { coins: [], total, page, pageSize, totalPages };
  }

  // Step 1: 전체 티커 가져오기
  const tickers = await fetchAll24hTickers();

  // Step 2: 이 페이지의 코인들만 klines 가져오기 (병렬, 5개씩 배치)
  const coins: CoinScanResult[] = [];
  const batchSize = 5;

  for (let i = 0; i < pageSymbols.length; i += batchSize) {
    const batch = pageSymbols.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map((symbol) => {
        const ticker = tickers.get(symbol);
        return scanCoin(symbol, interval, ticker || undefined);
      })
    );

    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      if (result.status === "fulfilled" && result.value) {
        coins.push(result.value);
      } else {
        // 실패한 코인은 티커 데이터라도 표시
        const symbol = batch[j];
        const ticker = tickers.get(symbol);
        if (ticker) {
          coins.push({
            symbol,
            price: ticker.price,
            change24h: ticker.change24h,
            volume24h: ticker.volume24h,
            indicators: { rsi: 0, bbUpper: 0, bbMiddle: 0, bbLower: 0, adx: 0, plusDi: 0, minusDi: 0 },
            isEntrySignal: false,
            isExitSignal: false,
            signalStrength: 0,
            // BBDX-PATTERN v6.1 — empty defaults so the renderer doesn't
            // crash on partial failures.
            pressure: "NEUTRAL",
            pressureStrong: false,
            reversalProb: 0,
            volumeRatio: 1,
            volumeConfirmation: 0,
            candlePatterns: [],
            bbStructure: null,
            entryDecision: null,
            exitDecision: null,
            stopLossPrice: 0,
            isStopLossHit: false,
            isFallingKnife: false,
            // VWAP Strategy — empty defaults
            vwap: 0,
            ema9: 0,
            vwapPosition: "AT",
            emaPosition: "AT",
            pullbackDetected: false,
            vwapSignal: null,
          });
        }
      }
    }

    // 배치 간 짧은 딜레이 (rate limit 방지)
    if (i + batchSize < pageSymbols.length) {
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  return { coins, total, page, pageSize, totalPages };
}

/**
 * 시장 데이터 훅 - 페이지 단위 스캔
 */
export function useMarketScan(
  page: number,
  pageSize: number,
  interval: TimeframeValue
) {
  const [data, setData] = useState<ScanPageResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async (isRefetch = false) => {
    if (isRefetch) {
      setIsFetching(true);
    } else {
      setIsLoading(true);
    }
    setError(null);
    abortRef.current = false;

    try {
      const result = await scanCoinsPage(page, pageSize, interval);
      if (!abortRef.current) {
        setData(result);
      }
    } catch (err: any) {
      if (!abortRef.current) {
        setError(err);
      }
    } finally {
      if (!abortRef.current) {
        setIsLoading(false);
        setIsFetching(false);
      }
    }
  }, [page, pageSize, interval]);

  useEffect(() => {
    fetchData(false);

    // 5분마다 자동 리프레시
    intervalRef.current = setInterval(() => {
      fetchData(true);
    }, 5 * 60 * 1000);

    return () => {
      abortRef.current = true;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchData]);

  const refetch = useCallback(() => {
    // 캐시 클리어 후 다시 가져오기
    const startIdx = (page - 1) * pageSize;
    const pageSymbols = TOP_COINS.slice(startIdx, startIdx + pageSize);
    for (const symbol of pageSymbols) {
      scanCache.delete(cacheKey(symbol, interval));
    }
    fetchData(true);
  }, [page, pageSize, interval, fetchData]);

  return { data, isLoading, isFetching, error, refetch };
}

/**
 * 개별 코인 상세 데이터 훅
 *
 * Caches the fully-derived chart payload (candles + indicator series) by
 * `symbol:interval:limit` so back-and-forth between timeframes is instant
 * on re-visit. The cache TTL matches scanCache (10 min).
 */
import {
  calculateRSISeries,
  calculateADXSeries,
} from "@/lib/indicators-client";
import type { Candle, TechnicalIndicators } from "@shared/types";

type CoinDetailPayload = {
  candles: Candle[];
  indicators: TechnicalIndicators;
  rsiSeries: number[];
  adxSeries: { adx: number; plusDi: number; minusDi: number }[];
  bbSeries: { upper: number; middle: number; lower: number }[];
};

const detailCache = new Map<string, { data: CoinDetailPayload; timestamp: number }>();

function detailKey(symbol: string, interval: TimeframeValue, limit: number) {
  return `${symbol}:${interval}:${limit}`;
}

export function useCoinDetail(
  symbol: string | undefined,
  interval: TimeframeValue,
  limit = 100
) {
  const [data, setData] = useState<CoinDetailPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!symbol) return;

    let cancelled = false;
    setError(null);

    const key = detailKey(symbol, interval, limit);
    const cached = detailCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setData(cached.data);
      setIsLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setIsLoading(true);

    (async () => {
      try {
        const candles = await fetchKlines(symbol, interval, limit);
        if (cancelled) return;

        if (!candles.length) {
          setData(null);
          setIsLoading(false);
          return;
        }

        const indicators = calculateAllIndicators(candles);
        const closes = candles.map(c => c.close);
        const rsiSeries = calculateRSISeries(closes);
        const adxSeries = calculateADXSeries(candles);
        const bbSeries = calculateBollingerBandsSeries(closes);

        const payload: CoinDetailPayload = {
          candles,
          indicators,
          rsiSeries,
          adxSeries,
          bbSeries,
        };
        detailCache.set(key, { data: payload, timestamp: Date.now() });
        setData(payload);
      } catch (err: any) {
        if (!cancelled) setError(err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [symbol, interval, limit]);

  return { data, isLoading, error };
}
