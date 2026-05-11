/**
 * Macro Layer v2 + Dual Backtest Engine 프론트엔드 미러 타입.
 *
 * 백엔드 `src/backtest/timeline-types.ts` (MacroLayer) 와
 * `src/backtest/engines/{single-indicator,multi-strategy}.ts` 의 형상을
 * 그대로 재선언. 백엔드 types-entry 가 아직 본 타입들을 export 하지 않아
 * 프론트가 deep-path 우회 대신 자체 정의를 둔다.
 *
 * 형상이 어긋나면 런타임에 데이터가 깨지므로, 백엔드 변경 시 본 파일을
 * 동기화해야 한다.
 */

export type CyclePhase =
  | "pre_recession"
  | "recession_imminent"
  | "fed_pivot"
  | "crypto_rally"
  | "neutral";

export type MacroRegime =
  | "crisis"
  | "tight"
  | "neutral"
  | "easing"
  | "flooded";

export interface MacroBreakdown {
  spread_score: number;
  yield_curve_score: number;
  walcl_score: number;
  rrp_tga_score: number;
  real_rate_score: number;
  dxy_score: number;
  vix_score: number;
  korea_score: number;
  c1_contribution: number;
  c2_contribution: number;
  c3_contribution: number;
  c4_contribution: number;
}

export interface MacroLayer {
  snapshot_ts: number;
  release_ts: number;
  age_hours: number;
  sofr_iorb_spread_bp: number;
  yield_curve_10_2: number;
  walcl_change_30d_pct: number;
  rrp_tga_change_30d_pct: number;
  real_rate: number;
  dxy_change_30d_pct: number;
  vix: number;
  c1_crisis: number;
  c2_riskOn: number;
  c3_net_liquidity_30d_pct: number;
  c4_cycle_phase: CyclePhase;
  bok_rate: number | null;
  bok_rate_change_90d: number | null;
  krw_usd: number | null;
  krw_change_30d_pct: number | null;
  score: number;
  regime: MacroRegime;
  multiplier: number;
  freshness_mult: number;
  breakdown: MacroBreakdown;
}

export interface FredObservation {
  date: string;
  value: number;
}

export type FredFetchStatus = "ok" | "stale" | "error" | "stub";

export type IndicatorLayer = "signal" | "wave" | "macro";

export type EntryConditionType =
  | "less_than"
  | "greater_than"
  | "between"
  | "crosses_below"
  | "crosses_above"
  | "equals";

export interface EntryCondition {
  type: EntryConditionType;
  threshold: number | [number, number] | string;
}

export interface ExitConditionParams {
  target_pct?: number;
  stop_pct?: number;
  max_bars?: number;
  indicator?: string;
  indicator_layer?: IndicatorLayer;
  indicator_threshold?: number;
  indicator_direction?: "greater_than" | "less_than";
}

export interface ExitCondition {
  type: "fixed_return" | "fixed_loss" | "time_stop" | "indicator_threshold";
  params: ExitConditionParams;
}

export interface SingleIndicatorConfig {
  indicator: string;
  layer: IndicatorLayer;
  entry_condition: EntryCondition;
  exit_condition: ExitCondition;
  symbol: string;
  tf: "4h" | "1d" | "1w";
  start_ms: number;
  end_ms: number;
  mode?: "realtime" | "historical";
  fee_pct?: number;
  slippage_pct?: number;
}

export interface SingleIndicatorTrade {
  entry_ts: number;
  entry_price: number;
  exit_ts: number;
  exit_price: number;
  return_pct: number;
  win: boolean;
  bars_held: number;
}

export interface ValueBucketStat {
  bucket: [number, number];
  n: number;
  wins: number;
  win_rate: number;
  ci: [number, number];
}

export type SampleSufficiency = "sufficient" | "marginal" | "insufficient";

export interface SingleIndicatorResult {
  config: SingleIndicatorConfig;
  total_signals: number;
  win_rate: number;
  ci: [number, number];
  avg_return_pct: number;
  mdd_pct: number;
  sharpe: number;
  trades: SingleIndicatorTrade[];
  by_value_bucket: ValueBucketStat[];
  alpha_significant: boolean;
  baseline_winrate: number;
  p_value: number;
  sample_sufficiency: SampleSufficiency;
}

export type ConditionOperator =
  | "lt"
  | "gt"
  | "between"
  | "crosses_below"
  | "crosses_above"
  | "eq";

export interface ConditionNode {
  type: "condition";
  indicator: string;
  operator: ConditionOperator;
  value: number | [number, number] | string;
  layer: IndicatorLayer;
}

export interface LogicNode {
  type: "logic";
  operator: "AND" | "OR" | "NOT";
  children: StrategyExpression[];
}

export interface WeightedNode {
  type: "weighted";
  weights: Array<{ weight: number; child: StrategyExpression }>;
  threshold: number;
}

export type StrategyExpression = ConditionNode | LogicNode | WeightedNode;

export type Dimension =
  | "momentum"
  | "volatility"
  | "trend"
  | "volume"
  | "structure"
  | "macro"
  | "onchain";

export interface CharterValidation {
  passed: boolean;
  covered: Dimension[];
  missing: Dimension[];
  warnings: string[];
}

export interface MultiStrategyConfig {
  expression: StrategyExpression;
  exit_condition: ExitCondition;
  symbol: string;
  tf: "4h" | "1d" | "1w";
  start_ms: number;
  end_ms: number;
  mode?: "realtime" | "historical";
  fee_pct?: number;
  slippage_pct?: number;
}

export type SingleIndicatorErrorResult = { status: "error"; detail: string };
