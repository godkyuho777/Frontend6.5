/**
 * Trend Analysis Engine v2.0
 *
 * Multi-Timeframe Trend Analysis with ATR Dynamic + EMA Cross + ADX + Volume Confirmed.
 * 명세서 `Trend_Analysis_Engine_상세_기술_명세서_v2.md` (2026-05-05) 구현체.
 *
 * 핵심 파이프라인 (단일 타임프레임):
 *   1. ATR(14) 동적 임계값
 *   2. 지수가중 스윙 포인트 탐지
 *   3. 가중 최소자승 회귀 추세선 피팅
 *   4. 가격 위치 + 모멘텀 + EMA(9/21/50) 배열
 *   5. ADX(14) + 거래량 추세 + HH/HL 카운팅
 *   6. 4차 확인 시스템 (추세선 → EMA → ADX → 구조)
 *   7. 브레이크아웃 감지
 *   8. 7단계 phase 결정
 *
 * 멀티 타임프레임:
 *   - 가중치 (15m: 1, 1h: 2, 4h: 3, 1D: 4)
 *   - 종합 방향/강도/정렬도/신뢰도
 *   - 한글 + 영문 예측 텍스트
 */

import type { Candle } from "@shared/types";

// ─── Types ──────────────────────────────────────────────────────────

export type TrendDirection = "BULLISH" | "BEARISH" | "SIDEWAYS";

export type TrendPhase =
  | "STRONG_BULLISH"
  | "BULLISH"
  | "BULLISH_WEAKENING"
  | "SIDEWAYS"
  | "BEARISH_WEAKENING"
  | "BEARISH"
  | "STRONG_BEARISH";

export interface SwingPoint {
  index: number;
  price: number;
  time: number;
  type: "high" | "low";
  weight: number;
}

export interface TrendlineInfo {
  slope: number;
  intercept: number;
  slopePct: number;
  startPrice: number;
  endPrice: number;
  startIdx: number;
  endIdx: number;
  touchCount: number;
  durationCandles: number;
}

export interface EmaAlignment {
  ema9: number;
  ema21: number;
  ema50: number;
  state: "GOLDEN_CROSS" | "DEATH_CROSS" | "BULLISH_ALIGNED" | "BEARISH_ALIGNED" | "MIXED";
  description: string;
}

export interface HHLLCount {
  consecutiveHH: number;
  consecutiveHL: number;
  consecutiveLH: number;
  consecutiveLL: number;
  structureLabel: string;
}

export interface BreakoutInfo {
  detected: boolean;
  type: "BULLISH_BREAKOUT" | "BEARISH_BREAKDOWN" | "NONE";
  confidence: number;
  description: string;
}

export type PricePosition =
  | "ABOVE_RESISTANCE"
  | "NEAR_RESISTANCE"
  | "MID_RANGE"
  | "NEAR_SUPPORT"
  | "BELOW_SUPPORT";

export interface TimeframeTrend {
  timeframe: string;
  label: string;
  direction: TrendDirection;
  phase: TrendPhase;
  strength: number; // 0-100
  supportLine: TrendlineInfo | null;
  resistanceLine: TrendlineInfo | null;
  pricePosition: PricePosition;
  recentMomentum: number; // %
  volumeConfirmed: boolean;
  volumeTrend: "INCREASING" | "DECREASING" | "FLAT";
  emaAlignment: EmaAlignment;
  adxValue: number;
  adxTrending: boolean;
  hhllCount: HHLLCount;
  breakout: BreakoutInfo;
  reason: string;
}

export interface MultiTFTrendAnalysis {
  trends: TimeframeTrend[];
  overallDirection: TrendDirection;
  overallPhase: TrendPhase;
  overallStrength: number;
  prediction: string;
  predictionKo: string;
  confidence: number;
  alignment: "ALIGNED_BULL" | "ALIGNED_BEAR" | "DIVERGENT" | "MIXED";
}

// ─── Step 1: ATR + dynamic threshold ────────────────────────────────

export function calculateATR(candles: Candle[], period = 14): number {
  if (candles.length < period + 1) return 0;

  let atr = 0;
  for (let i = 1; i <= period; i++) {
    const tr = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i - 1].close),
      Math.abs(candles[i].low - candles[i - 1].close)
    );
    atr += tr;
  }
  atr /= period;

  // Wilder's smoothing
  for (let i = period + 1; i < candles.length; i++) {
    const tr = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i - 1].close),
      Math.abs(candles[i].low - candles[i - 1].close)
    );
    atr = (atr * (period - 1) + tr) / period;
  }

  return atr;
}

/**
 * ATR%를 기반으로 추세선 기울기 임계값을 동적으로 계산.
 * 변동성이 큰 코인일수록 높은 임계값을 요구.
 *   threshold(%) = clamp(0.01, ATR% × 0.03, 0.15)
 */
export function getDynamicThreshold(candles: Candle[]): number {
  const atr = calculateATR(candles);
  const sliceLen = Math.min(20, candles.length);
  if (sliceLen === 0) return 0.03;
  const avgPrice =
    candles.slice(-sliceLen).reduce((s, c) => s + c.close, 0) / sliceLen;
  if (avgPrice === 0) return 0.03;

  const atrPct = (atr / avgPrice) * 100;
  return Math.max(0.01, Math.min(0.15, atrPct * 0.03));
}

// ─── Step 2: Swing point detection (exp weighted) ───────────────────

export function findSwingPoints(
  candles: Candle[],
  windowSize: number = 5
): SwingPoint[] {
  const points: SwingPoint[] = [];
  if (candles.length < windowSize * 2 + 1) return points;

  const total = candles.length;

  for (let i = windowSize; i < candles.length - windowSize; i++) {
    let isHigh = true;
    let isLow = true;
    for (let j = i - windowSize; j <= i + windowSize; j++) {
      if (j === i) continue;
      if (candles[j].high >= candles[i].high) isHigh = false;
      if (candles[j].low <= candles[i].low) isLow = false;
    }

    const recency = i / total;
    const weight = 0.5 + recency * 1.5; // 0.5 ~ 2.0

    if (isHigh) {
      points.push({
        index: i,
        price: candles[i].high,
        time: candles[i].openTime,
        type: "high",
        weight,
      });
    }
    if (isLow) {
      points.push({
        index: i,
        price: candles[i].low,
        time: candles[i].openTime,
        type: "low",
        weight,
      });
    }
  }

  return points;
}

// ─── Step 3: Weighted linear regression ─────────────────────────────

export function fitTrendline(
  points: SwingPoint[],
  _candles: Candle[],
  _type: "high" | "low"
): TrendlineInfo | null {
  if (points.length < 2) return null;

  const maxPoints = Math.min(points.length, 10);
  const recent = points.slice(-maxPoints);

  let sumW = 0,
    sumWX = 0,
    sumWY = 0,
    sumWXY = 0,
    sumWX2 = 0;
  for (const p of recent) {
    const w = p.weight;
    sumW += w;
    sumWX += w * p.index;
    sumWY += w * p.price;
    sumWXY += w * p.index * p.price;
    sumWX2 += w * p.index * p.index;
  }

  const denom = sumW * sumWX2 - sumWX * sumWX;
  if (Math.abs(denom) < 1e-10) return null;

  const slope = (sumW * sumWXY - sumWX * sumWY) / denom;
  const intercept = (sumWY - slope * sumWX) / sumW;

  const tolerance = 0.005; // ±0.5%
  let touchCount = 0;
  for (const p of recent) {
    const expected = intercept + slope * p.index;
    if (expected > 0 && Math.abs(p.price - expected) / expected < tolerance) {
      touchCount++;
    }
  }

  const startIdx = recent[0].index;
  const endIdx = recent[recent.length - 1].index;
  const startPrice = intercept + slope * startIdx;
  const endPrice = intercept + slope * endIdx;
  const avgPrice = (startPrice + endPrice) / 2;
  const slopePct = avgPrice > 0 ? (slope / avgPrice) * 100 : 0;

  return {
    slope,
    intercept,
    slopePct,
    startPrice,
    endPrice,
    startIdx,
    endIdx,
    touchCount: Math.max(touchCount, 2),
    durationCandles: endIdx - startIdx,
  };
}

// ─── EMA series + alignment ─────────────────────────────────────────

export function calculateEMASeries(closes: number[], period: number): number[] {
  if (closes.length === 0) return [];
  if (closes.length < period) {
    const sma = closes.reduce((a, b) => a + b, 0) / closes.length;
    return closes.map(() => sma);
  }

  const result: number[] = [];
  const multiplier = 2 / (period + 1);
  const initSMA = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = 0; i < period - 1; i++) result.push(initSMA);
  result.push(initSMA);

  let prev = initSMA;
  for (let i = period; i < closes.length; i++) {
    const ema = (closes[i] - prev) * multiplier + prev;
    result.push(ema);
    prev = ema;
  }
  return result;
}

export function analyzeEmaAlignment(candles: Candle[]): EmaAlignment {
  const closes = candles.map((c) => c.close);
  const e9 = calculateEMASeries(closes, 9);
  const e21 = calculateEMASeries(closes, 21);
  const e50 = calculateEMASeries(closes, 50);

  const ema9 = e9[e9.length - 1] ?? 0;
  const ema21 = e21[e21.length - 1] ?? 0;
  const ema50 = e50[e50.length - 1] ?? 0;
  const prevEma9 = e9[e9.length - 2] ?? ema9;
  const prevEma21 = e21[e21.length - 2] ?? ema21;

  let state: EmaAlignment["state"];
  let description: string;

  if (prevEma9 <= prevEma21 && ema9 > ema21) {
    state = "GOLDEN_CROSS";
    description = "EMA(9)이 EMA(21) 상향 돌파 (골든 크로스) → 상승 전환 신호";
  } else if (prevEma9 >= prevEma21 && ema9 < ema21) {
    state = "DEATH_CROSS";
    description = "EMA(9)이 EMA(21) 하향 돌파 (데드 크로스) → 하락 전환 신호";
  } else if (ema9 > ema21 && ema21 > ema50) {
    state = "BULLISH_ALIGNED";
    description = "EMA 정배열 (9 > 21 > 50) → 상승 추세 확인";
  } else if (ema9 < ema21 && ema21 < ema50) {
    state = "BEARISH_ALIGNED";
    description = "EMA 역배열 (9 < 21 < 50) → 하락 추세 확인";
  } else {
    state = "MIXED";
    description = "EMA 혼합 배열 → 추세 불명확, 전환 구간 가능";
  }

  return { ema9, ema21, ema50, state, description };
}

// ─── ADX(14) ────────────────────────────────────────────────────────

export function calculateADXValue(candles: Candle[], period = 14): number {
  if (candles.length < period * 2 + 1) return 0;

  const trArr: number[] = [];
  const plusDmArr: number[] = [];
  const minusDmArr: number[] = [];

  for (let i = 1; i < candles.length; i++) {
    const cur = candles[i];
    const prev = candles[i - 1];
    trArr.push(
      Math.max(
        cur.high - cur.low,
        Math.abs(cur.high - prev.close),
        Math.abs(cur.low - prev.close)
      )
    );
    const upMove = cur.high - prev.high;
    const downMove = prev.low - cur.low;
    plusDmArr.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDmArr.push(downMove > upMove && downMove > 0 ? downMove : 0);
  }

  let smTR = trArr.slice(0, period).reduce((a, b) => a + b, 0);
  let smP = plusDmArr.slice(0, period).reduce((a, b) => a + b, 0);
  let smM = minusDmArr.slice(0, period).reduce((a, b) => a + b, 0);

  const dxArr: number[] = [];
  let plusDi = smTR > 0 ? (smP / smTR) * 100 : 0;
  let minusDi = smTR > 0 ? (smM / smTR) * 100 : 0;
  let diSum = plusDi + minusDi;
  if (diSum > 0) dxArr.push((Math.abs(plusDi - minusDi) / diSum) * 100);

  for (let i = period; i < trArr.length; i++) {
    smTR = smTR - smTR / period + trArr[i];
    smP = smP - smP / period + plusDmArr[i];
    smM = smM - smM / period + minusDmArr[i];
    plusDi = smTR > 0 ? (smP / smTR) * 100 : 0;
    minusDi = smTR > 0 ? (smM / smTR) * 100 : 0;
    diSum = plusDi + minusDi;
    if (diSum > 0) dxArr.push((Math.abs(plusDi - minusDi) / diSum) * 100);
  }

  let adx = 0;
  if (dxArr.length >= period) {
    adx = dxArr.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < dxArr.length; i++) {
      adx = (adx * (period - 1) + dxArr[i]) / period;
    }
  } else if (dxArr.length > 0) {
    adx = dxArr.reduce((a, b) => a + b, 0) / dxArr.length;
  }

  return adx;
}

// ─── Volume trend ───────────────────────────────────────────────────

export function analyzeVolumeTrend(candles: Candle[]): {
  confirmed: boolean;
  trend: "INCREASING" | "DECREASING" | "FLAT";
} {
  if (candles.length < 10) return { confirmed: false, trend: "FLAT" };

  const recentLen = Math.min(10, Math.floor(candles.length / 3));
  const olderLen = recentLen;
  const recentVol =
    candles.slice(-recentLen).reduce((s, c) => s + c.volume, 0) / recentLen;
  const olderSlice = candles.slice(-(recentLen + olderLen), -recentLen);
  if (olderSlice.length === 0) return { confirmed: false, trend: "FLAT" };
  const olderVol =
    olderSlice.reduce((s, c) => s + c.volume, 0) / olderSlice.length;

  if (olderVol === 0) return { confirmed: false, trend: "FLAT" };

  const ratio = (recentVol - olderVol) / olderVol;
  let trend: "INCREASING" | "DECREASING" | "FLAT";
  if (ratio > 0.15) trend = "INCREASING";
  else if (ratio < -0.15) trend = "DECREASING";
  else trend = "FLAT";

  return { confirmed: trend === "INCREASING" || trend === "FLAT", trend };
}

// ─── HH/HL/LH/LL ────────────────────────────────────────────────────

export function countHHLL(candles: Candle[], windowSize = 5): HHLLCount {
  const points = findSwingPoints(candles, windowSize);
  const highs = points.filter((p) => p.type === "high");
  const lows = points.filter((p) => p.type === "low");

  let hH = 0,
    hL = 0,
    lH = 0,
    lL = 0;
  for (let i = highs.length - 1; i > 0; i--) {
    if (highs[i].price > highs[i - 1].price) hH++;
    else break;
  }
  for (let i = lows.length - 1; i > 0; i--) {
    if (lows[i].price > lows[i - 1].price) hL++;
    else break;
  }
  for (let i = highs.length - 1; i > 0; i--) {
    if (highs[i].price < highs[i - 1].price) lH++;
    else break;
  }
  for (let i = lows.length - 1; i > 0; i--) {
    if (lows[i].price < lows[i - 1].price) lL++;
    else break;
  }

  let label: string;
  if (hH >= 2 && hL >= 2) label = `HH×${hH} / HL×${hL} (상승 구조)`;
  else if (lH >= 2 && lL >= 2) label = `LH×${lH} / LL×${lL} (하락 구조)`;
  else if (hH >= 1 && hL >= 1) label = `HH×${hH} / HL×${hL} (약한 상승)`;
  else if (lH >= 1 && lL >= 1) label = `LH×${lH} / LL×${lL} (약한 하락)`;
  else label = "구조 불명확 (Mixed)";

  return {
    consecutiveHH: hH,
    consecutiveHL: hL,
    consecutiveLH: lH,
    consecutiveLL: lL,
    structureLabel: label,
  };
}

// ─── Breakout detection ─────────────────────────────────────────────

export function detectBreakout(
  candles: Candle[],
  supportLine: TrendlineInfo | null,
  resistanceLine: TrendlineInfo | null
): BreakoutInfo {
  if (!supportLine || !resistanceLine || candles.length < 5) {
    return { detected: false, type: "NONE", confidence: 0, description: "데이터 부족" };
  }

  const isConverging = supportLine.slopePct > 0 && resistanceLine.slopePct < 0;
  const startGap = Math.abs(resistanceLine.startPrice - supportLine.startPrice);
  const endGap = Math.abs(resistanceLine.endPrice - supportLine.endPrice);
  const rangeNarrowing = endGap < startGap * 0.7;

  if (!isConverging && !rangeNarrowing) {
    return {
      detected: false,
      type: "NONE",
      confidence: 0,
      description: "수렴 패턴 미감지",
    };
  }

  const last3 = candles.slice(-3);
  const r = resistanceLine.endPrice;
  const s = supportLine.endPrice;
  const above = last3.filter((c) => c.close > r).length;
  const below = last3.filter((c) => c.close < s).length;

  if (above >= 2) {
    const conf = Math.min(90, 50 + above * 15 + (isConverging ? 10 : 0));
    return {
      detected: true,
      type: "BULLISH_BREAKOUT",
      confidence: conf,
      description: `저항선($${r.toFixed(2)}) 상향 돌파 확인.`,
    };
  }
  if (below >= 2) {
    const conf = Math.min(90, 50 + below * 15 + (isConverging ? 10 : 0));
    return {
      detected: true,
      type: "BEARISH_BREAKDOWN",
      confidence: conf,
      description: `지지선($${s.toFixed(2)}) 하향 이탈 확인.`,
    };
  }

  return { detected: false, type: "NONE", confidence: 0, description: "" };
}

// ─── Phase resolution (7-stage) ─────────────────────────────────────

export function determineTrendPhase(
  direction: TrendDirection,
  strength: number,
  emaState: EmaAlignment["state"],
  adxValue: number,
  recentMomentum: number,
  volumeConfirmed: boolean
): TrendPhase {
  if (direction === "BULLISH") {
    if (
      strength >= 70 &&
      emaState === "BULLISH_ALIGNED" &&
      adxValue > 25 &&
      volumeConfirmed
    ) {
      return "STRONG_BULLISH";
    }
    if (
      strength < 50 ||
      emaState === "MIXED" ||
      emaState === "DEATH_CROSS" ||
      recentMomentum < -0.5
    ) {
      return "BULLISH_WEAKENING";
    }
    return "BULLISH";
  }
  if (direction === "BEARISH") {
    if (
      strength >= 70 &&
      emaState === "BEARISH_ALIGNED" &&
      adxValue > 25 &&
      volumeConfirmed
    ) {
      return "STRONG_BEARISH";
    }
    if (
      strength < 50 ||
      emaState === "MIXED" ||
      emaState === "GOLDEN_CROSS" ||
      recentMomentum > 0.5
    ) {
      return "BEARISH_WEAKENING";
    }
    return "BEARISH";
  }
  return "SIDEWAYS";
}

// ─── Single-timeframe synthesis ─────────────────────────────────────

export function analyzeTimeframeTrend(
  candles: Candle[],
  timeframe: string,
  label: string
): TimeframeTrend {
  if (candles.length < 20) {
    return emptyTrend(timeframe, label, "데이터 부족 (<20 candles)");
  }

  const dynamicThreshold = getDynamicThreshold(candles);
  const points = findSwingPoints(candles);
  const highs = points.filter((p) => p.type === "high");
  const lows = points.filter((p) => p.type === "low");

  const resistanceLine = highs.length >= 2 ? fitTrendline(highs, candles, "high") : null;
  const supportLine = lows.length >= 2 ? fitTrendline(lows, candles, "low") : null;

  const lastCandle = candles[candles.length - 1];
  const lastClose = lastCandle.close;

  // Price position
  let pricePosition: PricePosition = "MID_RANGE";
  if (resistanceLine && supportLine) {
    const r = resistanceLine.endPrice;
    const s = supportLine.endPrice;
    if (lastClose > r * 1.005) pricePosition = "ABOVE_RESISTANCE";
    else if (lastClose > r * 0.995) pricePosition = "NEAR_RESISTANCE";
    else if (lastClose < s * 0.995) pricePosition = "BELOW_SUPPORT";
    else if (lastClose < s * 1.005) pricePosition = "NEAR_SUPPORT";
    else pricePosition = "MID_RANGE";
  }

  // Recent momentum (last 5 candles change %)
  const momLook = Math.min(5, candles.length - 1);
  const refClose = candles[candles.length - 1 - momLook].close;
  const recentMomentum = refClose > 0 ? ((lastClose - refClose) / refClose) * 100 : 0;

  // EMA / ADX / Volume / HH-LL
  const emaAlignment = analyzeEmaAlignment(candles);
  const adxValue = calculateADXValue(candles);
  const adxTrending = adxValue > 25;
  const volRes = analyzeVolumeTrend(candles);
  const hhllCount = countHHLL(candles);
  const breakout = detectBreakout(candles, supportLine, resistanceLine);

  // ── 4-stage direction confirmation ──
  const highSlope = resistanceLine?.slopePct ?? 0;
  const lowSlope = supportLine?.slopePct ?? 0;
  const avgSlope = (highSlope + lowSlope) / 2;
  const t = dynamicThreshold;

  let trendlineDirection: TrendDirection = "SIDEWAYS";
  let trendlineStrength = 30;

  if (lowSlope > t && highSlope > t) {
    trendlineDirection = "BULLISH";
    trendlineStrength = Math.min(100, Math.round((Math.abs(avgSlope) / t) * 30 + 40));
  } else if (lowSlope < -t && highSlope < -t) {
    trendlineDirection = "BEARISH";
    trendlineStrength = Math.min(100, Math.round((Math.abs(avgSlope) / t) * 30 + 40));
  } else if (lowSlope > t && highSlope < -t) {
    // Converging triangle
    trendlineDirection = "SIDEWAYS";
    trendlineStrength = Math.min(50, Math.round((Math.abs(highSlope - lowSlope) / t) * 15));
  } else if (lowSlope < -t && highSlope > t) {
    // Diverging
    trendlineDirection = "SIDEWAYS";
    trendlineStrength = Math.min(40, Math.round((Math.abs(highSlope - lowSlope) / t) * 10));
  } else if (avgSlope > t * 0.5) {
    trendlineDirection = "BULLISH";
    trendlineStrength = Math.min(50, Math.round((Math.abs(avgSlope) / t) * 20 + 15));
  } else if (avgSlope < -t * 0.5) {
    trendlineDirection = "BEARISH";
    trendlineStrength = Math.min(50, Math.round((Math.abs(avgSlope) / t) * 20 + 15));
  }

  // 2nd: EMA confirm
  let emaBonus = 0;
  if (emaAlignment.state === "BULLISH_ALIGNED" || emaAlignment.state === "GOLDEN_CROSS") {
    if (trendlineDirection === "BULLISH") emaBonus = 15;
    else if (trendlineDirection === "SIDEWAYS") emaBonus = 10;
  } else if (
    emaAlignment.state === "BEARISH_ALIGNED" ||
    emaAlignment.state === "DEATH_CROSS"
  ) {
    if (trendlineDirection === "BEARISH") emaBonus = 15;
    else if (trendlineDirection === "SIDEWAYS") emaBonus = 10;
  }

  // 3rd: ADX gate
  let direction = trendlineDirection;
  let strength = trendlineStrength + emaBonus;
  if (!adxTrending && adxValue < 20 && trendlineStrength < 60) {
    direction = "SIDEWAYS";
    strength = Math.min(strength, 40);
  }

  // 4th: HH/HL structure bonus
  let structureBonus = 0;
  if (hhllCount.consecutiveHH >= 2 && hhllCount.consecutiveHL >= 2) {
    if (direction === "BULLISH") structureBonus = 10;
  } else if (hhllCount.consecutiveLH >= 2 && hhllCount.consecutiveLL >= 2) {
    if (direction === "BEARISH") structureBonus = 10;
  }
  strength = Math.min(100, strength + structureBonus);

  // Momentum / volume corrections
  if (direction === "BULLISH" && recentMomentum > 1) strength = Math.min(100, strength + 10);
  else if (direction === "BULLISH" && recentMomentum < -1) strength = Math.max(10, strength - 15);
  else if (direction === "BEARISH" && recentMomentum < -1) strength = Math.min(100, strength + 10);
  else if (direction === "BEARISH" && recentMomentum > 1) strength = Math.max(10, strength - 15);

  if (!volRes.confirmed && direction !== "SIDEWAYS") {
    strength = Math.max(10, strength - 10);
  }

  const phase = determineTrendPhase(
    direction,
    strength,
    emaAlignment.state,
    adxValue,
    recentMomentum,
    volRes.confirmed
  );

  const reason = [
    `추세선: ${trendlineDirection} (avg slope ${avgSlope.toFixed(3)}%, threshold ${t.toFixed(3)}%)`,
    `EMA: ${emaAlignment.state}`,
    `ADX: ${adxValue.toFixed(1)} (${adxTrending ? "TRENDING" : adxValue < 20 ? "RANGING" : "WEAK"})`,
    `Momentum 5c: ${recentMomentum.toFixed(2)}%`,
    `Volume: ${volRes.trend}${volRes.confirmed ? " ✓" : " ✗"}`,
    `Structure: ${hhllCount.structureLabel}`,
    breakout.detected ? `Breakout: ${breakout.type} (${breakout.confidence}%)` : "",
  ]
    .filter(Boolean)
    .join(" | ");

  return {
    timeframe,
    label,
    direction,
    phase,
    strength: Math.round(strength),
    supportLine,
    resistanceLine,
    pricePosition,
    recentMomentum,
    volumeConfirmed: volRes.confirmed,
    volumeTrend: volRes.trend,
    emaAlignment,
    adxValue,
    adxTrending,
    hhllCount,
    breakout,
    reason,
  };
}

function emptyTrend(timeframe: string, label: string, reason: string): TimeframeTrend {
  return {
    timeframe,
    label,
    direction: "SIDEWAYS",
    phase: "SIDEWAYS",
    strength: 0,
    supportLine: null,
    resistanceLine: null,
    pricePosition: "MID_RANGE",
    recentMomentum: 0,
    volumeConfirmed: false,
    volumeTrend: "FLAT",
    emaAlignment: { ema9: 0, ema21: 0, ema50: 0, state: "MIXED", description: reason },
    adxValue: 0,
    adxTrending: false,
    hhllCount: {
      consecutiveHH: 0,
      consecutiveHL: 0,
      consecutiveLH: 0,
      consecutiveLL: 0,
      structureLabel: reason,
    },
    breakout: { detected: false, type: "NONE", confidence: 0, description: reason },
    reason,
  };
}

// ─── Multi-TF synthesis ─────────────────────────────────────────────

/**
 * 타임프레임별 가중치. 명세서는 (15m: 1, 1h: 2, 4h: 3, 1D: 4)이지만 우리
 * 시스템은 15m 캔들을 노출하지 않으므로 1h/4h/1d/1w 4개 TF 기준으로 재매핑.
 *   1h → 1, 4h → 2, 1d → 3, 1w → 4
 */
const TF_WEIGHTS: Record<string, number> = {
  "15m": 1, // legacy support if added later
  "1h": 1,
  "4h": 2,
  "1d": 3,
  "1D": 3,
  "1w": 4,
  "1W": 4,
};

export function synthesizeMultiTFTrend(
  trends: TimeframeTrend[]
): MultiTFTrendAnalysis {
  if (trends.length === 0) {
    return {
      trends,
      overallDirection: "SIDEWAYS",
      overallPhase: "SIDEWAYS",
      overallStrength: 0,
      prediction: "Insufficient data",
      predictionKo: "데이터 부족",
      confidence: 0,
      alignment: "MIXED",
    };
  }

  let bullScore = 0,
    bearScore = 0,
    totalWeight = 0;
  let bullCount = 0,
    bearCount = 0;
  let confirmedCount = 0;

  for (const t of trends) {
    const w = TF_WEIGHTS[t.timeframe] ?? 1;
    totalWeight += w;
    if (t.direction === "BULLISH") {
      bullScore += w * (t.strength / 100);
      bullCount++;
    } else if (t.direction === "BEARISH") {
      bearScore += w * (t.strength / 100);
      bearCount++;
    }
    if (t.volumeConfirmed && t.adxTrending) confirmedCount++;
  }

  const normBull = totalWeight > 0 ? (bullScore / totalWeight) * 100 : 0;
  const normBear = totalWeight > 0 ? (bearScore / totalWeight) * 100 : 0;
  const diff = normBull - normBear;

  let overallDirection: TrendDirection;
  let overallStrength: number;
  if (diff > 15) {
    overallDirection = "BULLISH";
    overallStrength = Math.min(100, Math.round(normBull));
  } else if (diff < -15) {
    overallDirection = "BEARISH";
    overallStrength = Math.min(100, Math.round(normBear));
  } else {
    overallDirection = "SIDEWAYS";
    overallStrength = Math.round(Math.max(normBull, normBear) * 0.5);
  }

  // Alignment
  let alignment: MultiTFTrendAnalysis["alignment"];
  if (bullCount === trends.length) alignment = "ALIGNED_BULL";
  else if (bearCount === trends.length) alignment = "ALIGNED_BEAR";
  else if (bullCount > 0 && bearCount > 0) alignment = "DIVERGENT";
  else alignment = "MIXED";

  // Confidence
  const maxCount = Math.max(bullCount, bearCount);
  const baseConfidence =
    (maxCount / trends.length) * 100 * (overallStrength / 100 + 0.3);
  const confirmBonus = (confirmedCount / trends.length) * 20;
  const confidence = Math.min(100, Math.round(baseConfidence + confirmBonus));

  // Overall phase: highest-weight timeframe wins phase
  const overallTrend = [...trends].sort(
    (a, b) => (TF_WEIGHTS[b.timeframe] ?? 1) - (TF_WEIGHTS[a.timeframe] ?? 1)
  )[0];
  const overallPhase = overallTrend?.phase ?? "SIDEWAYS";

  // Predictions
  const breakoutTrend = trends.find((t) => t.breakout.detected);
  const weakeningTrend = trends.find(
    (t) => t.phase === "BULLISH_WEAKENING" || t.phase === "BEARISH_WEAKENING"
  );

  let prediction: string;
  let predictionKo: string;

  if (breakoutTrend) {
    const isBull = breakoutTrend.breakout.type === "BULLISH_BREAKOUT";
    prediction = `🔥 ${isBull ? "BULLISH BREAKOUT" : "BEARISH BREAKDOWN"} on ${breakoutTrend.label}: ${breakoutTrend.breakout.description} Confidence ${breakoutTrend.breakout.confidence}%.`;
    predictionKo = `🔥 ${breakoutTrend.label}에서 ${isBull ? "상향 돌파" : "하향 이탈"} 감지 — ${breakoutTrend.breakout.description} 신뢰도 ${breakoutTrend.breakout.confidence}%.`;
  } else if (weakeningTrend && overallStrength < 60) {
    prediction = `⚠ WEAKENING: ${overallDirection.toLowerCase()} trend losing momentum on ${weakeningTrend.label}. Consider tightening stops; wait for re-confirmation.`;
    predictionKo = `⚠ 약화: ${weakeningTrend.label}에서 ${overallDirection === "BULLISH" ? "상승" : overallDirection === "BEARISH" ? "하락" : "현재"} 추세가 모멘텀을 잃는 중. 손절선 강화 또는 부분 익절 고려.`;
  } else if (alignment === "ALIGNED_BULL" && overallStrength >= 70) {
    prediction = `🚀 STRONG BULL: All timeframes aligned bullish with ${overallStrength}% strength. Look for EMA(9) pullback entries on support.`;
    predictionKo = `🚀 강한 상승: 모든 타임프레임이 상승 정렬 (강도 ${overallStrength}%). 지지선 + EMA(9) 되돌림 진입 기회 탐색.`;
  } else if (alignment === "ALIGNED_BEAR" && overallStrength >= 70) {
    prediction = `📉 STRONG BEAR: All timeframes aligned bearish with ${overallStrength}% strength. Counter-trend bounces likely fade at EMA(9)/EMA(21).`;
    predictionKo = `📉 강한 하락: 모든 타임프레임이 하락 정렬 (강도 ${overallStrength}%). 반등은 EMA(9)/EMA(21)에서 약세 마감 가능성.`;
  } else if (alignment === "ALIGNED_BULL") {
    prediction = `Bullish alignment across timeframes (strength ${overallStrength}%). Wait for confirmation candle before adding.`;
    predictionKo = `타임프레임 전반 상승 정렬 (강도 ${overallStrength}%). 추가 진입 전 확정 캔들 대기 권장.`;
  } else if (alignment === "ALIGNED_BEAR") {
    prediction = `Bearish alignment across timeframes (strength ${overallStrength}%). Avoid counter-trend longs.`;
    predictionKo = `타임프레임 전반 하락 정렬 (강도 ${overallStrength}%). 역추세 롱 자제.`;
  } else if (alignment === "DIVERGENT") {
    const lower = trends.find((t) => t.timeframe === "15m" || t.timeframe === "1h");
    const higher = trends.find((t) => t.timeframe === "4h" || t.timeframe === "1D" || t.timeframe === "1d");
    if (lower && higher && lower.direction !== higher.direction) {
      prediction = `Short-term ${lower.direction.toLowerCase()} bounce within larger ${higher.direction.toLowerCase()} trend. ${lower.label} ${lower.direction.toLowerCase()} but ${higher.label} ${higher.direction.toLowerCase()}. Potential ${higher.direction === "BEARISH" ? "bull trap" : "bear trap"} — wait for higher TF EMA alignment.`;
      predictionKo = `${higher.label} ${higher.direction === "BULLISH" ? "상승" : higher.direction === "BEARISH" ? "하락" : "횡보"} 흐름 안에서 ${lower.label}의 단기 ${lower.direction === "BULLISH" ? "반등" : lower.direction === "BEARISH" ? "되돌림" : "정체"}. 상위 TF EMA 정렬까지 대기.`;
    } else {
      prediction = "Divergent signals across timeframes — no clear bias.";
      predictionKo = "타임프레임 간 신호 충돌 — 명확한 방향성 부재.";
    }
  } else {
    prediction = "No clear bias yet — wait for stronger alignment.";
    predictionKo = "아직 명확한 방향 없음 — 정렬 강화될 때까지 대기.";
  }

  return {
    trends,
    overallDirection,
    overallPhase,
    overallStrength,
    prediction,
    predictionKo,
    confidence,
    alignment,
  };
}
