/**
 * TrackerTabs — 모든 시그널 트래커가 공유하는 5 탭 표준 컴포넌트.
 *
 * 명세: TRACKER_TAB_STANDARD §1 (가로 탭 + URL ?tab=... 동기화 + 모바일
 * 가로 스크롤). 본 프로젝트는 wouter 라우터를 사용하므로 명세의
 * next/router 코드는 useLocation + useSearch 로 치환.
 *
 * 사용 예시:
 *   <TrackerTabs trackerName="전인구 시그널" defaultTab="signal">
 *     {(activeTab) => activeTab === "criteria" ? <CriteriaTab /> : ...}
 *   </TrackerTabs>
 *
 * 5 탭 표준 (id 순서):
 *   1. criteria  — 매매기준 (LONG/SHORT 룰 · 가중치 · 임계 · 헌장 통과)
 *   2. signal    — 실시간 신호 (PrimarySignalCard · Breakdown · Modifiers)
 *   3. chart     — 차트 (TF 선택 · 메인 차트 · legend · 분석)
 *   4. backtest  — 백테스트 (메트릭 · 누적 수익 · calibration history)
 *   5. history   — 히스토리 (filter · Timeline · pagination)
 */

import type { LucideIcon } from "lucide-react";
import { BarChart3, Bell, ClipboardList, FlaskConical, History } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { cn } from "@/lib/utils";

export interface TrackerTab {
  id: TrackerTabId;
  label: string;
  icon: LucideIcon;
  badge?: string | number;
}

export const STANDARD_TABS = [
  { id: "criteria", label: "매매기준", icon: ClipboardList },
  { id: "signal", label: "실시간 신호", icon: Bell },
  { id: "chart", label: "차트", icon: BarChart3 },
  { id: "backtest", label: "백테스트", icon: FlaskConical },
  { id: "history", label: "히스토리", icon: History },
] as const satisfies ReadonlyArray<{
  id: string;
  label: string;
  icon: LucideIcon;
}>;

export type TrackerTabId = (typeof STANDARD_TABS)[number]["id"];

const VALID_TAB_IDS = STANDARD_TABS.map((t) => t.id) as readonly TrackerTabId[];

function isValidTabId(value: string | null | undefined): value is TrackerTabId {
  return value != null && (VALID_TAB_IDS as readonly string[]).includes(value);
}

interface TrackerTabsProps {
  trackerName: string;
  trackerSubtitle?: string;
  tabs?: ReadonlyArray<TrackerTab>;
  defaultTab?: TrackerTabId;
  children: (activeTab: TrackerTabId) => React.ReactNode;
  /** 헤더 우측 슬롯 (예: 실시간 상태 인디케이터). */
  headerRight?: React.ReactNode;
}

/**
 * TrackerTabs — 트래커 공통 5 탭 wrapper.
 * URL `?tab=criteria` 로 동기화하여 탭 별 공유/즐겨찾기 가능.
 */
export function TrackerTabs({
  trackerName,
  trackerSubtitle,
  tabs = STANDARD_TABS,
  defaultTab = "signal",
  children,
  headerRight,
}: TrackerTabsProps) {
  const [location, setLocation] = useLocation();
  const searchString = useSearch();

  // URL `?tab=...` 우선, 없으면 defaultTab.
  const initialActive = useMemo<TrackerTabId>(() => {
    const params = new URLSearchParams(searchString);
    const fromUrl = params.get("tab");
    return isValidTabId(fromUrl) ? fromUrl : defaultTab;
  }, [searchString, defaultTab]);

  const [active, setActive] = useState<TrackerTabId>(initialActive);

  // URL 변경 시 (뒤로가기 등) 내부 state 동기화.
  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const fromUrl = params.get("tab");
    if (isValidTabId(fromUrl) && fromUrl !== active) {
      setActive(fromUrl);
    }
    // active 가 변경되는 useEffect 에서 URL push 하므로 dep 에 active 포함 X.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchString]);

  // 탭 클릭 시 URL 갱신 (location 은 path 부분만, search 만 교체).
  const handleSelect = (id: TrackerTabId) => {
    setActive(id);
    const params = new URLSearchParams(searchString);
    params.set("tab", id);
    setLocation(`${location}?${params.toString()}`, { replace: false });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-wider text-neon-pink glow-pink">
            {trackerName}
          </h1>
          {trackerSubtitle && (
            <p className="font-mono text-xs text-muted-foreground mt-1 uppercase tracking-wider">
              {trackerSubtitle}
            </p>
          )}
        </div>
        {headerRight}
      </div>

      {/* Tabs header — 모바일 가로 스크롤 */}
      <div className="border-b border-border/40 overflow-x-auto scrollbar-thin">
        <div className="flex items-center gap-1 min-w-fit px-1">
          {tabs.map((tab) => {
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
                  "font-mono text-xs uppercase tracking-wider whitespace-nowrap",
                  "border-b-2 transition-all duration-200",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-neon-pink/40",
                  isActive
                    ? "text-neon-pink border-neon-pink"
                    : "text-muted-foreground border-transparent hover:text-neon-cyan hover:border-neon-cyan/30"
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.label}</span>
                {tab.badge !== undefined && (
                  <span
                    className={cn(
                      "ml-1 inline-flex items-center justify-center rounded-full px-1.5 py-0.5",
                      "text-[10px] font-bold leading-none",
                      isActive
                        ? "bg-neon-pink text-background"
                        : "bg-neon-cyan/20 text-neon-cyan"
                    )}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div className="min-h-[400px]">{children(active)}</div>
    </div>
  );
}
