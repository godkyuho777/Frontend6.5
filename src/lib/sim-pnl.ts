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
