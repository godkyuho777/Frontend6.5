/**
 * Fibonacci Golden Ratio & Trendline Engine
 * 일봉 기준 피보나치 되돌림 레벨 계산 + 단기 추세 빗각 감지
 * 클라이언트 사이드 순수 함수 모듈
 *
 * 2026-05-14 업데이트:
 *  - TF-aware (1h/4h/1d) lookback + slope sanity 분화
 *  - Inflection-point anchored trendline (추세 변환 지점부터 시작)
 *  - Linear regression best-fit (brute-force pair 검색 폐기)
 *  - Slope sanity check — 비합리적 slope 거부
 *
 * 2026-05-15 업데이트:
 *  - Trendline detection 로직을 `trendline-engine.ts` 의 V2 (3-tier fallback)
 *    로 교체. 구 `detectTrendlines` / `detectInflectionPoint` /
 *    `findLocalSwingPoints` / `buildTrendlineFromInflection` 는 deprecated.
 *    아직 외부에서 import 하는 곳이 있을 수 있어 보존만 함.
 */

import type { Candle } from "@shared/types";
import {
  detectTrendlinesV2,
  type Trendline as TrendlineV2,
} from "./trendline-engine";

// ─── Types ───────────────────────────────────────────────────────────

/** 피보나치 레벨 */
export interface FibLevel {
  ratio: number;       // 0, 0.236, 0.382, 0.5, 0.618, 0.786, 1
  price: number;       // 해당 레벨의 가격
  zoneHigh: number;    // 오차범위 상한 (+0.5%)
  zoneLow: number;     // 오차범위 하한 (-0.5%)
  label: string;       // "0.618 (Golden Ratio)" 등
}

/** 스윙 포인트 (고점/저점) */
export interface SwingPoint {
  index: number;
  time: number;
  price: number;
  type: "high" | "low";
}

/** 지원 타임프레임 (Fibonacci 전용 subset) */
export type FibTimeframe = "1h" | "4h" | "1d";

/** 추세 빗각 (Trendline) */
export interface Trendline {
  startPoint: { time: number; price: number; index: number };
  endPoint: { time: number; price: number; index: number };
  slope: number;          // 기울기 (price per candle)
  intercept: number;      // y절편 (linear regression)
  type: "support" | "resistance";
  touchCount: number;     // 터치한 캔들 수
  durationDays: number;   // 유지 기간 (일)
  isValid: boolean;       // 유효성 (3개 터치 또는 7일 이상)
  currentPrice: number;   // 현재 시점에서의 빗각 가격
  rSquared: number;       // 회귀 fit 품질 (0~1)
  tf: FibTimeframe;       // 사용된 TF
  /**
   * Trendline V2 (2026-05-15) — 어느 fallback tier 에서 만들어졌나.
   * "ransac" = robust RANSAC, "regression" = linear regression best-fit,
   * "two-pivot" = lookback 내 가장 낮은/높은 두 swing 으로 그린 hint 라인.
   * 미지정 시 legacy 분석 (regression default).
   */
  quality?: "ransac" | "regression" | "two-pivot";
  /** Tier 3 fallback 일 때 true — 차트에서 옅은 dashed + "AUTO" 라벨로 그리기 */
  isVisualHint?: boolean;
}

/** 피보나치 매매 시그널 */
export interface FibSignal {
  type: "BUY" | "SELL" | "NONE";
  strength: number;       // 0-100
  fibLevel: number | null;
  trendlineTouch: boolean;
  reasons: string[];
  currentPrice: number;
}

/** 전체 분석 결과 */
export interface FibonacciAnalysis {
  swingHigh: SwingPoint;
  swingLow: SwingPoint;
  fibLevels: FibLevel[];
  trendlines: Trendline[];
  signal: FibSignal;
  trend: "UP" | "DOWN" | "SIDEWAYS";
  currentZone: string;    // 현재 가격이 위치한 피보나치 존
  tf: FibTimeframe;       // 분석에 사용된 TF
}

// ─── Constants ───────────────────────────────────────────────────────

const FIB_RATIOS = [
  { ratio: 0, label: "0 (High)" },
  { ratio: 0.236, label: "0.236" },
  { ratio: 0.382, label: "0.382" },
  { ratio: 0.5, label: "0.5" },
  { ratio: 0.618, label: "0.618 (Golden)" },
  { ratio: 0.786, label: "0.786" },
  { ratio: 1, label: "1.0 (Low)" },
];

const ZONE_TOLERANCE = 0.005; // ±0.5%
const MIN_TOUCH_COUNT = 3;
const MIN_DURATION_DAYS = 7;
const TRENDLINE_TOLERANCE = 0.005; // ±0.5% for trendline touch

/**
 * TF 별 trendline 검출 파라미터.
 *  - swingWindow: local swing 좌우 비교 캔들 수 (값↑ = 더 굵은 swing)
 *  - lookback: 추세선 검색 lookback 캔들 수
 *  - slopeMaxPctPerCandle: 캔들당 허용되는 최대 % slope. 이를 초과하는
 *    가파른 line 은 reject (수직선에 가까운 부적절 trendline 차단)
 */
export const FIB_TF_PARAMS: Record<
  FibTimeframe,
  { swingWindow: number; lookback: number; slopeMaxPctPerCandle: number }
> = {
  "1h": { swingWindow: 5, lookback: 120, slopeMaxPctPerCandle: 0.5 },
  "4h": { swingWindow: 5, lookback: 90, slopeMaxPctPerCandle: 1.0 },
  "1d": { swingWindow: 7, lookback: 60, slopeMaxPctPerCandle: 2.0 },
};

// ─── Swing Point Detection ──────────────────────────────────────────

/**
 * 일봉 캔들에서 주요 스윙 고점/저점을 찾습니다.
 * lookback 기간 내에서 가장 높은 고점과 가장 낮은 저점을 찾습니다.
 */
export function findSwingPoints(
  candles: Candle[],
  lookbackPeriod: number = 60
): { high: SwingPoint; low: SwingPoint } {
  if (candles.length < 5) {
    throw new Error("Insufficient candle data for swing point detection");
  }

  const recentCandles = candles.slice(-lookbackPeriod);

  let highestIdx = 0;
  let lowestIdx = 0;

  for (let i = 0; i < recentCandles.length; i++) {
    if (recentCandles[i].high > recentCandles[highestIdx].high) {
      highestIdx = i;
    }
    if (recentCandles[i].low < recentCandles[lowestIdx].low) {
      lowestIdx = i;
    }
  }

  const offset = candles.length - recentCandles.length;

  return {
    high: {
      index: offset + highestIdx,
      time: recentCandles[highestIdx].openTime,
      price: recentCandles[highestIdx].high,
      type: "high",
    },
    low: {
      index: offset + lowestIdx,
      time: recentCandles[lowestIdx].openTime,
      price: recentCandles[lowestIdx].low,
      type: "low",
    },
  };
}

/**
 * @deprecated 2026-05-15 — `trendline-engine.ts` 의 `findSwings` 로 대체됨.
 * 본 함수는 strict 비교 (>=, <=) 만 사용하여 동가 swing 을 무시하는 문제 +
 * fallback 없음의 문제로 폐기. 외부 import 호환성을 위해 보존만 함.
 *
 * 로컬 스윙 포인트들을 찾습니다 (빗각 계산용).
 * 좌우 windowSize 캔들보다 높거나 낮은 포인트를 감지합니다.
 */
export function findLocalSwingPoints(
  candles: Candle[],
  windowSize: number = 5
): SwingPoint[] {
  const points: SwingPoint[] = [];

  for (let i = windowSize; i < candles.length - windowSize; i++) {
    let isHigh = true;
    let isLow = true;

    for (let j = i - windowSize; j <= i + windowSize; j++) {
      if (j === i) continue;
      if (candles[j].high >= candles[i].high) isHigh = false;
      if (candles[j].low <= candles[i].low) isLow = false;
    }

    if (isHigh) {
      points.push({
        index: i,
        time: candles[i].openTime,
        price: candles[i].high,
        type: "high",
      });
    }
    if (isLow) {
      points.push({
        index: i,
        time: candles[i].openTime,
        price: candles[i].low,
        type: "low",
      });
    }
  }

  return points;
}

// ─── Fibonacci Levels ───────────────────────────────────────────────

/**
 * 피보나치 되돌림 레벨을 계산합니다.
 * 상승 추세: high가 나중 → 되돌림은 아래로
 * 하락 추세: low가 나중 → 되돌림은 위로
 */
export function calculateFibLevels(
  swingHigh: SwingPoint,
  swingLow: SwingPoint
): FibLevel[] {
  const range = swingHigh.price - swingLow.price;

  // 상승 추세 되돌림 (고점에서 아래로)
  return FIB_RATIOS.map(({ ratio, label }) => {
    const price = swingHigh.price - range * ratio;
    return {
      ratio,
      price,
      zoneHigh: price * (1 + ZONE_TOLERANCE),
      zoneLow: price * (1 - ZONE_TOLERANCE),
      label,
    };
  });
}

/**
 * 현재 가격이 어떤 피보나치 존에 있는지 판별합니다.
 */
export function getCurrentFibZone(
  price: number,
  fibLevels: FibLevel[]
): string {
  for (const level of fibLevels) {
    if (price >= level.zoneLow && price <= level.zoneHigh) {
      return `${level.label} Zone (${level.zoneLow.toFixed(2)} - ${level.zoneHigh.toFixed(2)})`;
    }
  }

  // 존 사이에 있는 경우 가장 가까운 두 레벨 사이
  for (let i = 0; i < fibLevels.length - 1; i++) {
    const upper = fibLevels[i];
    const lower = fibLevels[i + 1];
    if (price < upper.price && price > lower.price) {
      return `Between ${upper.label} and ${lower.label}`;
    }
  }

  if (price > fibLevels[0].price) return "Above 0 (Above High)";
  return "Below 1.0 (Below Low)";
}

// ─── Trendline Detection ────────────────────────────────────────────

/**
 * V2 trendline (`trendline-engine.ts`) → 본 모듈의 legacy Trendline 타입으로 어댑트.
 * Fibonacci 페이지의 CandleChartLW + FibonacciDetail 의 TrendlineCard 가 본 타입을
 * 사용하므로 변환 필요. quality / isVisualHint 는 별도 보존.
 */
function adaptV2Trendline(
  v2: TrendlineV2,
  tf: FibTimeframe,
  _lastCandle: Candle
): Trendline {
  void _lastCandle; // 향후 시각화 확장에 활용 가능 — 현재 미사용
  return {
    startPoint: {
      time: v2.startPoint.time,
      price: v2.startPoint.price,
      index: v2.startPoint.index,
    },
    endPoint: {
      time: v2.endPoint.time,
      price: v2.endPoint.price,
      index: v2.endPoint.index,
    },
    slope: v2.slope,
    intercept: v2.intercept,
    type: v2.type,
    touchCount: v2.touchCount,
    durationDays: v2.durationDays,
    isValid: v2.isValid,
    currentPrice: v2.currentPrice,
    rSquared: v2.rSquared,
    tf,
    quality: v2.quality,
    isVisualHint: v2.isVisualHint,
  };
}

/**
 * @deprecated 2026-05-15 — Use `detectTrendlinesV2` from `trendline-engine.ts`.
 * Inflection point 기반 단순 분기는 변동성 큰 알트(ADA 등)에서 라인이
 * 통째로 reject 되는 문제가 있어 V2 의 3-tier fallback 으로 대체됨.
 * 본 함수는 외부 import 호환성을 위해 보존되나 내부적으로 V2 를 호출.
 *
 * 변환점(Inflection Point) 검출.
 *
 * 기울기가 바뀌는 지점이 새 추세의 시작이라는 사용자 요구사항을 구현.
 *  - type="resistance" (highs): 최신부터 거꾸로 스캔하며 연속된 descending highs
 *    구간을 수집. descending 이 깨지는 지점(이전 high 가 더 낮음 = ascending 였음)
 *    이 inflection. 그 직전의 가장 높은 high 가 새 downtrend 의 anchor.
 *  - type="support" (lows): 대칭. 연속된 ascending lows 를 수집, 깨지는 지점이
 *    inflection. 직전의 가장 낮은 low 가 새 uptrend 의 anchor.
 *
 * `swings` 는 chronological order 라고 가정 (index ascending).
 */
export function detectInflectionPoint(
  swings: SwingPoint[],
  type: "resistance" | "support"
): {
  anchorIdx: number;            // swings 배열 내 anchor 의 index
  trendDirection: "down" | "up";
  relevantSwings: SwingPoint[]; // anchor ~ 마지막 swing 까지 (chronological)
} | null {
  if (swings.length < 2) return null;

  // 가장 최근 swing 부터 역방향으로 스캔
  let anchorIdx = swings.length - 1;

  if (type === "resistance") {
    // descending highs 구간 추적: swings[i].price < swings[i-1].price 가 이어지는 동안 계속
    for (let i = swings.length - 1; i >= 1; i--) {
      if (swings[i].price < swings[i - 1].price) {
        // 직전 high 가 더 높음 → descending 진행 중. anchor 는 직전 high.
        anchorIdx = i - 1;
      } else {
        // 직전 high 가 더 낮음 → 그 이전은 ascending 였음. inflection 도달.
        break;
      }
    }
    const relevantSwings = swings.slice(anchorIdx);
    if (relevantSwings.length < 2) return null;
    return { anchorIdx, trendDirection: "down", relevantSwings };
  }

  // type === "support" — ascending lows
  for (let i = swings.length - 1; i >= 1; i--) {
    if (swings[i].price > swings[i - 1].price) {
      // 직전 low 가 더 낮음 → ascending 진행 중. anchor 는 직전 low.
      anchorIdx = i - 1;
    } else {
      // 직전 low 가 더 높음 → 그 이전은 descending 였음. inflection 도달.
      break;
    }
  }
  const relevantSwings = swings.slice(anchorIdx);
  if (relevantSwings.length < 2) return null;
  return { anchorIdx, trendDirection: "up", relevantSwings };
}

/**
 * Linear regression — 주어진 (x, y) 포인트들에서 best-fit 직선의
 * slope, intercept, R² 를 계산.
 */
function linearRegression(
  points: SwingPoint[]
): { slope: number; intercept: number; rSquared: number } {
  const n = points.length;
  if (n < 2) return { slope: 0, intercept: points[0]?.price ?? 0, rSquared: 0 };

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  for (const p of points) {
    sumX += p.index;
    sumY += p.price;
    sumXY += p.index * p.price;
    sumXX += p.index * p.index;
  }

  const meanX = sumX / n;
  const meanY = sumY / n;
  const denom = sumXX - n * meanX * meanX;
  if (Math.abs(denom) < 1e-9) {
    return { slope: 0, intercept: meanY, rSquared: 0 };
  }
  const slope = (sumXY - n * meanX * meanY) / denom;
  const intercept = meanY - slope * meanX;

  // R² 계산
  let ssRes = 0;
  let ssTot = 0;
  for (const p of points) {
    const predicted = slope * p.index + intercept;
    ssRes += (p.price - predicted) ** 2;
    ssTot += (p.price - meanY) ** 2;
  }
  const rSquared = ssTot < 1e-9 ? 1 : Math.max(0, 1 - ssRes / ssTot);
  return { slope, intercept, rSquared };
}

/**
 * 추세 빗각을 자동으로 감지합니다.
 *
 * 2026-05-15: 내부 구현을 `trendline-engine.ts` 의 V2 (3-tier fallback) 로
 * 위임. swingPoints 파라미터는 backward-compat 위해 시그너처에만 남기고
 * V2 가 자체적으로 다시 swing 을 찾음 (relaxed fallback 포함).
 *
 * Resistance 1개 (high-high) + Support 1개 (low-low), 총 최대 2개 반환.
 * 라인 quality 는 Trendline.quality 필드에 "ransac" / "regression" /
 * "two-pivot" 중 하나로 표시됨.
 */
export function detectTrendlines(
  candles: Candle[],
  swingPoints: SwingPoint[],
  tf: FibTimeframe = "4h"
): Trendline[] {
  void swingPoints; // V2 가 자체적으로 swing 검출 (strict → relaxed fallback)
  if (candles.length === 0) return [];
  const lastCandle = candles[candles.length - 1];

  // V2 는 TF 가 "1h" | "4h" | "1d" | "1w" — FibTimeframe (1h/4h/1d) 와 동일 prefix.
  // 1w 가 FibTimeframe 에는 없으므로 1d 로 fallback (legacy 호환).
  const v2Tf: "1h" | "4h" | "1d" = tf;
  const v2Trendlines = detectTrendlinesV2(candles, v2Tf);
  return v2Trendlines.map((v2) => adaptV2Trendline(v2, tf, lastCandle));
}

/**
 * @deprecated 2026-05-15 — `trendline-engine.ts` 의 V2 로 대체됨.
 * Inflection point + single-pass regression 방식은 swing 이 가까이 있을 때
 * 라인이 매우 짧고 가파르게 만들어지는 문제 + outlier 1개로 라인 통째로
 * reject 되는 문제로 폐기. 본 함수는 외부 import 호환성을 위해 보존만 함.
 *
 * 단일 trendline 구축:
 *  1) detectInflectionPoint() 로 anchor + relevantSwings 추출
 *  2) lookback 범위 내로 필터
 *  3) linear regression best-fit
 *  4) slope sanity check (TF_PARAMS.slopeMaxPctPerCandle 초과 시 reject)
 *  5) endpoint 보정 + 터치 카운트 계산
 */
function buildTrendlineFromInflection(
  candles: Candle[],
  swings: SwingPoint[],
  type: "support" | "resistance",
  tf: FibTimeframe
): Trendline | null {
  if (swings.length < 2) return null;

  const params = FIB_TF_PARAMS[tf];
  const lookbackStart = Math.max(0, candles.length - params.lookback);

  // 1) lookback 내 swing 만 사용
  const recentSwings = swings.filter((s) => s.index >= lookbackStart);
  if (recentSwings.length < 2) return null;

  // 2) inflection point 검출
  const inflection = detectInflectionPoint(recentSwings, type);
  if (!inflection) return null;
  const { relevantSwings } = inflection;

  // 3) linear regression
  const { slope, intercept, rSquared } = linearRegression(relevantSwings);

  // 4) Slope sanity check
  //    average price 기준으로 캔들당 % slope 가 허용치 이내인지
  const avgPrice =
    relevantSwings.reduce((s, p) => s + p.price, 0) / relevantSwings.length;
  if (avgPrice <= 0) return null;
  const slopePctPerCandle = Math.abs((slope / avgPrice) * 100);
  if (slopePctPerCandle > params.slopeMaxPctPerCandle) {
    return null;
  }

  // 5) start/end point: anchor(첫 relevantSwing) → 가장 최근 swing
  const startSwing = relevantSwings[0];
  const endSwing = relevantSwings[relevantSwings.length - 1];

  // 5b) 터치 카운트 — start ~ end 사이 캔들 중 line 에 tolerance 이내로 닿는 캔들
  let touchCount = 0;
  for (let k = startSwing.index; k <= Math.min(endSwing.index, candles.length - 1); k++) {
    const expected = slope * k + intercept;
    if (expected <= 0) continue;
    const tolerance = expected * TRENDLINE_TOLERANCE;
    const candle = candles[k];
    if (type === "support") {
      if (Math.abs(candle.low - expected) <= tolerance) touchCount++;
    } else {
      if (Math.abs(candle.high - expected) <= tolerance) touchCount++;
    }
  }
  // 최소한 endpoint 2개는 touch 로 카운트 (regression 이 swing 통과하지 못해도 의미상 포함)
  touchCount = Math.max(touchCount, 2);

  return {
    startPoint: { time: startSwing.time, price: startSwing.price, index: startSwing.index },
    endPoint: { time: endSwing.time, price: endSwing.price, index: endSwing.index },
    slope,
    intercept,
    type,
    touchCount,
    durationDays: 0,
    isValid: false,
    currentPrice: 0,
    rSquared,
    tf,
  };
}

// ─── Signal Generation ──────────────────────────────────────────────

/**
 * 피보나치 + 빗각 기반 매매 시그널을 생성합니다.
 */
export function generateFibSignal(
  currentPrice: number,
  fibLevels: FibLevel[],
  trendlines: Trendline[],
  trend: "UP" | "DOWN" | "SIDEWAYS"
): FibSignal {
  const reasons: string[] = [];
  let score = 0;
  let signalType: "BUY" | "SELL" | "NONE" = "NONE";
  let matchedFibLevel: number | null = null;
  let trendlineTouch = false;

  // 1. 피보나치 존 확인
  const goldenLevel = fibLevels.find((l) => l.ratio === 0.618);
  const level382 = fibLevels.find((l) => l.ratio === 0.382);
  const level236 = fibLevels.find((l) => l.ratio === 0.236);
  const level786 = fibLevels.find((l) => l.ratio === 0.786);

  // 매수 시그널: 0.618 또는 0.382 존에 가격이 위치
  if (goldenLevel && currentPrice >= goldenLevel.zoneLow && currentPrice <= goldenLevel.zoneHigh) {
    score += 40;
    matchedFibLevel = 0.618;
    reasons.push("가격이 0.618 황금비 존에 위치 (강한 매수 영역)");
  } else if (level382 && currentPrice >= level382.zoneLow && currentPrice <= level382.zoneHigh) {
    score += 30;
    matchedFibLevel = 0.382;
    reasons.push("가격이 0.382 되돌림 존에 위치 (매수 영역)");
  } else if (level786 && currentPrice >= level786.zoneLow && currentPrice <= level786.zoneHigh) {
    score += 35;
    matchedFibLevel = 0.786;
    reasons.push("가격이 0.786 깊은 되돌림 존에 위치 (강한 매수 영역)");
  }

  // 매도 시그널: 0.236 또는 0 존에 가격이 위치
  if (level236 && currentPrice >= level236.zoneLow && currentPrice <= level236.zoneHigh) {
    score += 25;
    if (!matchedFibLevel) matchedFibLevel = 0.236;
    reasons.push("가격이 0.236 존에 위치 (매도 고려 영역)");
  }

  const level0 = fibLevels.find((l) => l.ratio === 0);
  if (level0 && currentPrice >= level0.zoneLow && currentPrice <= level0.zoneHigh) {
    score += 35;
    if (!matchedFibLevel) matchedFibLevel = 0;
    reasons.push("가격이 이전 고점(0 레벨) 근처 (매도 영역)");
  }

  // 2. 빗각 터치 확인
  const validTrendlines = trendlines.filter((t) => t.isValid);

  for (const tl of validTrendlines) {
    const tolerance = tl.currentPrice * TRENDLINE_TOLERANCE;

    if (tl.type === "support" && Math.abs(currentPrice - tl.currentPrice) <= tolerance) {
      trendlineTouch = true;
      score += 25;
      reasons.push(
        `상승 추세 지지선 터치 (${tl.touchCount}회 터치, ${tl.durationDays.toFixed(0)}일 유지)`
      );
    }

    if (tl.type === "resistance" && Math.abs(currentPrice - tl.currentPrice) <= tolerance) {
      trendlineTouch = true;
      score += 20;
      reasons.push(
        `저항선 터치 (${tl.touchCount}회 터치, ${tl.durationDays.toFixed(0)}일 유지)`
      );
    }
  }

  // 3. 추세 방향 보너스
  if (trend === "UP" && matchedFibLevel && matchedFibLevel >= 0.382) {
    score += 10;
    reasons.push("상승 추세 중 되돌림 → 매수 기회");
  }
  if (trend === "DOWN" && matchedFibLevel !== null && matchedFibLevel <= 0.382) {
    score += 10;
    reasons.push("하락 추세 중 반등 → 매도 기회");
  }

  // 4. 시그널 결정
  score = Math.min(score, 100);

  if (score >= 40) {
    if (matchedFibLevel !== null && matchedFibLevel >= 0.5) {
      signalType = "BUY";
    } else if (matchedFibLevel !== null && matchedFibLevel <= 0.382) {
      signalType = "SELL";
    } else if (trendlineTouch) {
      // 빗각 터치만 있는 경우 빗각 타입으로 결정
      const supportTouch = validTrendlines.some(
        (t) =>
          t.type === "support" &&
          Math.abs(currentPrice - t.currentPrice) <= t.currentPrice * TRENDLINE_TOLERANCE
      );
      signalType = supportTouch ? "BUY" : "SELL";
    }
  }

  if (reasons.length === 0) {
    reasons.push("현재 주요 피보나치 존 또는 빗각 근처에 있지 않음");
  }

  return {
    type: signalType,
    strength: score,
    fibLevel: matchedFibLevel,
    trendlineTouch,
    reasons,
    currentPrice,
  };
}

// ─── Trend Detection ────────────────────────────────────────────────

/**
 * 최근 캔들 데이터에서 추세 방향을 판별합니다.
 */
export function detectTrend(candles: Candle[], period: number = 20): "UP" | "DOWN" | "SIDEWAYS" {
  if (candles.length < period) return "SIDEWAYS";

  const recent = candles.slice(-period);
  const firstHalf = recent.slice(0, Math.floor(period / 2));
  const secondHalf = recent.slice(Math.floor(period / 2));

  const firstAvg = firstHalf.reduce((s, c) => s + c.close, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((s, c) => s + c.close, 0) / secondHalf.length;

  const changePct = ((secondAvg - firstAvg) / firstAvg) * 100;

  if (changePct > 2) return "UP";
  if (changePct < -2) return "DOWN";
  return "SIDEWAYS";
}

// ─── Full Analysis ──────────────────────────────────────────────────

/**
 * 전체 피보나치 + 빗각 분석을 수행합니다.
 * tf 별로 swingWindow / lookback / slope sanity 가 분화됩니다.
 */
export function analyzeFibonacci(
  candles: Candle[],
  tf: FibTimeframe = "4h"
): FibonacciAnalysis {
  const params = FIB_TF_PARAMS[tf];

  // 1. 스윙 포인트 찾기 (TF 별 lookback 반영)
  const { high: swingHigh, low: swingLow } = findSwingPoints(candles, params.lookback);

  // 2. 피보나치 레벨 계산
  const fibLevels = calculateFibLevels(swingHigh, swingLow);

  // 3. 로컬 스윙 포인트 (TF 별 swingWindow 반영)
  const localSwings = findLocalSwingPoints(candles, params.swingWindow);

  // 4. 빗각 감지 (inflection-point anchored, TF-aware)
  const trendlines = detectTrendlines(candles, localSwings, tf);

  // 5. 추세 판별
  const trend = detectTrend(candles);

  // 6. 현재 가격
  const currentPrice = candles[candles.length - 1].close;

  // 7. 시그널 생성
  const signal = generateFibSignal(currentPrice, fibLevels, trendlines, trend);

  // 8. 현재 존
  const currentZone = getCurrentFibZone(currentPrice, fibLevels);

  return {
    swingHigh,
    swingLow,
    fibLevels,
    trendlines,
    signal,
    trend,
    currentZone,
    tf,
  };
}
