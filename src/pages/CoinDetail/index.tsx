/**
 * CoinDetail — 코인 상세 페이지 (6-탭 TrackerTabs 구조).
 *
 * 명세: TRACKER_TAB_STANDARD §1 (TrackerTabs 가로 탭 + URL ?tab=... 동기화).
 * 본 페이지는 STANDARD_TABS 의 5 탭 + "코인 정보" 1 탭 = 총 6 탭.
 *
 * 탭 구조:
 *   1. info     — 코인 정보 (CoinMarketCap 스타일, 트래커 무관)
 *   2. criteria — 매매기준 (트래커별 다른 룰)
 *   3. signal   — 실시간 신호 (트래커별 다른 패널)
 *   4. chart    — 차트 (트래커별 다른 인디케이터)
 *   5. backtest — 백테스트 (트래커별 다른 전략)
 *   6. history  — 히스토리 (signal history 누적, 트래커 무관)
 *
 * URL 호환 — 기존 `/coin/:symbol` 경로 그대로 유지. `?tab=info` / `?tracker=...` 로 진입 가능.
 *
 * 트래커 컨텍스트 (사용자 요구, 2026-05-13):
 *   - tracker=bbdx       (default) — RSI+BB+ADX
 *   - tracker=fibonacci  — Fibonacci & Trendline
 *   - tracker=vwap       — VWAP + EMA(9)
 */

import { BarChart3, Bell, ClipboardList, FlaskConical, History, Info, TrendingUp } from "lucide-react";
import { useLocation, useParams, useSearch } from "wouter";
import { TrackerTabs, type TrackerTab } from "@/components/trackers/TrackerTabs";
import { CoinInfoTab } from "./tabs/v2/CoinInfoTab";
import { CoinValuationTab } from "./tabs/v2/CoinValuationTab";
import { CoinCriteriaTab } from "./tabs/v2/CoinCriteriaTab";
import { CoinSignalTab } from "./tabs/v2/CoinSignalTab";
import { CoinChartTab } from "./tabs/v2/CoinChartTab";
import { CoinBacktestTab } from "./tabs/v2/CoinBacktestTab";
import { CoinHistoryTab } from "./tabs/v2/CoinHistoryTab";
import {
  parseTrackerParam,
  TRACKER_NAMES,
  TRACKER_VALUES,
  type TrackerContext,
} from "./tracker-context";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// 6 탭 정의 (STANDARD_TABS 확장 — "info" 탭이 맨 앞에 추가됨).
const COIN_DETAIL_TABS: ReadonlyArray<TrackerTab> = [
  { id: "info", label: "코인 정보", icon: Info },
  { id: "valuation", label: "밸류에이션", icon: TrendingUp },
  { id: "criteria", label: "매매기준", icon: ClipboardList },
  { id: "signal", label: "실시간 신호", icon: Bell },
  { id: "chart", label: "차트", icon: BarChart3 },
  { id: "backtest", label: "백테스트", icon: FlaskConical },
  { id: "history", label: "히스토리", icon: History },
];

export default function CoinDetailPage() {
  const params = useParams<{ symbol: string }>();
  const symbol = params.symbol ?? "";
  const search = useSearch();
  const [location, setLocation] = useLocation();

  if (!symbol) {
    return (
      <div className="text-center py-20 font-mono text-muted-foreground">
        심볼이 지정되지 않았습니다.
      </div>
    );
  }

  // URL `?tracker=...` 파싱 — 미지정 시 bbdx default.
  const urlParams = new URLSearchParams(search);
  const tracker: TrackerContext = parseTrackerParam(urlParams.get("tracker"));

  const baseSymbol = symbol.replace(/USDT$/, "");

  // 트래커 변경 핸들러 — URL 의 ?tracker=... 만 교체, 다른 param (tab, tf) 유지.
  const handleTrackerChange = (next: string) => {
    const params = new URLSearchParams(search);
    params.set("tracker", next);
    // path 부분 (`/coin/BTCUSDT`) 는 useLocation 의 location 으로 유지.
    setLocation(`${location}?${params.toString()}`, { replace: false });
  };

  return (
    <TrackerTabs
      trackerName={`${baseSymbol} / USDT — ${TRACKER_NAMES[tracker]}`}
      trackerSubtitle={`코인 상세 정보 + Tradelab ${TRACKER_NAMES[tracker]} 시그널`}
      defaultTab="signal"
      tabs={COIN_DETAIL_TABS}
      headerRight={
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
            트래커
          </span>
          <Select value={tracker} onValueChange={handleTrackerChange}>
            <SelectTrigger className="h-8 w-[200px] font-mono text-xs border-neon-pink/40 bg-card/60">
              <SelectValue placeholder="트래커 선택" />
            </SelectTrigger>
            <SelectContent>
              {TRACKER_VALUES.filter((v) => v !== "jeon-in-gu").map((v) => (
                <SelectItem key={v} value={v} className="font-mono text-xs">
                  {TRACKER_NAMES[v]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      }
    >
      {(activeTab) => {
        switch (activeTab) {
          case "info":
            return <CoinInfoTab symbol={symbol} />;
          case "valuation":
            return <CoinValuationTab symbol={symbol} />;
          case "criteria":
            return <CoinCriteriaTab symbol={symbol} tracker={tracker} />;
          case "signal":
            return <CoinSignalTab symbol={symbol} tracker={tracker} />;
          case "chart":
            return <CoinChartTab symbol={symbol} tracker={tracker} />;
          case "backtest":
            return <CoinBacktestTab symbol={symbol} tracker={tracker} />;
          case "history":
            return <CoinHistoryTab symbol={symbol} />;
          default:
            return null;
        }
      }}
    </TrackerTabs>
  );
}
