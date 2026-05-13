/**
 * CoinDetail — 코인 상세 페이지 (6-탭 TrackerTabs 구조).
 *
 * 명세: TRACKER_TAB_STANDARD §1 (TrackerTabs 가로 탭 + URL ?tab=... 동기화).
 * 본 페이지는 STANDARD_TABS 의 5 탭 + "코인 정보" 1 탭 = 총 6 탭.
 *
 * 탭 구조:
 *   1. info     — 코인 정보 (CoinMarketCap 스타일, NEW)
 *   2. criteria — 매매기준 (BBDX 정적 룰)
 *   3. signal   — 실시간 신호 (LONG/SHORT SignalCard + 7차원 breakdown)
 *   4. chart    — 차트 (BB + RSI + ADX/DI, full-size)
 *   5. backtest — 백테스트 (Rolling 승률 + 1년 백테스트)
 *   6. history  — 히스토리 (거래 기록 + 한국어 요약 + AI 분석)
 *
 * URL 호환 — 기존 `/coin/:symbol` 경로 그대로 유지. `?tab=info` 등으로 진입 가능.
 */

import { BarChart3, Bell, ClipboardList, FlaskConical, History, Info } from "lucide-react";
import { useParams } from "wouter";
import { TrackerTabs, type TrackerTab } from "@/components/trackers/TrackerTabs";
import { CoinInfoTab } from "./tabs/v2/CoinInfoTab";
import { CoinCriteriaTab } from "./tabs/v2/CoinCriteriaTab";
import { CoinSignalTab } from "./tabs/v2/CoinSignalTab";
import { CoinChartTab } from "./tabs/v2/CoinChartTab";
import { CoinBacktestTab } from "./tabs/v2/CoinBacktestTab";
import { CoinHistoryTab } from "./tabs/v2/CoinHistoryTab";

// 6 탭 정의 (STANDARD_TABS 확장 — "info" 탭이 맨 앞에 추가됨).
const COIN_DETAIL_TABS: ReadonlyArray<TrackerTab> = [
  { id: "info", label: "코인 정보", icon: Info },
  { id: "criteria", label: "매매기준", icon: ClipboardList },
  { id: "signal", label: "실시간 신호", icon: Bell },
  { id: "chart", label: "차트", icon: BarChart3 },
  { id: "backtest", label: "백테스트", icon: FlaskConical },
  { id: "history", label: "히스토리", icon: History },
];

export default function CoinDetailPage() {
  const params = useParams<{ symbol: string }>();
  const symbol = params.symbol ?? "";

  if (!symbol) {
    return (
      <div className="text-center py-20 font-mono text-muted-foreground">
        Symbol 이 지정되지 않았습니다.
      </div>
    );
  }

  const baseSymbol = symbol.replace(/USDT$/, "");

  return (
    <TrackerTabs
      trackerName={`${baseSymbol} / USDT`}
      trackerSubtitle="코인 상세 정보 + Tradelab BBDX 시그널"
      defaultTab="signal"
      tabs={COIN_DETAIL_TABS}
    >
      {(activeTab) => {
        switch (activeTab) {
          case "info":
            return <CoinInfoTab symbol={symbol} />;
          case "criteria":
            return <CoinCriteriaTab symbol={symbol} />;
          case "signal":
            return <CoinSignalTab symbol={symbol} />;
          case "chart":
            return <CoinChartTab symbol={symbol} />;
          case "backtest":
            return <CoinBacktestTab symbol={symbol} />;
          case "history":
            return <CoinHistoryTab symbol={symbol} />;
          default:
            return null;
        }
      }}
    </TrackerTabs>
  );
}
