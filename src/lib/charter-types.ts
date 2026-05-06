/**
 * Frontend-local copies of the Charter validator's result shape.
 *
 * The backend defines the source of truth in `tradelab-backend/src/charter/`.
 * These types mirror that shape so signal cards can display validation
 * outcomes without each FE component having to import the full backend
 * package. Keep these aligned when the backend module changes.
 */

export const CHARTER_DIMENSIONS = [
  "momentum",
  "volatility",
  "trend",
  "volume",
  "structure",
  "macro",
  "onchain",
] as const;

export type CharterDimension = (typeof CHARTER_DIMENSIONS)[number];

/** Korean labels matching backend DIMENSION_META.ko. */
export const CHARTER_DIMENSION_LABELS: Record<CharterDimension, string> = {
  momentum: "모멘텀",
  volatility: "변동성",
  trend: "추세",
  volume: "거래량",
  structure: "시장 구조",
  macro: "거시",
  onchain: "온체인",
};

export type CharterRuleId = 1 | 2 | 3;

export type CharterViolationSeverity = "blocking" | "critical" | "warning";

export interface CharterViolation {
  rule: CharterRuleId;
  severity: CharterViolationSeverity;
  message: string;
  context?: Record<string, unknown>;
}

export interface CharterMissingDimension {
  dimension: CharterDimension;
  ko: string;
  suggested: readonly string[];
}

export interface CharterValidationResult {
  passed: boolean;
  charterVersion: string;
  strategy: string;
  dimensionsCovered: Record<CharterDimension, string[]>;
  missingDimensions: CharterMissingDimension[];
  violations: CharterViolation[];
  coverage: { covered: number; total: number };
}
