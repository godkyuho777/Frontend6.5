/**
 * Client-side technical indicators calculation
 * 서버 indicators.ts와 동일한 로직을 브라우저에서 실행합니다.
 */

import type {
  BBStructure,
  Candle,
  CandlePatternMatch,
  CandlePatternName,
  EmaPosition,
  EntryDecision,
  ExitDecision,
  PressureLabel,
  TechnicalIndicators,
  VwapPosition,
  VwapSignal,
} from "@shared/types";

/**
 * RSI (Relative Strength Index) 계산
 */
export function calculateRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/**
 * 볼린저 밴드 계산
 */
export function calculateBollingerBands(
  closes: number[],
  period = 20,
  stdDev = 2
): { upper: number; middle: number; lower: number } {
  if (closes.length < period) {
    const last = closes[closes.length - 1] || 0;
    return { upper: last, middle: last, lower: last };
  }

  const slice = closes.slice(-period);
  const middle = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((sum, val) => sum + Math.pow(val - middle, 2), 0) / period;
  const sd = Math.sqrt(variance);

  return {
    upper: middle + stdDev * sd,
    middle,
    lower: middle - stdDev * sd,
  };
}

/**
 * True Range 계산
 */
function trueRange(high: number, low: number, prevClose: number): number {
  return Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
}

/**
 * ATR (Average True Range) — Wilder smoothing. 백엔드 indicators.ts 미러.
 * 변동성 (price 단위, 항상 ≥ 0). 표시·리스크 관리용 — BBDX 신호 결정엔 미사용.
 */
export function calculateATR(candles: Candle[], period = 14): number {
  if (candles.length < period + 1) return 0;
  const trArr: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    trArr.push(trueRange(candles[i].high, candles[i].low, candles[i - 1].close));
  }
  if (trArr.length < period) return 0;
  let atr = trArr.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < trArr.length; i++) {
    atr = (atr * (period - 1) + trArr[i]) / period;
  }
  return atr;
}

/**
 * ADX (Average Directional Index) 계산
 */
export function calculateADX(
  candles: Candle[],
  period = 14
): { adx: number; plusDi: number; minusDi: number } {
  if (candles.length < period * 2 + 1) {
    return { adx: 0, plusDi: 0, minusDi: 0 };
  }

  const trArr: number[] = [];
  const plusDmArr: number[] = [];
  const minusDmArr: number[] = [];

  for (let i = 1; i < candles.length; i++) {
    const curr = candles[i];
    const prev = candles[i - 1];
    trArr.push(trueRange(curr.high, curr.low, prev.close));
    const upMove = curr.high - prev.high;
    const downMove = prev.low - curr.low;
    plusDmArr.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDmArr.push(downMove > upMove && downMove > 0 ? downMove : 0);
  }

  let smoothTR = trArr.slice(0, period).reduce((a, b) => a + b, 0);
  let smoothPlusDM = plusDmArr.slice(0, period).reduce((a, b) => a + b, 0);
  let smoothMinusDM = minusDmArr.slice(0, period).reduce((a, b) => a + b, 0);

  const dxArr: number[] = [];
  let plusDi = (smoothPlusDM / smoothTR) * 100;
  let minusDi = (smoothMinusDM / smoothTR) * 100;
  let diSum = plusDi + minusDi;
  if (diSum > 0) dxArr.push((Math.abs(plusDi - minusDi) / diSum) * 100);

  for (let i = period; i < trArr.length; i++) {
    smoothTR = smoothTR - smoothTR / period + trArr[i];
    smoothPlusDM = smoothPlusDM - smoothPlusDM / period + plusDmArr[i];
    smoothMinusDM = smoothMinusDM - smoothMinusDM / period + minusDmArr[i];
    plusDi = smoothTR > 0 ? (smoothPlusDM / smoothTR) * 100 : 0;
    minusDi = smoothTR > 0 ? (smoothMinusDM / smoothTR) * 100 : 0;
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

  return {
    adx: Math.round(adx * 100) / 100,
    plusDi: Math.round(plusDi * 100) / 100,
    minusDi: Math.round(minusDi * 100) / 100,
  };
}

/**
 * 피보나치 되돌림 레벨 계산
 */
export function calculateFibonacciLevels(high: number, low: number, trend: 'up' | 'down' = 'up') {
  const diff = high - low;
  const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
  
  return levels.map(level => {
    const price = trend === 'up' ? high - (diff * level) : low + (diff * level);
    return {
      level,
      price: Math.round(price * 10000) / 10000,
      isGoldenZone: level === 0.382 || level === 0.618
    };
  });
}

/**
 * 황금비 존(±0.5% 오차범위) 진입 여부 확인
 */
export function isInFibZone(price: number, fibPrice: number, tolerance = 0.005): boolean {
  const upper = fibPrice * (1 + tolerance);
  const lower = fibPrice * (1 - tolerance);
  return price >= lower && price <= upper;
}

/**
 * 단순 추세 빗각 계산
 */
export function calculateTrendlines(candles: Candle[]) {
  if (candles.length < 20) return [];
  const lookback = candles.slice(-50);
  const lows = lookback
    .map((c, i) => ({ price: c.low, index: i, time: c.openTime }))
    .sort((a, b) => a.price - b.price)
    .slice(0, 5);
  const highs = lookback
    .map((c, i) => ({ price: c.high, index: i, time: c.openTime }))
    .sort((a, b) => b.price - a.price)
    .slice(0, 5);

  const trendlines = [];
  if (lows.length >= 2) {
    const p1 = lows[0];
    const p2 = lows[1];
    trendlines.push({
      type: "support" as const,
      points: [{ time: p1.time, price: p1.price }, { time: p2.time, price: p2.price }],
      isActive: true
    });
  }
  if (highs.length >= 2) {
    const p1 = highs[0];
    const p2 = highs[1];
    trendlines.push({
      type: "resistance" as const,
      points: [{ time: p1.time, price: p1.price }, { time: p2.time, price: p2.price }],
      isActive: true
    });
  }
  return trendlines;
}

/**
 * 모든 기술 지표를 한번에 계산
 */
export function calculateAllIndicators(candles: Candle[]): TechnicalIndicators {
  const closes = candles.map((c) => c.close);
  const rsi = calculateRSI(closes);
  const bb = calculateBollingerBands(closes);
  const { adx, plusDi, minusDi } = calculateADX(candles);

  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const maxHigh = Math.max(...highs);
  const minLow = Math.min(...lows);
  const fibLevels = calculateFibonacciLevels(maxHigh, minLow, 'up');
  const trendlines = calculateTrendlines(candles);

  // VWAP / EMA(9) — Parker Brooks scanner inputs
  const vwap = calculateVWAP(candles);
  const ema9 = calculateEMA(closes, 9);

  return {
    rsi: Math.round(rsi * 100) / 100,
    bbUpper: bb.upper,
    bbMiddle: bb.middle,
    bbLower: bb.lower,
    vwap: Math.round(vwap * 10000) / 10000,
    ema9: Math.round(ema9 * 10000) / 10000,
    adx,
    plusDi,
    minusDi,
    fibLevels,
    trendlines
  };
}

/**
 * 매수 진입 시그널 판단
 */
export function isEntrySignal(
  price: number,
  indicators: TechnicalIndicators,
  config = { rsiLow: 30, rsiHigh: 35, adxThreshold: 30, bbTolerance: 0.02 }
): boolean {
  const rsiInRange = indicators.rsi >= config.rsiLow && indicators.rsi <= config.rsiHigh;
  const nearBbLower = price <= indicators.bbLower * (1 + config.bbTolerance);
  const adxLow = indicators.adx <= config.adxThreshold;
  return rsiInRange && nearBbLower && adxLow;
}

/**
 * 목표가 도달(청산) 시그널 판단
 */
export function isExitSignal(
  price: number,
  indicators: TechnicalIndicators,
  config = { targetRsi: 70, targetAdx: 30, targetPlusDi: 30 }
): boolean {
  const reachedBbMiddle = price >= indicators.bbMiddle;
  const rsiHigh = indicators.rsi >= config.targetRsi;
  const adxHigh = indicators.adx >= config.targetAdx;
  const plusDiHigh = indicators.plusDi >= config.targetPlusDi;
  return reachedBbMiddle || rsiHigh || adxHigh || plusDiHigh;
}

/**
 * 시그널 강도 계산 (0-100)
 */
export function calculateSignalStrength(
  price: number,
  indicators: TechnicalIndicators
): number {
  let score = 0;

  if (indicators.rsi >= 25 && indicators.rsi <= 40) {
    if (indicators.rsi <= 30) score += 35;
    else if (indicators.rsi <= 35) score += 25;
    else score += 10;
  }

  if (price <= indicators.bbLower) {
    score += 35;
  } else if (price <= indicators.bbLower * 1.02) {
    score += 25;
  } else if (price <= indicators.bbLower * 1.05) {
    score += 10;
  }

  if (indicators.adx <= 20) score += 30;
  else if (indicators.adx <= 25) score += 20;
  else if (indicators.adx <= 30) score += 15;

  return Math.min(100, score);
}

/**
 * Bollinger Bands 시계열 계산 (차트용).
 * Returns one band-triplet per candle; the first `period - 1` entries are
 * filled with the candle's own close to keep the chart line continuous.
 */
export function calculateBollingerBandsSeries(
  closes: number[],
  period = 20,
  stdDev = 2
): { upper: number; middle: number; lower: number }[] {
  const result: { upper: number; middle: number; lower: number }[] = [];
  if (closes.length === 0) return result;

  let sum = 0;
  let sumSq = 0;

  for (let i = 0; i < closes.length; i++) {
    const c = closes[i];
    sum += c;
    sumSq += c * c;

    if (i >= period) {
      const drop = closes[i - period];
      sum -= drop;
      sumSq -= drop * drop;
    }

    const window = Math.min(period, i + 1);
    const mean = sum / window;
    const variance = Math.max(0, sumSq / window - mean * mean);
    const sd = Math.sqrt(variance);

    if (i + 1 >= period) {
      result.push({
        upper: mean + stdDev * sd,
        middle: mean,
        lower: mean - stdDev * sd,
      });
    } else {
      result.push({ upper: c, middle: c, lower: c });
    }
  }

  return result;
}

/**
 * RSI 시계열 계산 (차트용)
 */
export function calculateRSISeries(closes: number[], period = 14): number[] {
  const result: number[] = [];
  if (closes.length < period + 1) {
    return closes.map(() => 50);
  }

  for (let i = 0; i < period; i++) {
    result.push(50);
  }

  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;
  result.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));

  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    result.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));
  }

  return result;
}

/**
 * ADX 시계열 계산 (차트용)
 */
export function calculateADXSeries(
  candles: Candle[],
  period = 14
): { adx: number; plusDi: number; minusDi: number }[] {
  const result: { adx: number; plusDi: number; minusDi: number }[] = [];
  if (candles.length < period * 2 + 1) {
    return candles.map(() => ({ adx: 0, plusDi: 0, minusDi: 0 }));
  }

  const trArr: number[] = [];
  const plusDmArr: number[] = [];
  const minusDmArr: number[] = [];

  for (let i = 1; i < candles.length; i++) {
    const curr = candles[i];
    const prev = candles[i - 1];
    trArr.push(trueRange(curr.high, curr.low, prev.close));
    const upMove = curr.high - prev.high;
    const downMove = prev.low - curr.low;
    plusDmArr.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDmArr.push(downMove > upMove && downMove > 0 ? downMove : 0);
  }

  for (let i = 0; i <= period; i++) {
    result.push({ adx: 0, plusDi: 0, minusDi: 0 });
  }

  let smoothTR = trArr.slice(0, period).reduce((a, b) => a + b, 0);
  let smoothPlusDM = plusDmArr.slice(0, period).reduce((a, b) => a + b, 0);
  let smoothMinusDM = minusDmArr.slice(0, period).reduce((a, b) => a + b, 0);

  const dxArr: number[] = [];
  let plusDi = (smoothPlusDM / smoothTR) * 100;
  let minusDi = (smoothMinusDM / smoothTR) * 100;
  let diSum = plusDi + minusDi;
  if (diSum > 0) dxArr.push((Math.abs(plusDi - minusDi) / diSum) * 100);

  result.push({ adx: dxArr[0] ?? 0, plusDi: Math.round(plusDi * 100) / 100, minusDi: Math.round(minusDi * 100) / 100 });

  for (let i = period; i < trArr.length; i++) {
    smoothTR = smoothTR - smoothTR / period + trArr[i];
    smoothPlusDM = smoothPlusDM - smoothPlusDM / period + plusDmArr[i];
    smoothMinusDM = smoothMinusDM - smoothMinusDM / period + minusDmArr[i];
    plusDi = smoothTR > 0 ? (smoothPlusDM / smoothTR) * 100 : 0;
    minusDi = smoothTR > 0 ? (smoothMinusDM / smoothTR) * 100 : 0;
    diSum = plusDi + minusDi;
    if (diSum > 0) dxArr.push((Math.abs(plusDi - minusDi) / diSum) * 100);

    let adx = 0;
    if (dxArr.length >= period) {
      adx = dxArr.slice(0, period).reduce((a, b) => a + b, 0) / period;
      for (let j = period; j < dxArr.length; j++) {
        adx = (adx * (period - 1) + dxArr[j]) / period;
      }
    } else if (dxArr.length > 0) {
      adx = dxArr.reduce((a, b) => a + b, 0) / dxArr.length;
    }

    result.push({
      adx: Math.round(adx * 100) / 100,
      plusDi: Math.round(plusDi * 100) / 100,
      minusDi: Math.round(minusDi * 100) / 100,
    });
  }

  return result;
}

// ─── BBDX-PATTERN v6.1 ──────────────────────────────────────────────────────
// Mirror of tradelab-backend/src/indicators.ts BBDX section. Production uses
// client-side scanning (bypasses server-side Bybit blocks per v1.5), so the
// same detection + decision logic runs here.

const PATTERN_STRENGTH: Record<CandlePatternName, number> = {
  engulfing: 100,
  morningStar: 90,
  hammer: 75,
  invertedHammer: 75,
  pinBar: 70,
  doji: 60,
  threeWhiteSoldiers: 85,
  bearishEngulfing: 100,
  eveningStar: 90,
  threeBlackCrows: 85,
};

const isBullCandle = (c: Candle) => c.close > c.open;
const isBearCandle = (c: Candle) => c.close < c.open;
const bodySize = (c: Candle) => Math.abs(c.close - c.open);
const upperWick = (c: Candle) => c.high - Math.max(c.open, c.close);
const lowerWick = (c: Candle) => Math.min(c.open, c.close) - c.low;
const candleRange = (c: Candle) => c.high - c.low;

function patternMatch(
  name: CandlePatternName,
  bias: "bullish" | "bearish",
  candlesAgo: number
): CandlePatternMatch {
  return { name, bias, candlesAgo, strength: PATTERN_STRENGTH[name] };
}

function detectHammerAt(candles: Candle[], idx: number): CandlePatternMatch | null {
  const c = candles[idx];
  if (!c || candleRange(c) === 0) return null;
  const body = bodySize(c);
  const lower = lowerWick(c);
  const upper = upperWick(c);
  if (
    lower >= body * 2 &&
    upper <= body * 0.5 &&
    body / candleRange(c) <= 0.4 &&
    isBullCandle(c)
  ) {
    return patternMatch("hammer", "bullish", candles.length - 1 - idx);
  }
  return null;
}

function detectInvertedHammerAt(candles: Candle[], idx: number): CandlePatternMatch | null {
  const c = candles[idx];
  if (!c || candleRange(c) === 0) return null;
  const body = bodySize(c);
  const lower = lowerWick(c);
  const upper = upperWick(c);
  if (
    upper >= body * 2 &&
    lower <= body * 0.5 &&
    body / candleRange(c) <= 0.4 &&
    isBullCandle(c)
  ) {
    return patternMatch("invertedHammer", "bullish", candles.length - 1 - idx);
  }
  return null;
}

function detectPinBarAt(candles: Candle[], idx: number): CandlePatternMatch | null {
  const c = candles[idx];
  if (!c || candleRange(c) === 0) return null;
  const body = bodySize(c);
  const lower = lowerWick(c);
  const upper = upperWick(c);
  const bullishPin =
    lower >= candleRange(c) * 0.6 &&
    upper <= candleRange(c) * 0.2 &&
    isBullCandle(c);
  if (bullishPin && body / candleRange(c) <= 0.3) {
    return patternMatch("pinBar", "bullish", candles.length - 1 - idx);
  }
  return null;
}

function detectDojiAt(candles: Candle[], idx: number): CandlePatternMatch | null {
  const c = candles[idx];
  if (!c || candleRange(c) === 0) return null;
  const body = bodySize(c);
  if (body / candleRange(c) <= 0.1) {
    return patternMatch("doji", "bullish", candles.length - 1 - idx);
  }
  return null;
}

function detectEngulfingAt(
  candles: Candle[],
  idx: number,
  dir: "bullish" | "bearish"
): CandlePatternMatch | null {
  if (idx < 1) return null;
  const prev = candles[idx - 1];
  const c = candles[idx];
  if (!c || !prev) return null;
  if (dir === "bullish") {
    if (
      isBearCandle(prev) &&
      isBullCandle(c) &&
      c.open <= prev.close &&
      c.close >= prev.open &&
      bodySize(c) > bodySize(prev)
    ) {
      return patternMatch("engulfing", "bullish", candles.length - 1 - idx);
    }
    return null;
  }
  if (
    isBullCandle(prev) &&
    isBearCandle(c) &&
    c.open >= prev.close &&
    c.close <= prev.open &&
    bodySize(c) > bodySize(prev)
  ) {
    return patternMatch("bearishEngulfing", "bearish", candles.length - 1 - idx);
  }
  return null;
}

function detectMorningStarAt(candles: Candle[], idx: number): CandlePatternMatch | null {
  if (idx < 2) return null;
  const c1 = candles[idx - 2];
  const c2 = candles[idx - 1];
  const c3 = candles[idx];
  if (!c1 || !c2 || !c3) return null;
  const c1Bear = isBearCandle(c1);
  const c2Small = bodySize(c2) <= bodySize(c1) * 0.5;
  const c3Bull = isBullCandle(c3);
  const c1Mid = (c1.open + c1.close) / 2;
  const c3PastMid = c3.close > c1Mid;
  if (c1Bear && c2Small && c3Bull && c3PastMid) {
    return patternMatch("morningStar", "bullish", candles.length - 1 - idx);
  }
  return null;
}

function detectEveningStarAt(candles: Candle[], idx: number): CandlePatternMatch | null {
  if (idx < 2) return null;
  const c1 = candles[idx - 2];
  const c2 = candles[idx - 1];
  const c3 = candles[idx];
  if (!c1 || !c2 || !c3) return null;
  const c1Bull = isBullCandle(c1);
  const c2Small = bodySize(c2) <= bodySize(c1) * 0.5;
  const c3Bear = isBearCandle(c3);
  const c1Mid = (c1.open + c1.close) / 2;
  const c3PastMid = c3.close < c1Mid;
  if (c1Bull && c2Small && c3Bear && c3PastMid) {
    return patternMatch("eveningStar", "bearish", candles.length - 1 - idx);
  }
  return null;
}

function detectThreeWhiteSoldiersAt(candles: Candle[], idx: number): CandlePatternMatch | null {
  if (idx < 2) return null;
  const c1 = candles[idx - 2];
  const c2 = candles[idx - 1];
  const c3 = candles[idx];
  if (
    isBullCandle(c1) &&
    isBullCandle(c2) &&
    isBullCandle(c3) &&
    c2.close > c1.close &&
    c3.close > c2.close &&
    c2.open >= c1.open &&
    c2.open <= c1.close &&
    c3.open >= c2.open &&
    c3.open <= c2.close
  ) {
    return patternMatch("threeWhiteSoldiers", "bullish", candles.length - 1 - idx);
  }
  return null;
}

function detectThreeBlackCrowsAt(candles: Candle[], idx: number): CandlePatternMatch | null {
  if (idx < 2) return null;
  const c1 = candles[idx - 2];
  const c2 = candles[idx - 1];
  const c3 = candles[idx];
  if (
    isBearCandle(c1) &&
    isBearCandle(c2) &&
    isBearCandle(c3) &&
    c2.close < c1.close &&
    c3.close < c2.close &&
    c2.open <= c1.open &&
    c2.open >= c1.close &&
    c3.open <= c2.open &&
    c3.open >= c2.close
  ) {
    return patternMatch("threeBlackCrows", "bearish", candles.length - 1 - idx);
  }
  return null;
}

function detectAtIndex(candles: Candle[], idx: number): CandlePatternMatch[] {
  const out: CandlePatternMatch[] = [];

  const bullEng = detectEngulfingAt(candles, idx, "bullish");
  if (bullEng) {
    out.push(bullEng);
  } else {
    const morningStar = detectMorningStarAt(candles, idx);
    if (morningStar) {
      out.push(morningStar);
    } else {
      const tws = detectThreeWhiteSoldiersAt(candles, idx);
      if (tws) {
        out.push(tws);
      } else {
        const hammer = detectHammerAt(candles, idx);
        const inv = detectInvertedHammerAt(candles, idx);
        const pin = detectPinBarAt(candles, idx);
        if (hammer) out.push(hammer);
        if (inv && !hammer) out.push(inv);
        if (pin && !hammer && !inv) out.push(pin);
        if (out.length === 0) {
          const doji = detectDojiAt(candles, idx);
          if (doji) out.push(doji);
        }
      }
    }
  }

  const bearEng = detectEngulfingAt(candles, idx, "bearish");
  if (bearEng) {
    out.push(bearEng);
  } else {
    const eveningStar = detectEveningStarAt(candles, idx);
    if (eveningStar) {
      out.push(eveningStar);
    } else {
      const tbc = detectThreeBlackCrowsAt(candles, idx);
      if (tbc) out.push(tbc);
    }
  }

  return out;
}

export function detectAllCandlePatterns(candles: Candle[]): CandlePatternMatch[] {
  if (candles.length < 1) return [];
  const out: CandlePatternMatch[] = [];
  const start = Math.max(0, candles.length - 5);
  for (let i = candles.length - 1; i >= start; i--) {
    const matches = detectAtIndex(candles, i);
    for (const m of matches) out.push(m);
  }
  return out;
}

// ── BB structure detection ─────────────────────────────────────────────────

function averageBandWidth(
  bbSeries: { upper: number; middle: number; lower: number }[],
  lookback = 20
): number {
  const recent = bbSeries.slice(-lookback);
  let sum = 0;
  let count = 0;
  for (const bb of recent) {
    if (bb.middle > 0) {
      sum += ((bb.upper - bb.lower) / bb.middle) * 100;
      count++;
    }
  }
  return count > 0 ? sum / count : 0;
}

function bandWidth(bb: { upper: number; middle: number; lower: number }): number {
  if (bb.middle <= 0) return 0;
  return ((bb.upper - bb.lower) / bb.middle) * 100;
}

export function detectBBStructure(
  candles: Candle[],
  bbSeries: { upper: number; middle: number; lower: number }[]
): BBStructure | null {
  if (candles.length < 5 || bbSeries.length < 5) return null;

  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  const lastBB = bbSeries[bbSeries.length - 1];
  const prevBB = bbSeries[bbSeries.length - 2];

  const prevTouchedLower = prev.low <= prevBB.lower * 0.98;
  const reversalCandle =
    isBullCandle(last) &&
    (lowerWick(last) >= bodySize(last) * 1.5 ||
      (last.open <= prev.close &&
        last.close >= prev.open &&
        bodySize(last) > bodySize(prev)));
  if (prevTouchedLower && reversalCandle && last.close > prev.close) {
    return "lowerBounce";
  }

  const avgBW = averageBandWidth(bbSeries.slice(0, -1));
  const recentBWs = bbSeries.slice(-6, -1).map(bandWidth);
  const wasSqueezed = recentBWs.some((bw) => avgBW > 0 && bw < avgBW * 0.6);
  const nowExpanded = avgBW > 0 && bandWidth(lastBB) > avgBW * 0.8;
  if (wasSqueezed && nowExpanded && isBullCandle(last) && last.close > lastBB.middle) {
    return "squeezeBreakout";
  }

  let middleTouches = 0;
  for (let i = candles.length - 5; i < candles.length; i++) {
    const c = candles[i];
    const bb = bbSeries[i];
    if (!c || !bb) continue;
    const lo = bb.middle * 0.99;
    const hi = bb.middle * 1.01;
    if (c.low <= hi && c.low >= lo) middleTouches++;
  }
  if (middleTouches >= 3 && last.close > lastBB.middle) {
    return "middleSupport";
  }

  if (candles.length >= 3) {
    const ridingCandles = candles.slice(-3);
    const ridingBBs = bbSeries.slice(-3);
    let allRiding = true;
    for (let i = 0; i < 3; i++) {
      const c = ridingCandles[i];
      const bb = ridingBBs[i];
      const upper20 = bb.upper - (bb.upper - bb.middle) * 0.2;
      if (!(c.close > upper20 && c.close > bb.middle && isBullCandle(c))) {
        allRiding = false;
        break;
      }
    }
    if (allRiding && bandWidth(lastBB) > avgBW * 0.7) {
      return "upperRiding";
    }
  }

  return null;
}

// ── Pressure / reversal / volume / falling knife ──────────────────────────

export function pressureLabel(plusDi: number, minusDi: number): PressureLabel {
  if (Math.abs(plusDi - minusDi) < 2) return "NEUTRAL";
  if (plusDi > minusDi) {
    return plusDi > 25 ? "BULL_PRESSURE" : "WEAK_BULL";
  }
  return minusDi > 25 ? "BEAR_PRESSURE" : "WEAK_BEAR";
}

export function reversalProbability(adx: number): number {
  return Math.max(0, Math.min(100, 100 - adx * 2.5));
}

export function volumeRatio(candles: Candle[]): number {
  if (candles.length < 100) {
    if (candles.length === 0) return 1;
    const avg = candles.reduce((a, c) => a + c.volume, 0) / candles.length;
    if (avg <= 0) return 1;
    const recent = candles.slice(-Math.min(5, candles.length));
    const recentAvg = recent.reduce((a, c) => a + c.volume, 0) / recent.length;
    return recentAvg / avg;
  }
  const totalAvg = candles.reduce((a, c) => a + c.volume, 0) / candles.length;
  if (totalAvg <= 0) return 1;
  const recent = candles.slice(-5);
  const recentAvg = recent.reduce((a, c) => a + c.volume, 0) / recent.length;
  return recentAvg / totalAvg;
}

export function volumeConfirmationFromRatio(ratio: number): number {
  if (ratio > 1.2) {
    return Math.max(0, Math.min(15, ((ratio - 0.8) / 0.4) * 15));
  }
  if (ratio < 0.8) return -5;
  return 0;
}

export function isFallingKnife(plusDi: number, minusDi: number, adx: number): boolean {
  return minusDi > plusDi && adx > 25;
}

// ── Entry / exit decisions ────────────────────────────────────────────────

const NUM_RSI_LOW = 25;
const NUM_RSI_HIGH = 38;
const NUM_BB_TOLERANCE = 0.02;
const NUM_ADX_MAX = 20;
const PTN_BB_TOLERANCE = 0.05;
const PTN_ADX_MAX = 25;

export function decideEntry(
  candles: Candle[],
  ind: TechnicalIndicators,
  patterns: CandlePatternMatch[],
  bbStructure: BBStructure | null,
  _volRatio: number
): EntryDecision | null {
  if (candles.length === 0) return null;
  const last = candles[candles.length - 1];
  const price = last.close;

  if (bbStructure != null) {
    return {
      path: "BB",
      reasons: [`BB structure: ${bbStructure}`],
      bbStructure,
    };
  }

  const bullishPatterns = patterns.filter((p) => p.bias === "bullish");
  if (bullishPatterns.length > 0) {
    const nearLower = price <= ind.bbLower * (1 + PTN_BB_TOLERANCE);
    const adxOk = ind.adx < PTN_ADX_MAX;
    if (nearLower && adxOk) {
      return {
        path: "PTN",
        reasons: [
          `${bullishPatterns.length} bullish pattern(s) detected`,
          `Price ≤ BB lower × ${1 + PTN_BB_TOLERANCE}`,
          `ADX ${ind.adx.toFixed(1)} < ${PTN_ADX_MAX}`,
        ],
        patterns: bullishPatterns,
      };
    }
  }

  const rsiOk = ind.rsi >= NUM_RSI_LOW && ind.rsi <= NUM_RSI_HIGH;
  const nearLower = price <= ind.bbLower * (1 + NUM_BB_TOLERANCE);
  const adxOk = ind.adx < NUM_ADX_MAX;
  if (rsiOk && nearLower && adxOk) {
    return {
      path: "NUM",
      reasons: [
        `RSI ${ind.rsi.toFixed(1)} ∈ [${NUM_RSI_LOW}, ${NUM_RSI_HIGH}]`,
        `Price ≤ BB lower × ${1 + NUM_BB_TOLERANCE}`,
        `ADX ${ind.adx.toFixed(1)} < ${NUM_ADX_MAX}`,
      ],
    };
  }

  return null;
}

const EXIT_RSI_THRESHOLD = 65;
const EXIT_ADX_THRESHOLD = 30;
const EXIT_PLUSDI_THRESHOLD = 25;

export function decideExit(
  price: number,
  ind: TechnicalIndicators,
  bearishPatterns: CandlePatternMatch[]
): ExitDecision | null {
  const triggers: ExitDecision["triggers"] = [];
  if (price >= ind.bbMiddle) triggers.push("bbMiddle");
  if (ind.rsi >= EXIT_RSI_THRESHOLD) triggers.push("rsi65");
  if (ind.adx >= EXIT_ADX_THRESHOLD) triggers.push("adx30");
  if (ind.plusDi >= EXIT_PLUSDI_THRESHOLD) triggers.push("plusDi25");

  const conditionsMet = triggers.length;
  const hasBearish = bearishPatterns.length > 0;
  const required = hasBearish ? 2 : 3;

  if (conditionsMet >= required) {
    return {
      conditionsMet,
      total: 4,
      relaxedToBearish: hasBearish && conditionsMet < 3,
      triggers,
    };
  }
  return null;
}

export function calculateSignalStrengthV2(
  price: number,
  ind: TechnicalIndicators,
  volumeConfirmation: number
): number {
  const rsiScore = Math.max(
    0,
    Math.min(25, ((NUM_RSI_HIGH - ind.rsi) / (NUM_RSI_HIGH - NUM_RSI_LOW)) * 25)
  );

  const range = ind.bbUpper - ind.bbLower;
  const bbProximity =
    range > 0
      ? Math.max(0, Math.min(25, (1 - (price - ind.bbLower) / range) * 25))
      : 0;

  const adxReversal = Math.max(0, Math.min(20, ((20 - ind.adx) / 20) * 20));
  const reversalProb = (reversalProbability(ind.adx) / 100) * 15;

  const total = rsiScore + bbProximity + adxReversal + reversalProb + volumeConfirmation;
  return Math.max(0, Math.min(100, Math.round(total)));
}

// ─── VWAP Strategy (Parker Brooks Style) ─────────────────────────────────
// Mirror of tradelab-backend/src/indicators.ts VWAP section. Production scans
// client-side per the v1.5 Bybit-block workaround, so the same logic runs
// here.

const VWAP_AT_TOLERANCE = 0.001;
const PULLBACK_PROXIMITY = 0.005;
const VWAP_SIGNAL_THRESHOLD = 50;

export function calculateVWAP(candles: Candle[]): number {
  let cumPV = 0;
  let cumVol = 0;
  for (const c of candles) {
    const typical = (c.high + c.low + c.close) / 3;
    cumPV += typical * c.volume;
    cumVol += c.volume;
  }
  return cumVol > 0 ? cumPV / cumVol : 0;
}

export function calculateEMA(values: number[], period: number): number {
  if (values.length === 0 || period <= 0) return 0;
  if (values.length < period) {
    return values.reduce((a, b) => a + b, 0) / values.length;
  }
  const k = 2 / (period + 1);
  let ema = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
  }
  return ema;
}

export function vwapPosition(price: number, vwap: number): VwapPosition {
  if (vwap <= 0) return "AT";
  const diff = (price - vwap) / vwap;
  if (Math.abs(diff) < VWAP_AT_TOLERANCE) return "AT";
  return diff > 0 ? "ABOVE" : "BELOW";
}

export function emaPosition(price: number, ema: number): EmaPosition {
  if (ema <= 0) return "AT";
  const diff = (price - ema) / ema;
  if (Math.abs(diff) < VWAP_AT_TOLERANCE) return "AT";
  return diff > 0 ? "ABOVE" : "BELOW";
}

export function detectPullback(
  candles: Candle[],
  vwap: number,
  ema9: number
): boolean {
  if (candles.length < 5 || vwap <= 0 || ema9 <= 0) return false;
  const last = candles[candles.length - 1];
  const currentSide = vwapPosition(last.close, vwap);
  if (currentSide === "AT") return false;

  const lookback = candles.slice(-5);
  for (const c of lookback) {
    const distance = Math.abs(c.low - vwap) / vwap;
    const distanceHigh = Math.abs(c.high - vwap) / vwap;
    const minDist = Math.min(distance, distanceHigh);
    if (minDist <= PULLBACK_PROXIMITY) {
      const closeSide = vwapPosition(c.close, vwap);
      if (closeSide === currentSide || closeSide === "AT") return true;
    }
  }
  for (const c of lookback) {
    const distance = Math.abs(c.low - ema9) / ema9;
    const distanceHigh = Math.abs(c.high - ema9) / ema9;
    const minDist = Math.min(distance, distanceHigh);
    if (minDist <= PULLBACK_PROXIMITY) {
      const closeSide = emaPosition(c.close, ema9);
      if (closeSide === currentSide || closeSide === "AT") return true;
    }
  }
  return false;
}

export function decideVwapSignal(
  price: number,
  vwap: number,
  ema9: number,
  pullback: boolean,
  volRatio: number
): VwapSignal | null {
  if (vwap <= 0 || ema9 <= 0 || price <= 0) return null;

  const vwapPos = vwapPosition(price, vwap);
  const emaPos = emaPosition(price, ema9);
  if (vwapPos === "AT") return null;

  let side: "LONG" | "SHORT" | null = null;
  if (vwapPos === "ABOVE" && (emaPos === "ABOVE" || emaPos === "AT")) {
    side = "LONG";
  } else if (vwapPos === "BELOW" && (emaPos === "BELOW" || emaPos === "AT")) {
    side = "SHORT";
  }
  if (!side) return null;

  const vwapDistPct = Math.abs(price - vwap) / vwap;
  const vwapDistanceScore = Math.max(0, Math.min(35, vwapDistPct * 100 * 17.5));
  const aligned =
    (side === "LONG" && emaPos === "ABOVE") ||
    (side === "SHORT" && emaPos === "BELOW");
  const emaScore = aligned ? 25 : 12.5;
  const volRaw = volumeConfirmationFromRatio(volRatio);
  const volScore = Math.max(0, Math.min(25, ((volRaw + 5) / 20) * 25));
  const pullbackScore = pullback ? 15 : 0;

  const strength = Math.max(
    0,
    Math.min(
      100,
      Math.round(vwapDistanceScore + emaScore + volScore + pullbackScore)
    )
  );
  if (strength < VWAP_SIGNAL_THRESHOLD) return null;

  const reasons: string[] = [];
  reasons.push(
    side === "LONG"
      ? `Price ABOVE VWAP (${(vwapDistPct * 100).toFixed(2)}%)`
      : `Price BELOW VWAP (${(vwapDistPct * 100).toFixed(2)}%)`
  );
  reasons.push(
    `EMA(9) ${emaPos.toLowerCase()} (${aligned ? "aligned" : "transition"})`
  );
  if (pullback) reasons.push("Pullback detected (entry zone)");
  if (volRatio > 1.2) reasons.push(`Volume +${((volRatio - 1) * 100).toFixed(0)}%`);

  return { side, strength, reasons };
}
