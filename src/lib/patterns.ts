/**
 * Frontend mirror of the backend pattern definitions.
 *
 * Source of truth: `tradelab-backend/src/patterns/`. These predicates
 * are duplicated here so client-side analysis (chart detail pages,
 * scan tables) can highlight the same patterns the backend signals.
 * Keep the two in sync — when the backend's `definitions.ts` changes,
 * mirror the change here and ensure tests pass on both sides.
 *
 * Look-ahead safety holds by construction: every predicate operates
 * only on the candles it receives.
 */

export interface CandleLike {
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface CandleMetrics {
  body: number;
  range: number;
  upperWick: number;
  lowerWick: number;
  isBull: boolean;
}

export function getMetrics(c: CandleLike): CandleMetrics {
  return {
    body: Math.abs(c.close - c.open),
    range: c.high - c.low,
    upperWick: c.high - Math.max(c.open, c.close),
    lowerWick: Math.min(c.open, c.close) - c.low,
    isBull: c.close >= c.open,
  };
}

export function isHammer(c: CandleLike): boolean {
  const m = getMetrics(c);
  if (m.range === 0 || m.body === 0) return false;
  return (
    m.lowerWick >= m.body * 2.0 &&
    m.upperWick <= m.body * 0.5 &&
    m.body / m.range >= 0.05 &&
    m.body / m.range <= 0.4
  );
}

export function isInvertedHammer(c: CandleLike): boolean {
  const m = getMetrics(c);
  if (m.range === 0 || m.body === 0) return false;
  return (
    m.upperWick >= m.body * 2.0 &&
    m.lowerWick <= m.body * 0.5 &&
    m.body / m.range >= 0.05 &&
    m.body / m.range <= 0.4
  );
}

export function isBullishPinBar(c: CandleLike): boolean {
  const m = getMetrics(c);
  if (m.range === 0) return false;
  return (
    m.lowerWick / m.range >= 0.6 &&
    m.body / m.range <= 0.3 &&
    m.upperWick / m.range <= 0.2 &&
    c.close > c.open
  );
}

export function isDoji(c: CandleLike, threshold = 0.1): boolean {
  const m = getMetrics(c);
  if (m.range === 0) return false;
  return m.body / m.range < threshold;
}

export function isBullishEngulfing(prev: CandleLike, curr: CandleLike): boolean {
  const prevBear = prev.close < prev.open;
  const currBull = curr.close > curr.open;
  if (!prevBear || !currBull) return false;
  const prevBody = Math.abs(prev.close - prev.open);
  const currBody = Math.abs(curr.close - curr.open);
  return (
    curr.open <= prev.close &&
    curr.close >= prev.open &&
    currBody > prevBody * 0.8
  );
}

export function isBearishEngulfing(prev: CandleLike, curr: CandleLike): boolean {
  const prevBull = prev.close > prev.open;
  const currBear = curr.close < curr.open;
  if (!prevBull || !currBear) return false;
  const prevBody = Math.abs(prev.close - prev.open);
  const currBody = Math.abs(curr.close - curr.open);
  return (
    curr.open >= prev.close &&
    curr.close <= prev.open &&
    currBody > prevBody * 0.8
  );
}

export function isMorningStar(
  c1: CandleLike,
  c2: CandleLike,
  c3: CandleLike
): boolean {
  const m1 = getMetrics(c1);
  const m2 = getMetrics(c2);
  const m3 = getMetrics(c3);
  if (!(c1.close < c1.open) || !(c3.close > c3.open)) return false;
  if (m1.range === 0 || m3.range === 0) return false;
  const c2Body = m2.body / Math.max(m2.range, 1e-9);
  return (
    m1.body / m1.range >= 0.5 &&
    c2Body <= 0.3 &&
    m3.body / m3.range >= 0.5 &&
    c3.close > (c1.open + c1.close) / 2
  );
}

export function isEveningStar(
  c1: CandleLike,
  c2: CandleLike,
  c3: CandleLike
): boolean {
  const m1 = getMetrics(c1);
  const m2 = getMetrics(c2);
  const m3 = getMetrics(c3);
  if (!(c1.close > c1.open) || !(c3.close < c3.open)) return false;
  if (m1.range === 0 || m3.range === 0) return false;
  const c2Body = m2.body / Math.max(m2.range, 1e-9);
  return (
    m1.body / m1.range >= 0.5 &&
    c2Body <= 0.3 &&
    m3.body / m3.range >= 0.5 &&
    c3.close < (c1.open + c1.close) / 2
  );
}

export function isThreeWhiteSoldiers(
  c1: CandleLike,
  c2: CandleLike,
  c3: CandleLike
): boolean {
  if (!(c1.close > c1.open && c2.close > c2.open && c3.close > c3.open))
    return false;
  if (!(c2.close > c1.close && c3.close > c2.close)) return false;
  if (
    !(
      c2.open >= c1.open &&
      c2.open <= c1.close &&
      c3.open >= c2.open &&
      c3.open <= c2.close
    )
  )
    return false;
  const m1 = getMetrics(c1);
  const m2 = getMetrics(c2);
  const m3 = getMetrics(c3);
  if (m1.range === 0 || m2.range === 0 || m3.range === 0) return false;
  return (
    m1.body / m1.range >= 0.5 &&
    m2.body / m2.range >= 0.5 &&
    m3.body / m3.range >= 0.5
  );
}

export function isThreeBlackCrows(
  c1: CandleLike,
  c2: CandleLike,
  c3: CandleLike
): boolean {
  if (!(c1.close < c1.open && c2.close < c2.open && c3.close < c3.open))
    return false;
  if (!(c2.close < c1.close && c3.close < c2.close)) return false;
  if (
    !(
      c2.open <= c1.open &&
      c2.open >= c1.close &&
      c3.open <= c2.open &&
      c3.open >= c2.close
    )
  )
    return false;
  const m1 = getMetrics(c1);
  const m2 = getMetrics(c2);
  const m3 = getMetrics(c3);
  if (m1.range === 0 || m2.range === 0 || m3.range === 0) return false;
  return (
    m1.body / m1.range >= 0.5 &&
    m2.body / m2.range >= 0.5 &&
    m3.body / m3.range >= 0.5
  );
}
