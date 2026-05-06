/**
 * Frontend-local copies of the v6.3 EXIT decision shape.
 *
 * Mirrors `tradelab-backend/src/shared/types.ts` — keep in sync when
 * the backend changes. These types let signal cards render the
 * v6.3 category/action without depending on the full backend package.
 */

export type ExitCategory = "A" | "B" | "C" | "D" | "STOP";
export type ExitAction = "full_exit" | "partial_exit" | "move_stop";

export interface ReversalScoreBreakdown {
  diCross: number;
  adxConfirmation: number;
  bearishPattern: number;
  trendlineBreak: number;
  macdDivergence: number;
  total: number;
}

export interface ExitDecisionV63 {
  category: ExitCategory;
  action: ExitAction;
  ratio: number;
  reasons: string[];
  reversalScore?: number;
  reversalBreakdown?: ReversalScoreBreakdown;

  // Legacy v6.1 fields kept for backward compat.
  conditionsMet: number;
  total: 4;
  relaxedToBearish: boolean;
  triggers: ("bbMiddle" | "rsi65" | "adx30" | "plusDi25")[];
}

/** Human-readable category labels. */
export const EXIT_CATEGORY_LABEL: Record<ExitCategory, string> = {
  A: "목표",
  B: "반전",
  C: "보호",
  D: "시간",
  STOP: "손절",
};

/** Long-form English label for tooltips. */
export const EXIT_CATEGORY_DESCRIPTION: Record<ExitCategory, string> = {
  A: "Profit target — partial exit on BB-middle / Fib levels",
  B: "Reversal — DI cross + bearish patterns",
  C: "Protection — trailing or breakeven stop move",
  D: "Time stop — capital turnover after stagnation",
  STOP: "Stop loss — capital protection trigger",
};
