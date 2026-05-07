/**
 * Frontend-local mirror of `tradelab-backend/src/macro/`.
 *
 * Mirrors the v6.5 §2 macro liquidity result shape so signal cards
 * and the macro panel can render without depending on the full
 * backend git package. Replace with imports when the package bumps.
 */

export type MacroRegime = "crisis" | "tight" | "neutral" | "easy" | "flooded";

export const MACRO_MULTIPLIERS: Record<MacroRegime, number> = {
  crisis: 0.3,
  tight: 0.65,
  neutral: 1.0,
  easy: 1.2,
  flooded: 1.4,
};

/** Korean labels matching backend regime descriptions. */
export const MACRO_REGIME_LABELS: Record<MacroRegime, string> = {
  crisis: "위기",
  tight: "긴축",
  neutral: "중립",
  easy: "완화",
  flooded: "넘침",
};

export interface MacroBreakdown {
  spread: number;
  rrp: number;
  tga: number;
  fedBalance: number;
  realRate: number;
}

export interface MacroLiquidityResult {
  /** [-100, +100] composite. */
  score: number;
  regime: MacroRegime;
  mult: number;
  breakdown: MacroBreakdown;
  missingInputs: string[];
}

export interface KoreaMacroResult {
  /** ±0.05 modifier on the macro multiplier. */
  modifier: number;
  reasons: string[];
  missingInputs: string[];
}
