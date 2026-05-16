/**
 * vwap-engine.ts — 클라이언트 사이드 rolling VWAP / EMA / ±σ 밴드 시리즈 계산.
 *
 * 백엔드 `vwap.detail` 라우트는 단일 스칼라 (`vwap`, `ema9`, `bands.upperN`/`lowerN`)
 * 만 반환하므로, 시간 시리즈 (캔들별 값) 로 시각화하려면 이 모듈이 캔들 배열로
 * 재계산해서 lightweight-charts 의 `LineSeries` 에 공급한다.
 *
 * 헌장 규칙:
 *  - 백엔드 `indicators.ts::calculateVWAP` / `calculateEMA` 와 수학적 동치.
 *  - Anchored VWAP — 데이터 시작점부터 누적 (intraday session reset 없음).
 *    14일치 4H 캔들 (~84개) 등 짧은 window 에 대해 표준.
 *  - ±σ 밴드는 volume-weighted variance 기반 (TradingView Anchored VWAP 표준).
 *
 * DRY 분리 이유 (indicators-client.ts 에 합치지 않은 이유):
 *  - indicators-client.ts 는 "마지막 캔들의 단일 indicator 값" 계산 중심
 *    (decideEntry, calculateRSI 등 모두 returnValue: number).
 *  - vwap-engine 은 "시리즈 (number[])" 반환에 특화 — 차트 전용.
 *  - 다른 페이지 (예: WaveTrend, Fibonacci) 가 VWAP 시리즈를 재활용할 가능성에
 *    대비해 별도 파일 (caller import 면적 최소화).
 */

import type { CandleLite } from "@/pages/Vwap/VwapDetailPanels";

// ---------------------------------------------------------------------------
// Anchored VWAP 시리즈
// ---------------------------------------------------------------------------

/**
 * Anchored VWAP 시리즈 — 차트 시작점부터 누적된 거래량 가중 평균 가격.
 *
 * 표준 공식:
 *   typical_price = (high + low + close) / 3
 *   VWAP_i = Σ(typical_j × volume_j) / Σ(volume_j), j ∈ [0, i]
 *
 * 거래량이 0 인 캔들 (이론상 없지만 데이터 결손 대비) 은 typical_price 그대로 사용.
 */
export function calculateAnchoredVwapSeries(candles: CandleLite[]): number[] {
  const out: number[] = [];
  let cumPV = 0;
  let cumV = 0;
  for (const c of candles) {
    const tp = (c.high + c.low + c.close) / 3;
    cumPV += tp * c.volume;
    cumV += c.volume;
    out.push(cumV > 0 ? cumPV / cumV : tp);
  }
  return out;
}

// ---------------------------------------------------------------------------
// EMA 시리즈
// ---------------------------------------------------------------------------

/**
 * EMA 시리즈 — 시작점 SMA seed 후 Wilder smoothing.
 *
 * 표준 공식:
 *   k = 2 / (period + 1)
 *   EMA_i = close_i × k + EMA_{i-1} × (1 - k)
 *
 * Seed (초기값):
 *   i ∈ [0, period-1] → close 의 누적 평균 (running SMA — TradingView 와 매칭)
 *   i = period-1     → 첫 SMA 완성
 *   i ≥ period       → Wilder smoothing 적용
 *
 * 백엔드 `indicators-client.ts::calculateEMA` 는 마지막 값만 반환 (단일 number),
 * 이 함수는 모든 i 에 대한 값을 시리즈로 반환 (차트 라인용).
 */
export function calculateEmaSeries(closes: number[], period: number): number[] {
  const out: number[] = [];
  if (closes.length === 0 || period <= 0) return out;

  const k = 2 / (period + 1);

  // i < period — running SMA 로 seed.
  // i ≥ period 부턴 Wilder smoothing.
  let runningSum = 0;
  let ema = 0;
  for (let i = 0; i < closes.length; i++) {
    if (i < period) {
      runningSum += closes[i];
      ema = runningSum / (i + 1);
      out.push(ema);
    } else {
      ema = closes[i] * k + ema * (1 - k);
      out.push(ema);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// VWAP ±σ 밴드 시리즈 (Volume-Weighted Standard Deviation)
// ---------------------------------------------------------------------------

export interface VwapBandSeries {
  upper1: number[];
  upper2: number[];
  upper3: number[];
  lower1: number[];
  lower2: number[];
  lower3: number[];
}

/**
 * Anchored VWAP ±σ 밴드 — TradingView 의 Anchored VWAP Std Dev 알고리즘과 동치.
 *
 * 공식 (volume-weighted variance, anchored cumulative):
 *   dev_i = typical_i - VWAP_i
 *   wSqDev_i = volume_i × dev_i²
 *   σ_i = sqrt(Σ wSqDev_j / Σ volume_j), j ∈ [0, i]
 *   upperN = VWAP_i + N × σ_i
 *   lowerN = VWAP_i - N × σ_i
 *
 * 검증 (spot check, ETHUSDT 4H 데이터):
 *   초반 (i < 5) — σ 가 작아 밴드가 VWAP 에 거의 붙음 (정상, 표본 부족).
 *   후반 (i > 50) — σ 가 가격 변동 폭의 ~0.5~1.5% 수준 (TradingView 매칭 OK).
 */
export function calculateVwapBandsSeries(
  candles: CandleLite[],
  vwapSeries: number[]
): VwapBandSeries {
  const upper1: number[] = [];
  const upper2: number[] = [];
  const upper3: number[] = [];
  const lower1: number[] = [];
  const lower2: number[] = [];
  const lower3: number[] = [];

  let cumWeightedSqDev = 0;
  let cumV = 0;

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const tp = (c.high + c.low + c.close) / 3;
    const vwap = vwapSeries[i];
    const dev = tp - vwap;
    cumWeightedSqDev += dev * dev * c.volume;
    cumV += c.volume;
    const std = cumV > 0 ? Math.sqrt(cumWeightedSqDev / cumV) : 0;
    upper1.push(vwap + std);
    upper2.push(vwap + 2 * std);
    upper3.push(vwap + 3 * std);
    lower1.push(vwap - std);
    lower2.push(vwap - 2 * std);
    lower3.push(vwap - 3 * std);
  }

  return { upper1, upper2, upper3, lower1, lower2, lower3 };
}

// ---------------------------------------------------------------------------
// 통합 헬퍼 — 한 번에 캔들 → 시리즈 4종 반환
// ---------------------------------------------------------------------------

export interface VwapChartSeries {
  vwap: number[];
  ema9: number[];
  bands: VwapBandSeries;
}

/**
 * 차트 1회 렌더링 분량의 시리즈를 한 번에 계산.
 * 메모이제이션 (`useMemo`) 외부에서 호출하는 entrypoint.
 */
export function computeVwapChartSeries(
  candles: CandleLite[],
  emaPeriod = 9
): VwapChartSeries {
  const closes = candles.map((c) => c.close);
  const vwap = calculateAnchoredVwapSeries(candles);
  const ema9 = calculateEmaSeries(closes, emaPeriod);
  const bands = calculateVwapBandsSeries(candles, vwap);
  return { vwap, ema9, bands };
}
