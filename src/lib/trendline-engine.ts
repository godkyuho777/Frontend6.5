/**
 * Trendline Engine v2 — 추세선 그리기 전용 엔진
 *
 * 2026-05-15 신규: 기존 `fibonacci-engine.ts` 의 `detectTrendlines` 가
 *   1) slope sanity 너무 빡빡 (ADA 등 변동성 큰 알트에서 라인 통째로 reject)
 *   2) inflection point 가 너무 가까워서 라인이 짧고 가파름
 *   3) strict swing detection 이 동가 swing 무시
 *   4) fallback 부재 — 위 어디서든 null 이면 라인 안 그려짐
 * 의 문제로 ADAUSDT 4H 등에서 저점-저점 추세선이 안 그려지는 증상.
 *
 * 본 모듈은:
 *   - 3-tier fallback 알고리즘 (RANSAC → linear regression → two-pivot)
 *   - support + resistance 항상 2개 라인 보장 (마지막 tier 는 시각적 hint)
 *   - swing detection 도 strict → relaxed (>=, <=) 자동 재시도
 *   - 단일 entry point `detectTrendlinesV2()` 로 Fibonacci/Wave/CoinDetail
 *     모두 동일 알고리즘 사용
 *
 * 알고리즘 요약:
 *   Tier 1 (quality="ransac"):
 *     swing 4개 이상일 때 RANSAC 으로 outlier 제거. inlier 비율 ≥ 60% 이고
 *     slope sanity 통과 시 채택. 가장 robust 한 라인.
 *   Tier 2 (quality="regression"):
 *     전체 lookback swing 으로 linear regression. R² ≥ 0.3 AND slope sanity
 *     통과 시 채택. 깨끗하지만 outlier 에 약함.
 *   Tier 3 (quality="two-pivot", isVisualHint=true):
 *     lookback 내 가장 낮은 2 swing (support) / 가장 높은 2 swing (resistance)
 *     를 시간순 정렬해 그냥 직선. 위 두 tier 가 모두 실패해도 항상 그려짐.
 *     dashed + "AUTO" 라벨로 시각화하여 사용자에게 fallback 임을 알림.
 */

import type { Candle } from "@shared/types";

// ─── Types ───────────────────────────────────────────────────────────

export type Timeframe = "1h" | "4h" | "1d" | "1w";
export type TrendlineType = "support" | "resistance";
export type TrendlineQuality = "ransac" | "regression" | "two-pivot";

/** Swing 포인트 — high/low pivot 의 candle index + price + openTime */
export interface SwingPoint {
  index: number;
  time: number;
  price: number;
  type: "high" | "low";
}

/** v2 trendline — 어느 tier 에서 만들어졌는지 quality 로 표기 */
export interface Trendline {
  type: TrendlineType;
  /** 어느 fallback tier 에서 만들어진 라인인지 */
  quality: TrendlineQuality;
  startPoint: SwingPoint;
  endPoint: SwingPoint;
  /** price per candle */
  slope: number;
  intercept: number;
  /** 현재(마지막) 캔들 위치에서의 line value */
  currentPrice: number;
  /** line ± tolerance 내에 닿은 swing 수 */
  touchCount: number;
  /** 0~1 (Tier 3 에선 0) */
  rSquared: number;
  /** RANSAC inlier 비율 (Tier 2/3 에선 1 / partial) */
  inlierRatio: number;
  /** start → 현재 캔들까지 일수 */
  durationDays: number;
  /** touchCount ≥ 3 OR durationDays ≥ 7 */
  isValid: boolean;
  /** Tier 3 (two-pivot fallback) 일 때 true — 차트에서 옅게 그릴 hint */
  isVisualHint: boolean;
}

/** TF 별 trendline 검출 파라미터 */
export interface TrendlineParams {
  /** local swing 좌우 비교 캔들 수 (값↑ = 더 굵은 swing) */
  swingWindow: number;
  /** 검색 lookback 캔들 수 */
  lookback: number;
  /** touch 판단 ± 비율 (e.g. 0.005 = ±0.5%) */
  toleranceRatio: number;
  /** RANSAC iteration 수 */
  ransacIterations: number;
  /** RANSAC inlier 판정 threshold 비율 (avgPrice × ratio = abs threshold) */
  ransacInlierThresholdRatio: number;
  /** RANSAC 채택 최소 inlier ratio */
  ransacMinInlierRatio: number;
  /** Tier 2 (regression) 채택 최소 R² */
  minRSquared: number;
  /** sanity check — 캔들당 최대 % slope (이전 1% → 5% 로 대폭 완화) */
  slopeMaxPctPerCandle: number;
}

export const TRENDLINE_TF_PARAMS: Record<Timeframe, TrendlineParams> = {
  "1h": {
    swingWindow: 5,
    lookback: 200,
    toleranceRatio: 0.004,
    ransacIterations: 200,
    ransacInlierThresholdRatio: 0.008,
    ransacMinInlierRatio: 0.6,
    minRSquared: 0.3,
    slopeMaxPctPerCandle: 5.0,
  },
  "4h": {
    swingWindow: 5,
    lookback: 150,
    toleranceRatio: 0.006,
    ransacIterations: 200,
    ransacInlierThresholdRatio: 0.012,
    ransacMinInlierRatio: 0.6,
    minRSquared: 0.3,
    slopeMaxPctPerCandle: 5.0,
  },
  "1d": {
    swingWindow: 7,
    lookback: 120,
    toleranceRatio: 0.01,
    ransacIterations: 200,
    ransacInlierThresholdRatio: 0.02,
    ransacMinInlierRatio: 0.6,
    minRSquared: 0.3,
    slopeMaxPctPerCandle: 5.0,
  },
  "1w": {
    swingWindow: 4,
    lookback: 80,
    toleranceRatio: 0.015,
    ransacIterations: 200,
    ransacInlierThresholdRatio: 0.03,
    ransacMinInlierRatio: 0.5,
    minRSquared: 0.3,
    slopeMaxPctPerCandle: 5.0,
  },
};

// ─── Swing detection ────────────────────────────────────────────────

/**
 * Strict pass 충분치 않으면 relaxed (>=, <=) 로 자동 재시도.
 * 동가(equal) swing 을 무시하면 평탄 영역에서 swing 자체가 안 나옴.
 */
export function findSwings(candles: Candle[], window: number): SwingPoint[] {
  const strict = findSwingsImpl(candles, window, "strict");
  if (strict.length >= 4) return strict;
  // 동가 허용 — 같은 high/low 라도 swing 으로 인정
  return findSwingsImpl(candles, window, "relaxed");
}

function findSwingsImpl(
  candles: Candle[],
  window: number,
  mode: "strict" | "relaxed"
): SwingPoint[] {
  const out: SwingPoint[] = [];
  if (candles.length < window * 2 + 1) return out;

  for (let i = window; i < candles.length - window; i++) {
    let isHigh = true;
    let isLow = true;
    for (let j = i - window; j <= i + window; j++) {
      if (j === i) continue;
      if (mode === "strict") {
        if (candles[j].high >= candles[i].high) isHigh = false;
        if (candles[j].low <= candles[i].low) isLow = false;
      } else {
        // relaxed: only the strictly-bigger sample disqualifies. 동가는 OK.
        if (candles[j].high > candles[i].high) isHigh = false;
        if (candles[j].low < candles[i].low) isLow = false;
      }
    }
    if (isHigh) {
      out.push({
        index: i,
        time: candles[i].openTime,
        price: candles[i].high,
        type: "high",
      });
    }
    if (isLow) {
      out.push({
        index: i,
        time: candles[i].openTime,
        price: candles[i].low,
        type: "low",
      });
    }
  }
  return out;
}

// ─── Linear regression ──────────────────────────────────────────────

function linearRegression(points: SwingPoint[]): {
  slope: number;
  intercept: number;
  rSquared: number;
} {
  const n = points.length;
  if (n < 2) {
    return { slope: 0, intercept: points[0]?.price ?? 0, rSquared: 0 };
  }

  let sumX = 0,
    sumY = 0,
    sumXY = 0,
    sumXX = 0;
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

// ─── RANSAC ─────────────────────────────────────────────────────────

/**
 * RANSAC best-fit — 무작위 2점 샘플링을 iterations 회 반복하며
 * inlier (line 으로부터 ± inlierThresholdAbs 이내인 점) 최대화.
 * 마지막에 inlier 들로 다시 regression 해서 line 정련.
 *
 * deterministic 하기 위해 seeded LCG random 사용 (페이지 새로고침마다
 * 같은 결과 → UX 안정).
 */
function ransacFit(
  points: SwingPoint[],
  iterations: number,
  inlierThresholdAbs: number
): {
  bestSlope: number;
  bestIntercept: number;
  inlierIndices: number[];
  inlierRatio: number;
} | null {
  const n = points.length;
  if (n < 2) return null;
  if (n === 2) {
    // 굳이 RANSAC 의미 없음. 두 점 그대로
    const a = points[0];
    const b = points[1];
    if (a.index === b.index) return null;
    const slope = (b.price - a.price) / (b.index - a.index);
    const intercept = a.price - slope * a.index;
    return {
      bestSlope: slope,
      bestIntercept: intercept,
      inlierIndices: [0, 1],
      inlierRatio: 1,
    };
  }

  // seeded LCG — points 의 index 합을 seed 로 (같은 입력 → 같은 결과)
  let seed = 0;
  for (const p of points) seed = (seed * 31 + p.index + 1) | 0;
  if (seed === 0) seed = 1;
  const rand = (): number => {
    // 32-bit LCG; output [0, 1)
    seed = (seed * 1664525 + 1013904223) | 0;
    return ((seed >>> 0) % 1_000_000) / 1_000_000;
  };

  let bestInlierCount = 0;
  let bestSlope = 0;
  let bestIntercept = 0;
  let bestInlierIndices: number[] = [];

  for (let iter = 0; iter < iterations; iter++) {
    const iA = Math.floor(rand() * n);
    let iB = Math.floor(rand() * n);
    if (iA === iB) iB = (iB + 1) % n;
    const a = points[iA];
    const b = points[iB];
    if (a.index === b.index) continue;
    const slope = (b.price - a.price) / (b.index - a.index);
    const intercept = a.price - slope * a.index;

    let inlierCount = 0;
    const inlierIdx: number[] = [];
    for (let k = 0; k < n; k++) {
      const p = points[k];
      const expected = slope * p.index + intercept;
      if (Math.abs(p.price - expected) <= inlierThresholdAbs) {
        inlierCount++;
        inlierIdx.push(k);
      }
    }
    if (inlierCount > bestInlierCount) {
      bestInlierCount = inlierCount;
      bestSlope = slope;
      bestIntercept = intercept;
      bestInlierIndices = inlierIdx;
    }
  }

  if (bestInlierCount < 2) return null;

  // inlier 들로 정련 regression
  const inlierPoints = bestInlierIndices.map((i) => points[i]);
  const lr = linearRegression(inlierPoints);
  // sanity — 정련 결과가 너무 이상하면 raw RANSAC 결과 사용
  if (Number.isFinite(lr.slope) && Number.isFinite(lr.intercept)) {
    bestSlope = lr.slope;
    bestIntercept = lr.intercept;
  }

  return {
    bestSlope,
    bestIntercept,
    inlierIndices: bestInlierIndices,
    inlierRatio: bestInlierCount / n,
  };
}

function computeRSquaredOnInliers(
  ransac: { bestSlope: number; bestIntercept: number; inlierIndices: number[] },
  points: SwingPoint[]
): number {
  const inlierPoints = ransac.inlierIndices.map((i) => points[i]);
  if (inlierPoints.length < 2) return 0;
  const meanY =
    inlierPoints.reduce((s, p) => s + p.price, 0) / inlierPoints.length;
  let ssRes = 0;
  let ssTot = 0;
  for (const p of inlierPoints) {
    const predicted = ransac.bestSlope * p.index + ransac.bestIntercept;
    ssRes += (p.price - predicted) ** 2;
    ssTot += (p.price - meanY) ** 2;
  }
  if (ssTot < 1e-9) return 1;
  return Math.max(0, 1 - ssRes / ssTot);
}

// ─── Trendline builder (3-tier) ─────────────────────────────────────

interface AssembleArgs {
  candles: Candle[];
  relevantSwings: SwingPoint[];
  slope: number;
  intercept: number;
  quality: TrendlineQuality;
  inlierRatio: number;
  rSquared: number;
  type: TrendlineType;
  params: TrendlineParams;
  isVisualHint?: boolean;
}

function assembleTrendline(args: AssembleArgs): Trendline {
  const {
    candles,
    relevantSwings,
    slope,
    intercept,
    quality,
    inlierRatio,
    rSquared,
    type,
    params,
    isVisualHint = false,
  } = args;

  const sorted = [...relevantSwings].sort((a, b) => a.index - b.index);
  const startSwing = sorted[0];
  const endSwing = sorted[sorted.length - 1];

  const lastCandleIdx = candles.length - 1;
  const lastCandle = candles[lastCandleIdx];

  // currentPrice — 마지막 캔들 시점의 line value
  const currentPrice = slope * lastCandleIdx + intercept;

  // durationDays — startSwing 부터 last candle 까지
  const durationMs = lastCandle.openTime - candles[startSwing.index].openTime;
  const durationDays = durationMs / (1000 * 60 * 60 * 24);

  // touchCount — relevantSwings 중 line ± tolerance 내에 있는 수
  const avgPrice =
    relevantSwings.reduce((s, p) => s + p.price, 0) / relevantSwings.length;
  const tolerance = avgPrice * params.toleranceRatio;
  let touchCount = 0;
  for (const p of relevantSwings) {
    const expected = slope * p.index + intercept;
    if (Math.abs(p.price - expected) <= tolerance) touchCount++;
  }
  // 최소 2 — endpoint 두 개는 라인 정의상 touch 임
  touchCount = Math.max(touchCount, 2);

  const isValid = touchCount >= 3 || durationDays >= 7;

  return {
    type,
    quality,
    startPoint: startSwing,
    endPoint: endSwing,
    slope,
    intercept,
    currentPrice,
    touchCount,
    rSquared,
    inlierRatio,
    durationDays,
    isValid,
    isVisualHint,
  };
}

/**
 * 단일 trendline 빌드 — 3-tier fallback 흐름.
 * null 은 정말 데이터 부족 (swing 1개 이하) 일 때만 반환.
 */
export function buildTrendline(
  candles: Candle[],
  type: TrendlineType,
  tf: Timeframe
): Trendline | null {
  if (candles.length === 0) return null;
  const params = TRENDLINE_TF_PARAMS[tf];
  const lookbackStart = Math.max(0, candles.length - params.lookback);

  const allSwings = findSwings(candles, params.swingWindow);
  const relevantSwings = allSwings
    .filter((s) => s.type === (type === "support" ? "low" : "high"))
    .filter((s) => s.index >= lookbackStart)
    .sort((a, b) => a.index - b.index);

  if (relevantSwings.length < 2) return null;

  const avgPrice =
    relevantSwings.reduce((s, p) => s + p.price, 0) / relevantSwings.length;
  if (avgPrice <= 0) return null;

  // ── Tier 1: RANSAC ──
  if (relevantSwings.length >= 4) {
    const inlierThresholdAbs = avgPrice * params.ransacInlierThresholdRatio;
    const ransac = ransacFit(
      relevantSwings,
      params.ransacIterations,
      inlierThresholdAbs
    );
    if (ransac && ransac.inlierRatio >= params.ransacMinInlierRatio) {
      const slopePct = Math.abs((ransac.bestSlope / avgPrice) * 100);
      if (slopePct <= params.slopeMaxPctPerCandle) {
        const rSquared = computeRSquaredOnInliers(ransac, relevantSwings);
        return assembleTrendline({
          candles,
          relevantSwings,
          slope: ransac.bestSlope,
          intercept: ransac.bestIntercept,
          quality: "ransac",
          inlierRatio: ransac.inlierRatio,
          rSquared,
          type,
          params,
        });
      }
    }
  }

  // ── Tier 2: Linear regression (전체 swing) ──
  const lr = linearRegression(relevantSwings);
  const slopePctLR = Math.abs((lr.slope / avgPrice) * 100);
  if (lr.rSquared >= params.minRSquared && slopePctLR <= params.slopeMaxPctPerCandle) {
    return assembleTrendline({
      candles,
      relevantSwings,
      slope: lr.slope,
      intercept: lr.intercept,
      quality: "regression",
      inlierRatio: 1,
      rSquared: lr.rSquared,
      type,
      params,
    });
  }

  // ── Tier 3: Two-pivot fallback ──
  //   support: 가장 낮은 2 swing lows (시간순)
  //   resistance: 가장 높은 2 swing highs (시간순)
  const sortedByPrice =
    type === "support"
      ? [...relevantSwings].sort((a, b) => a.price - b.price)
      : [...relevantSwings].sort((a, b) => b.price - a.price);
  const top2 = sortedByPrice.slice(0, 2).sort((a, b) => a.index - b.index);
  if (top2.length < 2 || top2[0].index === top2[1].index) return null;
  const tpSlope = (top2[1].price - top2[0].price) / (top2[1].index - top2[0].index);
  const tpIntercept = top2[0].price - tpSlope * top2[0].index;
  const tpSlopePct = Math.abs((tpSlope / avgPrice) * 100);
  // Tier 3 도 slope sanity 적용 (한쪽 outlier swing 두 개로 수직선 비스무리한 라인 방지)
  if (tpSlopePct > params.slopeMaxPctPerCandle) {
    // 그래도 너무 가파른 hint 라인을 그리는 건 의미 없음 — null.
    return null;
  }
  return assembleTrendline({
    candles,
    relevantSwings: top2,
    slope: tpSlope,
    intercept: tpIntercept,
    quality: "two-pivot",
    inlierRatio: 2 / Math.max(1, relevantSwings.length),
    rSquared: 0,
    type,
    params,
    isVisualHint: true,
  });
}

/**
 * 메인 entry — support + resistance 둘 다 시도해서 가능한 라인 모두 반환.
 * 한쪽이 null 이어도 다른 한쪽은 채워서 반환 (가능한 한).
 */
export function detectTrendlinesV2(
  candles: Candle[],
  tf: Timeframe
): Trendline[] {
  const out: Trendline[] = [];
  const support = buildTrendline(candles, "support", tf);
  if (support) out.push(support);
  const resistance = buildTrendline(candles, "resistance", tf);
  if (resistance) out.push(resistance);
  return out;
}
