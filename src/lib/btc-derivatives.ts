/**
 * BTC Derivatives Data Module (Client-side)
 * 바이비트 V5 API에서 BTC 선물 파생상품 데이터를 직접 조회합니다.
 * - Open Interest (미결제약정)
 * - Long/Short Ratio (롱숏 비율)
 * - Funding Rate (펀딩비)
 * - Liquidation Pressure Estimation (청산 압력 추정)
 */

const BYBIT_BASE = "https://api.bybit.com";

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
      console.warn(`[BTC-Deriv] HTTP ${response.status} for ${path}`);
      return null;
    }

    const data = await response.json();
    if (data.retCode !== 0) {
      console.warn(`[BTC-Deriv] API error: ${data.retMsg}`);
      return null;
    }
    return data.result as T;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === "AbortError") {
      console.warn(`[BTC-Deriv] Timeout for ${path}`);
    } else {
      console.warn(`[BTC-Deriv] Error: ${error.message}`);
    }
    return null;
  }
}

// ─── Types ───────────────────────────────────────────────────

export interface OIDataPoint {
  timestamp: number;
  openInterest: number; // BTC 단위
}

export interface LongShortDataPoint {
  timestamp: number;
  buyRatio: number;
  sellRatio: number;
  lsRatio: number; // buyRatio / sellRatio
}

export interface FundingRateDataPoint {
  timestamp: number;
  fundingRate: number;
}

export interface BTCDerivativesSnapshot {
  price: number;
  markPrice: number;
  indexPrice: number;
  openInterest: number; // BTC
  openInterestValue: number; // USD
  volume24h: number;
  turnover24h: number;
  fundingRate: number;
  nextFundingTime: number;
  highPrice24h: number;
  lowPrice24h: number;
  change24h: number;
}

export interface WaveAnalysis {
  score: number; // 0~100 (0=횡보, 100=강한 파동 임박)
  label: "SIDEWAYS" | "BUILDING" | "IMMINENT" | "WAVE_LIKELY";
  reasons: string[];
  oiTrend: "rising" | "falling" | "flat";
  longPressure: number; // 0~100 롱 청산 압력
  shortPressure: number; // 0~100 숏 청산 압력
  dominantLiqSide: "long" | "short" | "balanced";
  oiChangeRate: number; // OI 변화율 %
  fundingBias: "long_heavy" | "short_heavy" | "neutral";
}

// ─── API Calls ───────────────────────────────────────────────

/**
 * BTC 선물 현재 스냅샷 (실시간 티커)
 */
export async function fetchBTCDerivativesSnapshot(): Promise<BTCDerivativesSnapshot | null> {
  const result = await bybitFetch<{ list: any[] }>(
    "/v5/market/tickers",
    { category: "linear", symbol: "BTCUSDT" }
  );

  if (!result?.list?.[0]) return null;
  const t = result.list[0];

  return {
    price: parseFloat(t.lastPrice),
    markPrice: parseFloat(t.markPrice),
    indexPrice: parseFloat(t.indexPrice),
    openInterest: parseFloat(t.openInterest),
    openInterestValue: parseFloat(t.openInterestValue),
    volume24h: parseFloat(t.volume24h),
    turnover24h: parseFloat(t.turnover24h),
    fundingRate: parseFloat(t.fundingRate),
    nextFundingTime: parseInt(t.nextFundingTime),
    highPrice24h: parseFloat(t.highPrice24h),
    lowPrice24h: parseFloat(t.lowPrice24h),
    change24h: parseFloat(t.price24hPcnt) * 100,
  };
}

/**
 * OI 히스토리 조회
 */
export async function fetchOIHistory(
  intervalTime: "5min" | "15min" | "30min" | "1h" | "4h" | "1d" = "1h",
  limit = 168 // 7일 * 24시간
): Promise<OIDataPoint[]> {
  const result = await bybitFetch<{ list: any[] }>(
    "/v5/market/open-interest",
    { category: "linear", symbol: "BTCUSDT", intervalTime, limit }
  );

  if (!result?.list?.length) return [];

  // 바이비트는 최신이 먼저 → 역순 정렬
  return [...result.list].reverse().map((item) => ({
    timestamp: parseInt(item.timestamp),
    openInterest: parseFloat(item.openInterest),
  }));
}

/**
 * Long/Short Ratio 히스토리 조회
 */
export async function fetchLongShortRatio(
  period: "5min" | "15min" | "30min" | "1h" | "4h" | "1d" = "1h",
  limit = 168
): Promise<LongShortDataPoint[]> {
  const result = await bybitFetch<{ list: any[] }>(
    "/v5/market/account-ratio",
    { category: "linear", symbol: "BTCUSDT", period, limit }
  );

  if (!result?.list?.length) return [];

  return [...result.list].reverse().map((item) => ({
    timestamp: parseInt(item.timestamp),
    buyRatio: parseFloat(item.buyRatio),
    sellRatio: parseFloat(item.sellRatio),
    lsRatio: parseFloat(item.sellRatio) > 0
      ? parseFloat(item.buyRatio) / parseFloat(item.sellRatio)
      : 1,
  }));
}

/**
 * Funding Rate 히스토리 조회
 */
export async function fetchFundingRateHistory(
  limit = 50 // 약 16일분 (8시간 간격)
): Promise<FundingRateDataPoint[]> {
  const result = await bybitFetch<{ list: any[] }>(
    "/v5/market/funding/history",
    { category: "linear", symbol: "BTCUSDT", limit }
  );

  if (!result?.list?.length) return [];

  return [...result.list].reverse().map((item) => ({
    timestamp: parseInt(item.fundingRateTimestamp),
    fundingRate: parseFloat(item.fundingRate),
  }));
}

// ─── Wave Analysis Algorithm ─────────────────────────────────

/**
 * 파동 분석 알고리즘
 * 
 * 핵심 로직:
 * 1. OI가 급격히 증가 → 새로운 포지션 유입 → 파동 에너지 축적
 * 2. 롱 비율이 높고 OI가 높으면 → 롱 청산 압력 ↑ → 하방 파동 가능
 * 3. 숏 비율이 높고 OI가 높으면 → 숏 청산 압력 ↑ → 상방 파동 가능
 * 4. 펀딩비가 극단적 → 한쪽 포지션 과밀 → 청산 캐스케이드 가능
 * 5. OI 변화 없고 펀딩비 중립 → 횡보
 */
export function analyzeWave(
  oiHistory: OIDataPoint[],
  lsHistory: LongShortDataPoint[],
  fundingHistory: FundingRateDataPoint[],
  snapshot: BTCDerivativesSnapshot | null
): WaveAnalysis {
  const reasons: string[] = [];
  let score = 0;

  // ── 1. OI 변화율 분석 (최근 24시간 vs 이전 24시간) ──
  let oiChangeRate = 0;
  let oiTrend: "rising" | "falling" | "flat" = "flat";

  if (oiHistory.length >= 48) {
    const recent24h = oiHistory.slice(-24);
    const prev24h = oiHistory.slice(-48, -24);
    const recentAvg = recent24h.reduce((s, d) => s + d.openInterest, 0) / recent24h.length;
    const prevAvg = prev24h.reduce((s, d) => s + d.openInterest, 0) / prev24h.length;
    oiChangeRate = ((recentAvg - prevAvg) / prevAvg) * 100;

    if (oiChangeRate > 3) {
      oiTrend = "rising";
      score += Math.min(30, oiChangeRate * 5);
      reasons.push(`OI 24h 변화율 +${oiChangeRate.toFixed(1)}% → 새로운 포지션 대량 유입`);
    } else if (oiChangeRate > 1) {
      oiTrend = "rising";
      score += 10;
      reasons.push(`OI 소폭 증가 +${oiChangeRate.toFixed(1)}%`);
    } else if (oiChangeRate < -3) {
      oiTrend = "falling";
      score += 15; // OI 급감도 파동 후 정리 or 새 파동 전조
      reasons.push(`OI 24h 변화율 ${oiChangeRate.toFixed(1)}% → 포지션 대량 청산/정리`);
    } else {
      oiTrend = "flat";
      reasons.push(`OI 변화 미미 (${oiChangeRate.toFixed(1)}%) → 관망세`);
    }
  } else if (oiHistory.length >= 2) {
    const first = oiHistory[0].openInterest;
    const last = oiHistory[oiHistory.length - 1].openInterest;
    oiChangeRate = ((last - first) / first) * 100;
    oiTrend = oiChangeRate > 1 ? "rising" : oiChangeRate < -1 ? "falling" : "flat";
  }

  // ── 2. OI 절대 수준 분석 ──
  if (snapshot) {
    const oiValueBillions = snapshot.openInterestValue / 1e9;
    if (oiValueBillions > 5) {
      score += 15;
      reasons.push(`OI 규모 $${oiValueBillions.toFixed(1)}B → 대규모 미결제약정 축적`);
    } else if (oiValueBillions > 3) {
      score += 8;
      reasons.push(`OI 규모 $${oiValueBillions.toFixed(1)}B → 중간 수준`);
    }
  }

  // ── 3. Long/Short Ratio 분석 ──
  let longPressure = 50;
  let shortPressure = 50;
  let dominantLiqSide: "long" | "short" | "balanced" = "balanced";

  if (lsHistory.length >= 5) {
    const recentLS = lsHistory.slice(-5);
    const avgBuyRatio = recentLS.reduce((s, d) => s + d.buyRatio, 0) / recentLS.length;
    const avgSellRatio = recentLS.reduce((s, d) => s + d.sellRatio, 0) / recentLS.length;

    // 롱 비율이 높으면 → 롱 청산 압력 증가 (하방 파동 가능)
    // 숏 비율이 높으면 → 숏 청산 압력 증가 (상방 파동 가능)
    longPressure = Math.round(avgBuyRatio * 100);
    shortPressure = Math.round(avgSellRatio * 100);

    if (avgBuyRatio > 0.55) {
      dominantLiqSide = "long";
      score += 15;
      reasons.push(`롱 비율 ${(avgBuyRatio * 100).toFixed(1)}% → 롱 과밀, 하방 청산 압력 높음`);
    } else if (avgSellRatio > 0.55) {
      dominantLiqSide = "short";
      score += 15;
      reasons.push(`숏 비율 ${(avgSellRatio * 100).toFixed(1)}% → 숏 과밀, 상방 청산 압력 높음`);
    } else {
      dominantLiqSide = "balanced";
      reasons.push(`롱/숏 비율 균형 (${(avgBuyRatio * 100).toFixed(1)}% / ${(avgSellRatio * 100).toFixed(1)}%)`);
    }

    // 롱/숏 비율 변화 추세
    if (lsHistory.length >= 24) {
      const oldLS = lsHistory.slice(-24, -12);
      const newLS = lsHistory.slice(-12);
      const oldAvgBuy = oldLS.reduce((s, d) => s + d.buyRatio, 0) / oldLS.length;
      const newAvgBuy = newLS.reduce((s, d) => s + d.buyRatio, 0) / newLS.length;
      const lsShift = (newAvgBuy - oldAvgBuy) * 100;

      if (Math.abs(lsShift) > 2) {
        score += 10;
        reasons.push(
          lsShift > 0
            ? `롱 비율 급증 추세 (+${lsShift.toFixed(1)}%p) → 편향 심화`
            : `숏 비율 급증 추세 (+${(-lsShift).toFixed(1)}%p) → 편향 심화`
        );
      }
    }
  }

  // ── 4. Funding Rate 분석 ──
  let fundingBias: "long_heavy" | "short_heavy" | "neutral" = "neutral";

  if (fundingHistory.length >= 3) {
    const recentFunding = fundingHistory.slice(-3);
    const avgFunding = recentFunding.reduce((s, d) => s + d.fundingRate, 0) / recentFunding.length;

    if (avgFunding > 0.0003) {
      fundingBias = "long_heavy";
      score += 15;
      reasons.push(`펀딩비 높음 (${(avgFunding * 100).toFixed(4)}%) → 롱 과열, 하방 청산 리스크`);
    } else if (avgFunding > 0.0001) {
      fundingBias = "long_heavy";
      score += 5;
      reasons.push(`펀딩비 양수 (${(avgFunding * 100).toFixed(4)}%) → 롱 우세`);
    } else if (avgFunding < -0.0003) {
      fundingBias = "short_heavy";
      score += 15;
      reasons.push(`펀딩비 음수 (${(avgFunding * 100).toFixed(4)}%) → 숏 과열, 상방 청산 리스크`);
    } else if (avgFunding < -0.0001) {
      fundingBias = "short_heavy";
      score += 5;
      reasons.push(`펀딩비 음수 (${(avgFunding * 100).toFixed(4)}%) → 숏 우세`);
    } else {
      fundingBias = "neutral";
      reasons.push(`펀딩비 중립 (${(avgFunding * 100).toFixed(4)}%)`);
    }

    // 펀딩비 변화 추세
    if (fundingHistory.length >= 6) {
      const oldFunding = fundingHistory.slice(-6, -3);
      const newFunding = fundingHistory.slice(-3);
      const oldAvg = oldFunding.reduce((s, d) => s + d.fundingRate, 0) / oldFunding.length;
      const newAvg = newFunding.reduce((s, d) => s + d.fundingRate, 0) / newFunding.length;

      if (Math.abs(newAvg - oldAvg) > 0.0002) {
        score += 10;
        reasons.push(`펀딩비 급변 → 시장 심리 급격한 변화`);
      }
    }
  }

  // ── 5. 복합 조건 (OI 증가 + 편향 심화 = 파동 가능성 극대화) ──
  if (oiTrend === "rising" && dominantLiqSide !== "balanced") {
    score += 10;
    reasons.push(`OI 증가 + ${dominantLiqSide === "long" ? "롱" : "숏"} 편향 → 청산 캐스케이드 가능성`);
  }

  if (oiTrend === "rising" && fundingBias !== "neutral") {
    score += 5;
    reasons.push(`OI 증가 + 펀딩비 편향 → 에너지 축적 중`);
  }

  // 점수 캡핑
  score = Math.min(100, Math.max(0, Math.round(score)));

  // 라벨 결정
  let label: WaveAnalysis["label"];
  if (score >= 75) {
    label = "WAVE_LIKELY";
  } else if (score >= 50) {
    label = "IMMINENT";
  } else if (score >= 25) {
    label = "BUILDING";
  } else {
    label = "SIDEWAYS";
  }

  return {
    score,
    label,
    reasons,
    oiTrend,
    longPressure,
    shortPressure,
    dominantLiqSide,
    oiChangeRate,
    fundingBias,
  };
}
