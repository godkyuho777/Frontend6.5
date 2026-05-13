/**
 * Fibonacci & Trendline — 5-탭 wrapper (TRACKER_TAB_STANDARD §1.3 적용).
 *
 * 기존 Fibonacci.tsx 페이지는 그대로 유지 + SignalTab 안에 직접 import 하여 재사용.
 * 다른 4 탭 (매매기준 / 차트 / 백테스트 / 히스토리) 은 placeholder + 정적 룰.
 *
 * 사용자 URL `/fibonacci?tab=criteria|signal|chart|backtest|history` 로 진입 가능.
 * defaultTab=signal — 사용자가 가장 자주 보는 코인 리스트 스캐너.
 */

import { TrackerTabs } from "@/components/trackers/TrackerTabs";
import { BacktestTab } from "./tabs/BacktestTab";
import { ChartTab } from "./tabs/ChartTab";
import { CriteriaTab } from "./tabs/CriteriaTab";
import { HistoryTab } from "./tabs/HistoryTab";
import { SignalTab } from "./tabs/SignalTab";

export default function FibonacciTrackerPage() {
  return (
    <TrackerTabs
      trackerName="Fibonacci & Trendline"
      trackerSubtitle="시장 구조 차원 — Fib retracement + 자동 추세선"
      defaultTab="signal"
    >
      {(activeTab) => {
        switch (activeTab) {
          case "criteria":
            return <CriteriaTab />;
          case "signal":
            return <SignalTab />;
          case "chart":
            return <ChartTab />;
          case "backtest":
            return <BacktestTab />;
          case "history":
            return <HistoryTab />;
          default:
            return null;
        }
      }}
    </TrackerTabs>
  );
}
