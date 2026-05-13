/**
 * 5 표준 탭 컴포넌트 barrel — TRACKER_TAB_STANDARD §1.3.
 *
 * 각 트래커는 본 컴포넌트들을 props 로 데이터 주입하여 재사용.
 */

export { CriteriaTab } from "./CriteriaTab";
export type {
  CharterRow,
  CriteriaTabProps,
  WeightRow,
} from "./CriteriaTab";

export { SignalTab } from "./SignalTab";
export type {
  ActiveModifier,
  BreakdownItem,
  SignalSide,
  SignalSnapshot,
  SignalTabProps,
} from "./SignalTab";

export { ChartTab } from "./ChartTab";
export type {
  ChartTabProps,
  ChartTypeOption,
  LegendItem,
  TimeframeOption,
} from "./ChartTab";

export { BacktestTab } from "./BacktestTab";
export type {
  BacktestMetrics,
  BacktestTabProps,
  BaselineComparisonRow,
  CalibrationHistoryRow,
  CumulativeReturnPoint,
  ModifierImpactItem,
} from "./BacktestTab";

export { HistoryTab } from "./HistoryTab";
export type {
  HistoryCalibrationItem,
  HistoryEntryItem,
  HistoryExitItem,
  HistoryItem,
  HistoryItemType,
  HistorySourceItem,
  HistoryTabProps,
} from "./HistoryTab";
