/**
 * CoinSignalTab — 코인 상세 페이지의 "실시간 신호" 탭.
 *
 * 기존 CoinDetail Workstation 의 메인 콘텐츠 (SignalCard + ShortSignalCard +
 * CoinInfoCard + UpcomingEvents) + DimensionBreakdown + LiteModeTab + AIInsightTab
 * 통합. ChartZone 은 별도 "차트" 탭으로 분리됨.
 *
 * Layout (md+):
 *   ┌────────────────────────────────────┬────────────────────────┐
 *   │ SignalCard (LONG)                  │ CoinInfoCard           │
 *   │ ShortSignalCard (SHORT, v6.6)      │ UpcomingEvents         │
 *   │ DimensionBreakdown (7차원 chip)    │                        │
 *   └────────────────────────────────────┴────────────────────────┘
 */

import { useState } from "react";
import type { TimeframeValue } from "@shared/types";
import { TIMEFRAMES } from "@shared/types";
import { cn } from "@/lib/utils";
import { Clock } from "lucide-react";
import { SignalCard } from "../../panels/SignalCard";
import { ShortSignalCard } from "../../panels/ShortSignalCard";
import { CoinInfoCard } from "../../panels/CoinInfoCard";
import { UpcomingEvents } from "../../panels/UpcomingEvents";
import { DimensionBreakdown } from "../DimensionBreakdown";
import { useCoinSignal } from "../../hooks/useCoinSignal";
import { useCoinMeta } from "../../hooks/useCoinMeta";
import { useUpcomingEvents } from "../../hooks/useUpcomingEvents";
import { useVwapDetail } from "../../hooks/useVwapDetail";
import { useTrendAnalysis } from "../../hooks/useTrendAnalysis";
import { useBbdxV66Flags } from "@/hooks/useBbdxV66Flags";
import { useBbdxV66Current } from "@/hooks/useBbdxV66Current";

interface CoinSignalTabProps {
  symbol: string;
}

export function CoinSignalTab({ symbol }: CoinSignalTabProps) {
  const [interval, setInterval] = useState<TimeframeValue>("4h");

  const { signal } = useCoinSignal(symbol, interval);
  const { meta } = useCoinMeta(symbol);
  const { events, isAvailable: eventsAvailable } = useUpcomingEvents(symbol);

  // v6.5 — VWAP detail + Trend analysis (modifier multipliers).
  const vwapTf: "1h" | "4h" | "1d" =
    interval === "1h" || interval === "4h" || interval === "1d" ? interval : "4h";
  const { detail: vwapDetail } = useVwapDetail(symbol, vwapTf);
  const { data: trendData } = useTrendAnalysis(symbol);

  // v6.6 — feature flags + LONG/SHORT 양방향.
  const { isV66, shortEnabled } = useBbdxV66Flags();
  const v66Tf: "1h" | "4h" | "1d" =
    interval === "1h" || interval === "4h" || interval === "1d" ? interval : "4h";
  const { short: v66Short, meta: v66Meta } = useBbdxV66Current(symbol, v66Tf, {
    enabled: isV66,
  });
  const isConflict =
    !!v66Meta && v66Meta.bothTriggered === true && !("note" in v66Meta);

  return (
    <div className="space-y-4">
      {/* TF Selector — 상단 inline bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 bg-card/50 border border-border/30 rounded-sm px-2 py-1">
          <Clock className="h-3 w-3 text-neon-cyan" />
          <div className="flex gap-0.5">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf.value}
                onClick={() => setInterval(tf.value as TimeframeValue)}
                className={cn(
                  "font-mono text-[10px] px-2 py-1 rounded-sm transition-all",
                  interval === tf.value
                    ? "bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                )}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>
        <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
          {interval.toUpperCase()} · LIVE
        </span>
      </div>

      {/* Signal Cards + Side Panels Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Left — Signal cards + Dimension breakdown */}
        <div className="md:col-span-8 space-y-3">
          <SignalCard
            signal={signal}
            vwapMult={vwapDetail?.vwapMult}
            waveMult={trendData?.waveMult}
            symbol={symbol}
            tf={v66Tf}
            showWeightBadge={isV66}
            conflict={isConflict}
          />
          {isV66 && shortEnabled ? (
            <ShortSignalCard
              symbol={symbol}
              tf={v66Tf}
              short={v66Short}
              conflict={isConflict}
            />
          ) : (
            <ShortSignalCard
              symbol={symbol}
              tf={v66Tf}
              short={null}
              inactiveNote={
                !isV66
                  ? "BBDX v6.6 미활성 (BBDX_VERSION=v6.5). 백엔드 env BBDX_VERSION=v6.6 + ENABLE_SHORT_SIGNALS=1 설정 시 SHORT 시그널 표시."
                  : "SHORT 시그널 비활성 (ENABLE_SHORT_SIGNALS=0). 백엔드 env 에서 활성 가능."
              }
            />
          )}
          {/* 7-차원 breakdown — Dim 4/5 강화 카드 포함 */}
          <DimensionBreakdown signal={signal} vwapDetail={vwapDetail} />
        </div>

        {/* Right — CoinInfo + Upcoming Events */}
        <div className="md:col-span-4 space-y-3">
          <CoinInfoCard meta={meta} />
          <UpcomingEvents events={events} isAvailable={eventsAvailable} />
        </div>
      </div>
    </div>
  );
}
