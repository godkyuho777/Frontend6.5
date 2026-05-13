/**
 * 전인구 시그널 — 차트 탭.
 *
 * 명세: JEON_IN_GU_SIGNAL_TRACKER §3.6 [6.4] — Phase 4 VP+Trend 차트.
 *
 * Phase 4 (VP + Trend Strategy) 구현 후 lightweight-charts 또는 Recharts
 * 기반 VolumeProfileChart + MultiTFTrendChart 주입 예정.
 */

import { ChartTab as ChartTabStandard } from "@/components/trackers/tabs";
import { BarChart3 } from "lucide-react";
import { PhasePendingCard } from "../components/PhasePendingCard";

export function ChartTab() {
  return (
    <ChartTabStandard
      timeframes={[
        { value: "1h", label: "1H" },
        { value: "4h", label: "4H" },
        { value: "1d", label: "1D" },
      ]}
      selectedTimeframe="4h"
      chartTypes={[
        { value: "candle+vp", label: "Candle + VP" },
        { value: "candle+trend", label: "Candle + Trend" },
        { value: "candle+all", label: "Candle + All" },
      ]}
      selectedChartType="candle+vp"
      chart={
        <div className="flex flex-col items-center justify-center min-h-[300px] gap-3 border border-dashed border-border/40 rounded-sm bg-background/30">
          <BarChart3 className="h-10 w-10 text-muted-foreground/60" />
          <div className="text-center">
            <div className="font-mono text-sm text-foreground/80">
              Phase 4 — VP + Trend 차트 대기
            </div>
            <div className="font-mono text-[10px] text-muted-foreground mt-1">
              Volume Profile · POC · VAH · VAL · HVN · LVN · 다중 TF 추세선
            </div>
          </div>
        </div>
      }
      legend={[
        { color: "bg-neon-green", label: "진입가 (ENTRY)" },
        { color: "bg-neon-red", label: "STOP" },
        { color: "bg-neon-cyan", label: "목표 (TP)" },
        { color: "bg-purple-400", label: "POC (Point of Control)" },
        { color: "bg-yellow-400", label: "VAH / VAL (Value Area)" },
        { color: "bg-blue-400", label: "HVN / LVN (Volume Node)" },
      ]}
      analysis={[
        "Phase 4 활성 후 자동 산출: VP 구조 (POC 위치) + 다중 TF 추세 (1h/4h/1d) + 전인구 콘텐츠 영향",
        "현재는 placeholder. 실 데이터 누적 시 한국어 분석 텍스트 자동 생성 예정",
      ]}
      footer={
        <PhasePendingCard
          phase="Phase 4 pending"
          title="VP + Trend Strategy 미구현"
          unlocksWhen="Phase 4 (server/src/strategies/vp-trend/) 구현 후 lightweight-charts 차트 주입"
        >
          <p className="font-mono text-xs text-foreground/80 leading-relaxed">
            차트 컴포넌트는 트래커별 별도 구현. 본 페이지는 5 탭 wrapper +
            legend + 분석 텍스트 표준화. Phase 4 완료 후 <code className="text-neon-cyan">VolumeProfileChart</code>{" "}
            컴포넌트를 <code className="text-neon-cyan">chart</code> prop 으로 주입.
          </p>
        </PhasePendingCard>
      }
    />
  );
}
