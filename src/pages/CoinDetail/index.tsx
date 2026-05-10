/**
 * CoinDetail Workstation — TradingView-style 3-zone layout.
 *
 *   ┌─────────────────────────────────────────────────┐
 *   │ Header (sticky, h-14)                            │
 *   ├──────────────────────────┬──────────────────────┤
 *   │ ChartZone (col-span 8)   │ SignalCard           │
 *   │                          │ CoinInfoCard         │
 *   │                          │ UpcomingEvents       │
 *   ├──────────────────────────┴──────────────────────┤
 *   │ Tab Strip + 선택된 탭                             │
 *   └─────────────────────────────────────────────────┘
 *
 * 모바일 (md:↓) — 단일 컬럼, Tab Strip sticky bottom.
 *
 * 클라이언트 사이드 BBDX (useCoinSignal) + 백엔드 라우트 미존재 시 friendly fallback.
 */

import { useParams, useSearch } from "wouter";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { TimeframeValue } from "@shared/types";
import { Header } from "./Header";
import { ChartZone } from "./ChartZone";
import { SignalCard } from "./panels/SignalCard";
import { CoinInfoCard } from "./panels/CoinInfoCard";
import { UpcomingEvents } from "./panels/UpcomingEvents";
import { BacktestTab } from "./tabs/BacktestTab";
import { WinRateTab } from "./tabs/WinRateTab";
import { DimensionBreakdown } from "./tabs/DimensionBreakdown";
import { TradeHistoryTab } from "./tabs/TradeHistoryTab";
import { LiteModeTab } from "./tabs/LiteModeTab";
import { AIInsightTab } from "./tabs/AIInsightTab";
import { useCoinSignal } from "./hooks/useCoinSignal";
import { useCoinMeta } from "./hooks/useCoinMeta";
import { useUpcomingEvents } from "./hooks/useUpcomingEvents";
import { useVwapDetail } from "./hooks/useVwapDetail";
import { useTrendAnalysis } from "./hooks/useTrendAnalysis";

export default function CoinDetailWorkstation() {
  const params = useParams<{ symbol: string }>();
  const symbol = params.symbol ?? "";
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const initialTf = (urlParams.get("tf") as TimeframeValue) || "4h";
  const [interval, setInterval] = useState<TimeframeValue>(initialTf);
  const [activeTab, setActiveTab] = useState("backtest");

  const { signal } = useCoinSignal(symbol, interval);
  const { meta } = useCoinMeta(symbol);
  const { events, isAvailable: eventsAvailable } = useUpcomingEvents(symbol);

  // v6.5 — vwap.detail 라우트로 BBDX multiplier + Volume Profile + Multi-TF 가져옴
  const vwapTf: "1h" | "4h" | "1d" =
    interval === "1h" || interval === "4h" || interval === "1d" ? interval : "4h";
  const { detail: vwapDetail } = useVwapDetail(symbol, vwapTf);

  // v6.5+ — trend.analyze 라우트로 Wave Alignment + waveMult (BBDX multiplier)
  // 가져옴. SignalCard 헤더에 chip 으로 표시. 헌장 규칙 3 — modifier-only.
  const { data: trendData } = useTrendAnalysis(symbol);

  if (!symbol) {
    return (
      <div className="text-center py-20 font-mono text-muted-foreground">
        Symbol 이 지정되지 않았습니다.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Header symbol={symbol} interval={interval} onIntervalChange={setInterval} />

      {/* Zone 1+2: Chart + Right Panels */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Chart — col-span 8 on md+ */}
        <div className="md:col-span-8 order-2 md:order-1">
          <ChartZone symbol={symbol} interval={interval} />
        </div>

        {/* Right side panels — col-span 4 on md+, stacked on mobile */}
        <div className="md:col-span-4 order-1 md:order-2 space-y-3">
          <SignalCard
            signal={signal}
            vwapMult={vwapDetail?.vwapMult}
            waveMult={trendData?.waveMult}
          />
          <CoinInfoCard meta={meta} />
          <UpcomingEvents events={events} isAvailable={eventsAvailable} />
        </div>
      </div>

      {/* Zone 3: Tab Strip */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-card/50 border border-border/20 h-9 flex-wrap md:flex-nowrap md:sticky md:bottom-0 md:z-30 md:bg-background/95 md:backdrop-blur">
          <TabsTrigger
            value="backtest"
            className="font-mono text-[11px] h-7 data-[state=active]:text-neon-pink"
          >
            BACKTEST
          </TabsTrigger>
          <TabsTrigger
            value="winrate"
            className="font-mono text-[11px] h-7 data-[state=active]:text-neon-cyan"
          >
            WIN RATE
          </TabsTrigger>
          <TabsTrigger
            value="dimensions"
            className="font-mono text-[11px] h-7 data-[state=active]:text-neon-yellow"
          >
            7-DIM
          </TabsTrigger>
          <TabsTrigger
            value="trades"
            className="font-mono text-[11px] h-7 data-[state=active]:text-neon-green"
          >
            TRADES
          </TabsTrigger>
          <TabsTrigger
            value="lite"
            className="font-mono text-[11px] h-7 data-[state=active]:text-neon-pink"
          >
            LITE
          </TabsTrigger>
          <TabsTrigger
            value="ai"
            className="font-mono text-[11px] h-7 data-[state=active]:text-neon-cyan"
          >
            AI
          </TabsTrigger>
        </TabsList>

        <TabsContent value="backtest" className="mt-3 min-h-96">
          <BacktestTab symbol={symbol} />
        </TabsContent>
        <TabsContent value="winrate" className="mt-3 min-h-96">
          <WinRateTab symbol={symbol} tf={interval} />
        </TabsContent>
        <TabsContent value="dimensions" className="mt-3 min-h-96">
          <DimensionBreakdown signal={signal} vwapDetail={vwapDetail} />
        </TabsContent>
        <TabsContent value="trades" className="mt-3 min-h-96">
          <TradeHistoryTab symbol={symbol} />
        </TabsContent>
        <TabsContent value="lite" className="mt-3 min-h-96">
          <LiteModeTab symbol={symbol} tf={interval} />
        </TabsContent>
        <TabsContent value="ai" className="mt-3 min-h-96">
          <AIInsightTab symbol={symbol} signal={signal} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
