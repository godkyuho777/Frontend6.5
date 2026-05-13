/**
 * 전인구 시그널 — 트래커 페이지 (Phase 6 placeholder).
 *
 * 명세: JEON_IN_GU_SIGNAL_TRACKER §3.6 + TRACKER_TAB_STANDARD §1.3.
 * Phase 6 UI 만 구현 (Phases 1.3~5 backend pending). 모든 탭은 Phase pending
 * 안내 카드와 함께 표준 5 탭 레이아웃 적용.
 *
 * 활성 조건 (모두 충족 필요):
 *   - YOUTUBE_API_KEY · ANTHROPIC_API_KEY · JEON_IN_GU_CHANNEL_ID
 *   - 변호사 검토 (명예훼손 위험)
 *   - SCHEDULE_DEFERRED.md D-002 항목.
 *
 * 가중치 ±0.50 = BBDX 100점 시스템에 최대 ±50점 영향 (매우 높음).
 * Phase 5 calibration 미완 시 fallback 0.20 자동 적용.
 */

import { TrackerTabs } from "@/components/trackers/TrackerTabs";
import { BacktestTab } from "./tabs/BacktestTab";
import { ChartTab } from "./tabs/ChartTab";
import { CriteriaTab } from "./tabs/CriteriaTab";
import { HistoryTab } from "./tabs/HistoryTab";
import { SignalTab } from "./tabs/SignalTab";
import { PhaseStatusBadge } from "./components/PhaseStatusBadge";

export default function JeonInGuTrackerPage() {
  return (
    <TrackerTabs
      trackerName="전인구 시그널"
      trackerSubtitle="6차원 거시 / Contrarian Modifier (역지표)"
      defaultTab="signal"
      headerRight={<PhaseStatusBadge />}
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
