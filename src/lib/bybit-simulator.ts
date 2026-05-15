/**
 * Bybit V5 helpers — Simulator-specific (2026-05-15).
 *
 * 일반 `bybit-client.ts` 는 BBDX 시그널 트래커 (1h~1M) 전용이라 5 TF 만 지원.
 * Simulator 는 거래 UI 라서 1m~1M 의 9 TF 가 필요해 별도 helper 로 분리.
 *
 * + Order Book + Recent Trades helper 추가 (Bybit 거래소 UI 미러링).
 */

import type { Candle } from "@shared/types";

const BYBIT_BASE = "https://api.bybit.com";

export type SimTimeframe =
  | "1m"
  | "5m"
  | "15m"
  | "30m"
  | "1h"
  | "4h"
  | "1d"
  | "1w"
  | "1M";

export const SIM_TIMEFRAMES: Array<{ value: SimTimeframe; label: string }> = [
  { value: "1m", label: "1m" },
  { value: "5m", label: "5m" },
  { value: "15m", label: "15m" },
  { value: "30m", label: "30m" },
  { value: "1h", label: "1H" },
  { value: "4h", label: "4H" },
  { value: "1d", label: "1D" },
  { value: "1w", label: "1W" },
  { value: "1M", label: "1M" },
];

/** Bybit API interval string ("1", "5", "15", "30", "60", "240", "D", "W", "M") */
const BYBIT_INTERVAL: Record<SimTimeframe, string> = {
  "1m": "1",
  "5m": "5",
  "15m": "15",
  "30m": "30",
  "1h": "60",
  "4h": "240",
  "1d": "D",
  "1w": "W",
  "1M": "M",
};

/** Interval → ms (closeTime 계산용). 1M 은 평균 30일 추정. */
function intervalMs(tf: SimTimeframe): number {
  const map: Record<SimTimeframe, number> = {
    "1m": 60_000,
    "5m": 300_000,
    "15m": 900_000,
    "30m": 1_800_000,
    "1h": 3_600_000,
    "4h": 14_400_000,
    "1d": 86_400_000,
    "1w": 604_800_000,
    "1M": 2_592_000_000,
  };
  return map[tf];
}

async function bybitFetch<T>(
  path: string,
  params: Record<string, string | number>,
  timeoutMs = 10_000,
): Promise<T | null> {
  const url = new URL(`${BYBIT_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const json = await res.json();
    if (json.retCode !== 0) return null;
    return json.result as T;
  } catch {
    clearTimeout(t);
    return null;
  }
}

/** Klines for Simulator (9 TF 지원). */
export async function fetchSimKlines(
  symbol: string,
  timeframe: SimTimeframe = "1h",
  limit = 200,
): Promise<Candle[]> {
  const result = await bybitFetch<{ list: string[][] }>("/v5/market/kline", {
    category: "spot",
    symbol,
    interval: BYBIT_INTERVAL[timeframe],
    limit,
  });
  if (!result?.list?.length) return [];
  // Bybit: 최신 먼저 → reverse 로 시간순 정렬
  const sorted = [...result.list].reverse();
  const ms = intervalMs(timeframe);
  return sorted.map((k) => ({
    openTime: parseInt(k[0]),
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5]),
    closeTime: parseInt(k[0]) + ms,
  }));
}

export interface OrderBookLevel {
  price: number;
  size: number;
}

export interface OrderBookSnapshot {
  symbol: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  ts: number;
}

/**
 * Order Book (orderbook depth 50) — spot.
 * Bybit Open API: GET /v5/market/orderbook?category=spot&symbol=BTCUSDT&limit=50
 */
export async function fetchOrderBook(
  symbol: string,
  limit = 25,
): Promise<OrderBookSnapshot | null> {
  const result = await bybitFetch<{
    s: string;
    b: string[][];
    a: string[][];
    ts: number;
  }>("/v5/market/orderbook", {
    category: "spot",
    symbol,
    limit,
  });
  if (!result) return null;
  const parse = (arr: string[][]): OrderBookLevel[] =>
    arr
      .map((r) => ({ price: parseFloat(r[0]), size: parseFloat(r[1]) }))
      .filter((l) => l.price > 0 && l.size > 0);
  return {
    symbol: result.s,
    bids: parse(result.b),
    asks: parse(result.a),
    ts: result.ts ?? Date.now(),
  };
}

export interface RecentTrade {
  ts: number;
  price: number;
  size: number;
  side: "Buy" | "Sell";
}

/**
 * Recent trades (최근 체결 N건) — spot.
 * Bybit Open API: GET /v5/market/recent-trade?category=spot&symbol=BTCUSDT&limit=50
 */
export async function fetchRecentTrades(
  symbol: string,
  limit = 30,
): Promise<RecentTrade[]> {
  const result = await bybitFetch<{ list: any[] }>("/v5/market/recent-trade", {
    category: "spot",
    symbol,
    limit,
  });
  if (!result?.list) return [];
  return result.list.map((t) => ({
    ts: parseInt(t.time),
    price: parseFloat(t.price),
    size: parseFloat(t.size),
    side: (t.side ?? "Buy") as "Buy" | "Sell",
  }));
}

export interface SimTicker {
  symbol: string;
  lastPrice: number;
  bid1: number;
  ask1: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  turnover24h: number;
  pctChange24h: number;
}

/**
 * 24h ticker (가격 + 변동률 + 거래량). 헤더 바 표시용.
 */
export async function fetchSimTicker(symbol: string): Promise<SimTicker | null> {
  const result = await bybitFetch<{ list: any[] }>("/v5/market/tickers", {
    category: "spot",
    symbol,
  });
  if (!result?.list?.[0]) return null;
  const t = result.list[0];
  return {
    symbol: t.symbol,
    lastPrice: parseFloat(t.lastPrice),
    bid1: parseFloat(t.bid1Price),
    ask1: parseFloat(t.ask1Price),
    high24h: parseFloat(t.highPrice24h),
    low24h: parseFloat(t.lowPrice24h),
    volume24h: parseFloat(t.volume24h),
    turnover24h: parseFloat(t.turnover24h),
    pctChange24h: parseFloat(t.price24hPcnt) * 100,
  };
}
