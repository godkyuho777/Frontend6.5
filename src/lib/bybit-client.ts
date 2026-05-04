/**
 * Client-side Bybit V5 API module
 * 브라우저에서 직접 바이비트 API를 호출합니다.
 * 배포 서버의 외부 API 차단 문제를 우회합니다.
 */

import type { Candle, TimeframeValue } from "@shared/types";
import { BYBIT_INTERVAL_MAP } from "@shared/types";

const BYBIT_BASE = "https://api.bybit.com";

/**
 * Bybit API GET 요청 (브라우저에서 직접 호출)
 */
async function bybitFetch<T>(
  path: string,
  params: Record<string, string | number>,
  timeoutMs = 15000
): Promise<T | null> {
  const url = new URL(`${BYBIT_BASE}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`[BybitClient] HTTP ${response.status} for ${path}`);
      return null;
    }

    const data = await response.json();
    if (data.retCode !== 0) {
      console.warn(`[BybitClient] API error: ${data.retMsg} (code: ${data.retCode})`);
      return null;
    }
    return data.result as T;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === "AbortError") {
      console.warn(`[BybitClient] Timeout for ${path}`);
    } else {
      console.warn(`[BybitClient] Error: ${error.message}`);
    }
    return null;
  }
}

/**
 * 타임프레임별 밀리초 간격
 */
function getIntervalMs(interval: TimeframeValue): number {
  const map: Record<string, number> = {
    "1h": 3600000,
    "4h": 14400000,
    "6h": 21600000,
    "1d": 86400000,
    "1w": 604800000,
    "1M": 2592000000,
  };
  return map[interval] || 14400000;
}

/**
 * 캔들 데이터 조회
 */
export async function fetchKlines(
  symbol: string,
  interval: TimeframeValue = "4h",
  limit = 100
): Promise<Candle[]> {
  const bybitInterval = BYBIT_INTERVAL_MAP[interval] || "240";

  const result = await bybitFetch<{ list: string[][] }>(
    "/v5/market/kline",
    { category: "spot", symbol, interval: bybitInterval, limit }
  );

  if (!result?.list?.length) return [];

  // 바이비트는 최신이 먼저 → 역순 정렬
  const sorted = [...result.list].reverse();

  return sorted.map((k) => ({
    openTime: parseInt(k[0]),
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5]),
    closeTime: parseInt(k[0]) + getIntervalMs(interval),
  }));
}

/**
 * 전체 24h 티커 일괄 조회 (단일 API 호출)
 */
export async function fetchAll24hTickers(): Promise<
  Map<string, { price: number; change24h: number; volume24h: number }>
> {
  const result = await bybitFetch<{ list: any[] }>(
    "/v5/market/tickers",
    { category: "spot" },
    20000
  );

  const tickerMap = new Map<string, { price: number; change24h: number; volume24h: number }>();

  if (!result?.list) return tickerMap;

  for (const item of result.list) {
    if (item.symbol?.endsWith("USDT")) {
      tickerMap.set(item.symbol, {
        price: parseFloat(item.lastPrice),
        change24h: parseFloat(item.price24hPcnt) * 100,
        volume24h: parseFloat(item.turnover24h),
      });
    }
  }

  return tickerMap;
}

/**
 * 단일 심볼 24h 티커
 */
export async function fetch24hTicker(symbol: string) {
  const result = await bybitFetch<{ list: any[] }>(
    "/v5/market/tickers",
    { category: "spot", symbol }
  );

  if (!result?.list?.[0]) return null;
  const item = result.list[0];

  return {
    price: parseFloat(item.lastPrice),
    change24h: parseFloat(item.price24hPcnt) * 100,
    volume24h: parseFloat(item.turnover24h),
  };
}
