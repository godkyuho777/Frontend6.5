/**
 * Frontend-local mirror of `tradelab-backend/src/onchain/`.
 *
 * Mirrors v6.5 §3 onchain types so the OnchainPanel can render
 * without the backend git package being in sync.
 */

export type OnchainTier = "btc" | "eth" | "major_alt" | "small_alt";

export type OnchainRegime =
  | "strong_accumulation"
  | "accumulation"
  | "neutral"
  | "distribution"
  | "strong_distribution";

export const ONCHAIN_MULTIPLIERS: Record<OnchainRegime, number> = {
  strong_accumulation: 1.3,
  accumulation: 1.15,
  neutral: 1.0,
  distribution: 0.85,
  strong_distribution: 0.7,
};

export const ONCHAIN_REGIME_LABELS: Record<OnchainRegime, string> = {
  strong_accumulation: "강한 매집",
  accumulation: "매집",
  neutral: "중립",
  distribution: "분배",
  strong_distribution: "강한 분배",
};

export interface OnchainBreakdown {
  netflow: number;
  whale: number;
  ssr: number;
  coinbasePremium: number;
  etfFlow: number;
  minerOutflow: number;
  lthSupply: number;
}

export interface OnchainScoreResult {
  symbol: string;
  tier: OnchainTier;
  score: number;
  regime: OnchainRegime;
  mult: number;
  breakdown: OnchainBreakdown;
  enabledModifiers: readonly string[];
}

/**
 * Tier coverage label for FE display — pairs with backend's
 * `tierCoverageLabel`. Re-mirrored locally to avoid an import cycle
 * during the package-drift period.
 */
export function tierCoverageLabel(tier: OnchainTier): string {
  switch (tier) {
    case "btc":
      return "7 modifiers (full coverage)";
    case "eth":
      return "6 modifiers (no miner outflow)";
    case "major_alt":
      return "4 modifiers (CEX flows only)";
    case "small_alt":
      return "2 modifiers (data sparse — Netflow + Whale only)";
  }
}
