/**
 * EMA + ADX 정배열 추세 — 트래커 페이지.
 *
 * 사용자 요청 (2026-05-11): Wave Tracker 의 Trend Analysis 와 구분되는
 * standalone Signal Scanner 전략. UI 는 전인구 시그널의 TRACKER_TAB_STANDARD
 * 5 탭 패턴을 따름. 백엔드 trpc.emaAdxTrend.* 라우터 사용.
 *
 * 사용 보조지표 (주):
 *   - EMA 9/21/50 정배열 / 역배열
 *   - ADX(14) + ±DI
 *   - SMA(50) slope
 *   - HH/HL 가격 구조
 */

import { TrackerTabs } from "@/components/trackers/TrackerTabs";
import { BacktestTab } from "./tabs/BacktestTab";
import { ChartTab } from "./tabs/ChartTab";
import { CriteriaTab } from "./tabs/CriteriaTab";
import { HistoryTab } from "./tabs/HistoryTab";
import { SignalTab } from "./tabs/SignalTab";

export default function EmaAdxTrendTrackerPage() {
  return (
    <TrackerTabs
      trackerName="EMA + ADX 정배열"
      trackerSubtitle="EMA 9/21/50 정배열 + ADX·±DI + SMA·HH/HL · LONG/SHORT 양방향"
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
