/**
 * Investment Simulator — PnL / ROE / Margin Ratio 정확화 (2026-05-19).
 *
 * Bybit Perp 표준 공식 (INVESTMENT_SIMULATOR_AUDIT.md §1.4).
 *
 * 핵심 원칙:
 *   - **PnL 은 leverage 와 무관** — quantity (raw asset 단위) × 가격 차이.
 *     Leverage 는 "필요 margin" 에 반영되어 ROE 에서만 효과가 드러난다.
 *   - **ROE = unrealizedPnL / marginUsed** — 사용자가 실제로 지각하는 % 수익률.
 *   - **Margin Ratio = maintenance / currentMargin** — 청산 임박도 (1.0 = 청산).
 *
 * 본 모듈은 순수 함수 (no localStorage / no side effect). UI 와 store 양쪽에서
 * 동일 공식을 재사용 → 일관성 보장.
 *
 * 예시 (₩200,000 BTC LONG 10x):
 *   - margin $1000, quantity 0.125 BTC, entry $80,000
 *   - +1% 가격 → currentPrice $80,800
 *     pnl = 0.125 × (80800 - 80000) = $100
 *     roe = $100 / $1000 = +10%
 *   - 청산 임계 (-100% ROE) → 가격 $72,000 (10% 하락)
 *     pnl = 0.125 × (72000 - 80000) = -$1000
 *     roe = -$1000 / $1000 = -100%
 */

export const DEFAULT_MAINTENANCE_MARGIN_RATE = 0.005; // 0.5% (Bybit isolated 기본)

/**
 * Unrealized / Realized PnL — USD 환산 손익.
 *
 * LONG : size × (currentPrice - entryPrice)
 * SHORT: size × (entryPrice - currentPrice)
 *
 * @param side  포지션 방향
 * @param size  raw asset 단위 (예: BTC 0.125, 100 USDT/BTC 컨트랙트 X)
 * @param entryPrice  체결가
 * @param currentPrice  현재 mark price (또는 청산 시 exit price)
 * @returns USD 환산 PnL (양수 = 이익, 음수 = 손실)
 */
export function computeUnrealizedPnL(
  side: "long" | "short",
  size: number,
  entryPrice: number,
  currentPrice: number,
): number {
  if (size <= 0) return 0;
  if (entryPrice <= 0 || currentPrice <= 0) return 0;
  if (side === "long") {
    return size * (currentPrice - entryPrice);
  }
  return size * (entryPrice - currentPrice);
}

/**
 * ROE — Return on Equity (margin used 대비 손익 비율).
 *
 *   roe = pnl / marginUsed
 *
 * 10x leverage 사용자가 1% 가격 변동에서 10% ROE 를 보는 이유:
 *   margin = positionValue / leverage → 작은 margin 으로 큰 notional 보유.
 *
 * @returns 0~1 범위가 아님 (음수 가능, +1 = 100%, -1 = -100% = 청산 임계).
 */
export function computeROE(
  side: "long" | "short",
  size: number,
  entryPrice: number,
  currentPrice: number,
  marginUsed: number,
): number {
  if (marginUsed <= 0) return 0;
  const pnl = computeUnrealizedPnL(side, size, entryPrice, currentPrice);
  return pnl / marginUsed;
}

/**
 * Margin Ratio — 청산 임박도 (Bybit isolated margin 스타일).
 *
 *   currentMargin     = marginUsed + unrealizedPnL
 *   maintenanceMargin = size × currentPrice × maintenanceMarginRate
 *   ratio             = maintenanceMargin / currentMargin
 *
 * 해석:
 *   - 0.0 ~ 0.5: 정상 (안전)
 *   - 0.5 ~ 0.8: 경고 (가격 더 불리하면 곧 청산)
 *   - 0.8 ~ 1.0: 위험 (청산 임박)
 *   - >= 1.0  : 청산 발동 임계
 *
 * 본 함수는 청산 자체를 트리거하지 않는다 (liqPrice 도달 검사가 별도 존재).
 * UI 표시용 risk gauge.
 *
 * @param maintenanceMarginRate  기본 0.5% (Bybit isolated).
 */
export function computeMarginRatio(
  side: "long" | "short",
  size: number,
  entryPrice: number,
  currentPrice: number,
  marginUsed: number,
  maintenanceMarginRate: number = DEFAULT_MAINTENANCE_MARGIN_RATE,
): number {
  if (marginUsed <= 0) return Infinity;
  if (size <= 0 || currentPrice <= 0) return 0;
  const pnl = computeUnrealizedPnL(side, size, entryPrice, currentPrice);
  const currentMargin = marginUsed + pnl;
  const maintenanceMargin = size * currentPrice * maintenanceMarginRate;
  if (currentMargin <= 0) return Infinity; // 사실상 청산 상태
  return maintenanceMargin / currentMargin;
}

/**
 * Margin Ratio 색상 단계 (Tailwind class 반환).
 *
 *   < 0.5 : muted (안전)
 *   0.5~0.8: yellow (경고)
 *   0.8~1.0: red (위험)
 *   >= 1.0  : red bold (청산 임계)
 *   Infinity: muted (계산 불가 / 청산 후)
 */
export function getMarginRatioColor(ratio: number): string {
  if (!isFinite(ratio)) return "text-muted-foreground";
  if (ratio >= 0.8) return "text-neon-red font-bold";
  if (ratio >= 0.5) return "text-neon-yellow";
  return "text-muted-foreground";
}

/**
 * 손익에 거래 수수료 + 펀딩비를 반영한 순손익.
 *
 *   netPnL = unrealizedPnL - exitCommission - accruedFunding
 *
 * 본 함수는 close 시점에 호출 (open 시 commission 은 별도 차감).
 *
 * @param unrealizedPnL  exit price 기반 가격 손익
 * @param exitCommission  exit 거래 수수료 (positive)
 * @param accruedFunding  누적 펀딩비 (LONG 이 funding payer 일 때 positive)
 */
export function computeNetPnL(
  unrealizedPnL: number,
  exitCommission: number,
  accruedFunding: number,
): number {
  return unrealizedPnL - exitCommission - accruedFunding;
}

/**
 * Close 시 cash 환원량 (음수 차단).
 *
 *   cashReturned = max(0, marginUsed + netPnL)
 *
 * 손실이 margin 을 초과해도 cash 가 음수가 되지 않도록 clamp.
 * (현실: Bybit 도 isolated 에서 margin 이상 잃지 않음 — auto-deleverage 발동).
 *
 * INVESTMENT_SIMULATOR_AUDIT.md §1.7 핵심 공식.
 */
export function computeCashReturned(
  marginUsed: number,
  netPnL: number,
): number {
  return Math.max(0, marginUsed + netPnL);
}

/**
 * Slippage rate — Market 진입 시 사용자에게 불리한 방향으로 적용되는 비율.
 *
 * 0.1% — 대형 거래소 (Bybit / Binance) 의 평균 market spread 와 비슷.
 * INVESTMENT_SIMULATOR_AUDIT.md Phase 3 #9 기본값.
 */
export const SLIPPAGE_PCT = 0.001;

// ─── Simulator Stats (Phase 4 #16 일부) ────────────────────
//
// 사용자가 자신의 시뮬레이터 트레이딩 실적을 한눈에 볼 수 있는 핵심 메트릭.
// 백테스트 결과 (/backtest 페이지) 와 비교를 위한 첫 단계 — 본 모듈은
// closed positions 에서 winRate / avgWin / avgLoss / Expectancy / MaxDD 만 계산.
//
// 한계:
//   - 백테스트 데이터 fetch X (별도 세션). UI 안내만 "정확한 비교는 /backtest 페이지에서".
//   - MaxDD 는 closed 포지션 시퀀스만 사용 (실시간 unrealized 변동은 미반영).
//   - Sharpe 는 본 단계에서 제외 (return 분산 계산 복잡성 + 짧은 sample 신뢰성 낮음).

/**
 * Simulator 실적 통계 (closed positions 만 집계).
 *
 * 모든 metric 은 가상 자본 단위 (USD).  비율 metric (winRate, totalPnlPct,
 * maxDrawdownPct) 은 0~1 또는 음수 가능 (예: -0.25 = -25%).
 */
export interface SimulatorStats {
  /** 청산 포함 모든 closed position 수 */
  totalTrades: number;
  /** closedPnl > 0 인 포지션 수 */
  wins: number;
  /** closedPnl < 0 인 포지션 수 (강제청산 포함) */
  losses: number;
  /** wins / totalTrades. totalTrades=0 면 0. */
  winRate: number;
  /** 승리 거래의 평균 PnL (USD). 없으면 0. */
  avgWin: number;
  /** 패배 거래의 평균 PnL (USD, negative). 없으면 0. */
  avgLoss: number;
  /**
   * 기대값 — 거래당 평균 손익 예상.
   *   expectancy = winRate × avgWin + (1 - winRate) × avgLoss
   * 양수면 long-run 에서 이익.
   */
  expectancy: number;
  /** 최대 누적 손실 폭 (USD, 양수). closed PnL 시퀀스의 peak-to-trough. */
  maxDrawdown: number;
  /** maxDrawdown / peakEquity (peak 시점 자본 대비). 0~1. */
  maxDrawdownPct: number;
  /** 모든 closedPnl 의 합 (USD). */
  totalPnl: number;
  /** totalPnl / initialCash. initial=200_000 기준. */
  totalPnlPct: number;
}

/**
 * 빈 stats — closed positions 가 없거나 simUserId 없을 때 반환.
 */
export function emptySimulatorStats(): SimulatorStats {
  return {
    totalTrades: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    avgWin: 0,
    avgLoss: 0,
    expectancy: 0,
    maxDrawdown: 0,
    maxDrawdownPct: 0,
    totalPnl: 0,
    totalPnlPct: 0,
  };
}

/**
 * Closed positions 의 시퀀스에서 maximum drawdown 계산.
 *
 * 알고리즘:
 *   1. closedAt 오름차순 정렬
 *   2. running equity (initial + cumulative PnL) 추적
 *   3. peak (지금까지 최댓값) 갱신
 *   4. (peak - currentEquity) 의 최댓값 = maxDrawdown
 *
 * 한계: 실시간 unrealized 변동은 반영 X (Phase 4 후속에서 transaction 시계열 활용).
 *
 * @param closedPnls  closedAt 시간순으로 배열한 PnL 값들
 * @param initialCash  시작 자본 ($200,000)
 */
export function computeMaxDrawdown(
  closedPnls: number[],
  initialCash: number,
): { maxDrawdown: number; maxDrawdownPct: number } {
  if (closedPnls.length === 0) {
    return { maxDrawdown: 0, maxDrawdownPct: 0 };
  }
  let equity = initialCash;
  let peak = initialCash;
  let maxDD = 0;
  let maxDDPct = 0;
  for (const pnl of closedPnls) {
    equity += pnl;
    if (equity > peak) {
      peak = equity;
    }
    const dd = peak - equity;
    if (dd > maxDD) {
      maxDD = dd;
      maxDDPct = peak > 0 ? dd / peak : 0;
    }
  }
  return { maxDrawdown: maxDD, maxDrawdownPct: maxDDPct };
}

/**
 * Closed positions 에서 SimulatorStats 집계.
 *
 * 입력은 LocalSimPosition[] 의 closed 만 필터한 array. 본 함수는 store 와
 * 무관한 순수 함수 — UI / 테스트에서 가벼운 입력으로 호출 가능.
 *
 * closedAt 은 `string | Date | null` 모두 허용 — 로컬 store (string ISO) 와
 * tRPC 백엔드 (superjson 으로 Date 직렬화) 양쪽 입력에 동일하게 작동.
 *
 * @param closedPositions  status !== "open" 인 포지션 (closedPnl 필요)
 * @param initialCash  시작 자본 ($200,000)
 */
export function computeSimulatorStats(
  closedPositions: Array<{
    closedPnl: number | null;
    closedAt: string | Date | null;
  }>,
  initialCash: number,
): SimulatorStats {
  if (closedPositions.length === 0) return emptySimulatorStats();

  // closedAt 순서대로 정렬 — null 은 0 ms 로 (정렬 안정성 보장).
  const toMs = (d: string | Date | null | undefined): number => {
    if (!d) return 0;
    if (d instanceof Date) return d.getTime();
    return new Date(d).getTime();
  };
  const sorted = [...closedPositions]
    .filter((p) => typeof p.closedPnl === "number")
    .sort((a, b) => toMs(a.closedAt) - toMs(b.closedAt));

  const closedPnls = sorted.map((p) => p.closedPnl ?? 0);
  const wins = closedPnls.filter((v) => v > 0);
  const losses = closedPnls.filter((v) => v < 0);

  const totalTrades = closedPnls.length;
  const winCount = wins.length;
  const lossCount = losses.length;
  const winRate = totalTrades > 0 ? winCount / totalTrades : 0;

  const avgWin =
    winCount > 0 ? wins.reduce((s, v) => s + v, 0) / winCount : 0;
  const avgLoss =
    lossCount > 0 ? losses.reduce((s, v) => s + v, 0) / lossCount : 0;
  const expectancy = winRate * avgWin + (1 - winRate) * avgLoss;

  const totalPnl = closedPnls.reduce((s, v) => s + v, 0);
  const totalPnlPct = initialCash > 0 ? totalPnl / initialCash : 0;

  const { maxDrawdown, maxDrawdownPct } = computeMaxDrawdown(
    closedPnls,
    initialCash,
  );

  return {
    totalTrades,
    wins: winCount,
    losses: lossCount,
    winRate,
    avgWin,
    avgLoss,
    expectancy,
    maxDrawdown,
    maxDrawdownPct,
    totalPnl,
    totalPnlPct,
  };
}

/**
 * Market 진입 가격에 slippage 적용 (LIMIT 주문에는 적용 X).
 *
 *   LONG : 매수 → 시장이 사는 사람 불리하게 → 체결가 ↑
 *   SHORT: 매도 → 시장이 파는 사람 불리하게 → 체결가 ↓
 *
 * 예시 (BTC LONG, mark $80,000, slippage 0.1%):
 *   actualEntry = 80000 × (1 + 0.001) = $80,080
 *
 * Phase 3 #9: 실거래 정확도 향상. PnL 자동으로 영향 받음 (entryPrice 가 적용 후 값).
 */
export function applySlippage(
  price: number,
  side: "long" | "short",
  rate: number = SLIPPAGE_PCT,
): number {
  if (price <= 0) return price;
  const direction = side === "long" ? 1 : -1;
  return price * (1 + rate * direction);
}
