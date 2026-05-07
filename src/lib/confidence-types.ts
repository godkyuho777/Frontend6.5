/**
 * Frontend-local mirror of the v6.5 confidence orchestrator output.
 *
 * Used by `ConfidenceBreakdown.tsx` and signal cards.
 */

import type { MacroRegime } from "./macro-types";
import type { OnchainRegime } from "./onchain-types";

export type SizeFactor = "reject" | "small" | "normal";

export const SIZE_FACTOR_LABELS: Record<SizeFactor, string> = {
  reject: "진입 거부",
  small: "축소 (1%)",
  normal: "표준 (5% 한도)",
};

export type RegimeBlockReason =
  | "MACRO_CRISIS_BLOCK"
  | "MACRO_TIGHT_BLOCK"
  | "ONCHAIN_STRONG_DISTRIBUTION_BLOCK";

export const BLOCK_REASON_LABELS: Record<RegimeBlockReason, string> = {
  MACRO_CRISIS_BLOCK: "거시 위기 — 모든 LONG 차단",
  MACRO_TIGHT_BLOCK: "거시 긴축 — 평균회귀 경로 차단",
  ONCHAIN_STRONG_DISTRIBUTION_BLOCK: "온체인 강한 분배 — 평균회귀 경로 차단",
};

export interface ConfidenceBreakdown {
  base: number;
  confluence: number;
  wave: number;
  macro: number;
  onchain: number;
  raw: number;
}

export interface ConfidenceDecision {
  blocked: boolean;
  blockReason?: { reason: RegimeBlockReason; message: string };
  finalConfidence: number;
  sizeFactor: SizeFactor;
  breakdown: ConfidenceBreakdown;
  macroRegime: MacroRegime;
  onchainRegime: OnchainRegime;
}
