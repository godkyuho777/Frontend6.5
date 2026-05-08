/**
 * Fibonacci Golden Ratio & Trendline Engine
 * 일봉 기준 피보나치 되돌림 레벨 계산 + 단기 추세 빗각 감지
 * 클라이언트 사이드 순수 함수 모듈
 */

import type { Candle } from "@shared/types";

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

/** 추세 빗각 (Trendline) */
export interface Trendline {
  startPoint: { time: number; price: number; index: number };
  endPoint: { time: number; price: number; index: number };
  slope: number;          // 기울기 (price per candle)
  type: "support" | "resistance";
  touchCount: number;     // 터치한 캔들 수
  durationDays: number;   // 유지 기간 (일)
  isValid: boolean;       // 유효성 (3개 터치 또는 7일 이상)
  currentPrice: number;   // 현재 시점에서의 빗각 가격
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
 * 추세 빗각을 자동으로 감지합니다.
 * 지지선: 저점들을 연결
 * 저항선: 고점들을 연결
 */
export function detectTrendlines(
  candles: Candle[],
  swingPoints: SwingPoint[]
): Trendline[] {
  const trendlines: Trendline[] = [];
  const lastCandle = candles[candles.length - 1];

  // 지지선 (저점들 연결)
  const lows = swingPoints.filter((p) => p.type === "low").sort((a, b) => a.index - b.index);
  const supportLines = findBestTrendlines(candles, lows, "support");
  trendlines.push(...supportLines);

  // 저항선 (고점들 연결)
  const highs = swingPoints.filter((p) => p.type === "high").sort((a, b) => a.index - b.index);
  const resistanceLines = findBestTrendlines(candles, highs, "resistance");
  trendlines.push(...resistanceLines);

  // 현재 가격 계산 및 유효성 검증
  return trendlines.map((tl) => {
    const candlesFromStart = candles.length - 1 - tl.startPoint.index;
    const currentPrice = tl.startPoint.price + tl.slope * candlesFromStart;
    const durationMs = lastCandle.openTime - candles[tl.startPoint.index].openTime;
    const durationDays = durationMs / (1000 * 60 * 60 * 24);

    return {
      ...tl,
      currentPrice,
      durationDays,
      isValid: tl.touchCount >= MIN_TOUCH_COUNT || durationDays >= MIN_DURATION_DAYS,
    };
  });
}

/**
 * 주어진 스윙 포인트들에서 최적의 추세선을 찾습니다.
 */
function findBestTrendlines(
  candles: Candle[],
  points: SwingPoint[],
  type: "support" | "resistance"
): Trendline[] {
  if (points.length < 2) return [];

  const results: Trendline[] = [];

  // 최근 포인트들을 우선으로 조합 시도
  const recentPoints = points.slice(-8); // 최근 8개 포인트

  for (let i = 0; i < recentPoints.length - 1; i++) {
    for (let j = i + 1; j < recentPoints.length; j++) {
      const p1 = recentPoints[i];
      const p2 = recentPoints[j];

      if (p2.index - p1.index < 3) continue; // 최소 3캔들 간격

      const slope = (p2.price - p1.price) / (p2.index - p1.index);

      // 지지선은 상승 또는 수평, 저항선은 하락 또는 수평
      if (type === "support" && slope < -0.01 * p1.price / 100) continue;
      if (type === "resistance" && slope > 0.01 * p1.price / 100) continue;

      // 터치 카운트 계산
      let touchCount = 2; // p1, p2는 이미 터치
      for (let k = p1.index; k <= Math.min(p2.index + 10, candles.length - 1); k++) {
        if (k === p1.index || k === p2.index) continue;
        const expectedPrice = p1.price + slope * (k - p1.index);
        const candle = candles[k];
        const tolerance = expectedPrice * TRENDLINE_TOLERANCE;

        if (type === "support") {
          if (Math.abs(candle.low - expectedPrice) <= tolerance) {
            touchCount++;
          }
        } else {
          if (Math.abs(candle.high - expectedPrice) <= tolerance) {
            touchCount++;
          }
        }
      }

      results.push({
        startPoint: { time: p1.time, price: p1.price, index: p1.index },
        endPoint: { time: p2.time, price: p2.price, index: p2.index },
        slope,
        type,
        touchCount,
        durationDays: 0,
        isValid: false,
        currentPrice: 0,
      });
    }
  }

  // 터치 카운트가 가장 높은 것 우선, 최대 2개 반환
  results.sort((a, b) => b.touchCount - a.touchCount);
  return results.slice(0, 2);
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
 */
export function analyzeFibonacci(candles: Candle[]): FibonacciAnalysis {
  // 1. 스윙 포인트 찾기
  const { high: swingHigh, low: swingLow } = findSwingPoints(candles);

  // 2. 피보나치 레벨 계산
  const fibLevels = calculateFibLevels(swingHigh, swingLow);

  // 3. 로컬 스윙 포인트 (빗각용)
  const localSwings = findLocalSwingPoints(candles, 3);

  // 4. 빗각 감지
  const trendlines = detectTrendlines(candles, localSwings);

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
  };
}
