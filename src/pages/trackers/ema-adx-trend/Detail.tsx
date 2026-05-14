/**
 * EMA + ADX 정배열 추세 — 코인 상세 페이지 (6 탭).
 *
 * URL: /trackers/ema-adx-trend/:symbol?tf=4h
 *
 * 6 탭 구성:
 *   1. 매매기준 (criteria)
 *   2. 실시간 신호 (signal) — 해당 코인 1개
 *   3. 차트 (chart) — 해당 코인 1개
 *   4. 백테스트 (backtest)
 *   5. 히스토리 (history)
 *   6. 코인 정보 (coin-info) — 사용자 요청 신규 (2026-05-11)
 *
 * TRACKER_TAB_STANDARD 5탭 + 신규 6번째 탭. 본 트래커는 표준 컴포넌트
 * (`TrackerTabs`) 와 별도의 local wrapper 를 사용 — 다른 세션 충돌 회피 +
 * 6번째 탭 자유 추가를 위해.
 */

import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams, useSearch } from "wouter";
import {
  ArrowLeft,
  BarChart3,
  Bell,
  ClipboardList,
  FlaskConical,
  History,
  Info,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

import { CriteriaTab } from "./tabs/CriteriaTab";
import { SignalTab } from "./tabs/SignalTab";
import { ChartTab } from "./tabs/ChartTab";
import { BacktestTab } from "./tabs/BacktestTab";
import { HistoryTab } from "./tabs/HistoryTab";
import { CoinInfoTab } from "./tabs/CoinInfoTab";

type TabId =
  | "criteria"
  | "signal"
  | "chart"
  | "backtest"
  | "history"
  | "coin-info";

interface TabSpec {
  id: TabId;
  label: string;
  icon: LucideIcon;
}

// 5 표준 탭 + 6번째 코인 정보. defaultTab = "signal".
const TABS: TabSpec[] = [
  { id: "criteria", label: "매매기준", icon: ClipboardList },
  { id: "signal", label: "실시간 신호", icon: Bell },
  { id: "chart", label: "차트", icon: BarChart3 },
  { id: "backtest", label: "백테스트", icon: FlaskConical },
  { id: "history", label: "히스토리", icon: History },
  { id: "coin-info", label: "코인 정보", icon: Info },
];

const VALID_IDS = TABS.map(t => t.id) as readonly TabId[];
function isValidTab(v: string | null | undefined): v is TabId {
  return v != null && (VALID_IDS as readonly string[]).includes(v);
}

export default function EmaAdxTrendDetailPage() {
  const params = useParams<{ symbol: string }>();
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const symbol = (params?.symbol ?? "").toUpperCase();

  // tf from URL (?tf=...)
  const tf = useMemo<"1h" | "4h" | "1d">(() => {
    const p = new URLSearchParams(searchString);
    const v = p.get("tf");
    if (v === "1h" || v === "4h" || v === "1d") return v;
    return "4h";
  }, [searchString]);

  // active tab from URL (?tab=...) — default signal
  const initialActive = useMemo<TabId>(() => {
    const p = new URLSearchParams(searchString);
    const v = p.get("tab");
    return isValidTab(v) ? v : "signal";
  }, [searchString]);

  const [active, setActive] = useState<TabId>(initialActive);

  useEffect(() => {
    const p = new URLSearchParams(searchString);
    const v = p.get("tab");
    if (isValidTab(v) && v !== active) setActive(v);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchString]);

  const handleSelect = (id: TabId) => {
    setActive(id);
    const p = new URLSearchParams(searchString);
    p.set("tab", id);
    if (tf) p.set("tf", tf);
    setLocation(`/trackers/ema-adx-trend/${symbol}?${p.toString()}`, {
      replace: false,
    });
  };

  if (!symbol) {
    return (
      <div className="p-6">
        <p className="font-mono text-sm text-muted-foreground">코인 미지정</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/trackers/ema-adx-trend")}
            className="font-mono text-xs"
            aria-label="목록으로"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            BACK
          </Button>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
              {symbol.replace("USDT", "")}
            </h1>
            <p className="font-mono text-xs text-muted-foreground mt-1">
              EMA + ADX 정배열 · {tf.toUpperCase()} · 6 탭 상세
            </p>
          </div>
        </div>
      </div>

      {/* Tabs strip */}
      <div className="border-b border-border/40 overflow-x-auto scrollbar-thin">
        <div className="flex items-center gap-1 min-w-fit px-1">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = active === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleSelect(tab.id)}
                aria-pressed={isActive}
                className={cn(
                  "relative inline-flex items-center gap-2 px-4 py-2.5",
                  "font-sans text-sm font-medium whitespace-nowrap",
                  "border-b-2 transition-all duration-200",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                  isActive
                    ? "text-foreground border-foreground"
                    : "text-muted-foreground border-transparent hover:text-foreground hover:border-border"
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div className="min-h-[400px]">
        {active === "criteria" && <CriteriaTab />}
        {active === "signal" && <SignalTab symbol={symbol} tf={tf} />}
        {active === "chart" && <ChartTab symbol={symbol} tf={tf} />}
        {active === "backtest" && <BacktestTab />}
        {active === "history" && <HistoryTab />}
        {active === "coin-info" && <CoinInfoTab symbol={symbol} />}
      </div>
    </div>
  );
}
