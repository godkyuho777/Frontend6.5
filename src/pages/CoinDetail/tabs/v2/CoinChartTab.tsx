/**
 * CoinChartTab — 코인 상세 페이지 "차트" 탭 (full-size).
 *
 * 기존 CoinDetail Workstation 의 ChartZone (BB + RSI + ADX/DI) 을 그대로
 * 재사용 + 상단에 TF selector. 인디케이터 toggle 은 ChartZone 안에 이미 모두
 * 표시되므로 생략.
 *
 * 명세: TRACKER_TAB_STANDARD §2.3 (차트 탭 = TF 선택 + 메인 차트 + legend).
 */

import { useState } from "react";
import type { TimeframeValue } from "@shared/types";
import { TIMEFRAMES } from "@shared/types";
import { cn } from "@/lib/utils";
import { ChartZone } from "../../ChartZone";
import { HudPanel } from "@/components/HudPanel";
import { Clock } from "lucide-react";

interface CoinChartTabProps {
  symbol: string;
}

export function CoinChartTab({ symbol }: CoinChartTabProps) {
  const [interval, setInterval] = useState<TimeframeValue>("4h");

  return (
    <div className="space-y-3">
      {/* Controls bar — TF selector + 인디케이터 legend */}
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
        <div className="flex flex-wrap items-center gap-3 font-mono text-[10px] text-muted-foreground">
          <LegendDot color="bg-neon-cyan" label="Close" />
          <LegendDot color="bg-muted-foreground" label="BB Upper/Mid/Lower" />
          <LegendDot color="bg-neon-yellow" label="RSI (14)" />
          <LegendDot color="bg-neon-pink" label="ADX / ±DI" />
        </div>
      </div>

      {/* Main chart — full width (no right panel) */}
      <ChartZone symbol={symbol} interval={interval} />

      {/* Analysis footer */}
      <HudPanel title="차트 가이드" subtitle="HOW TO READ">
        <ul className="space-y-1.5 font-mono text-xs text-foreground/80">
          <li>· <span className="text-neon-cyan">BB Lower 근접 + RSI &lt; 38</span> = BBDX NUM path 진입 후보 (LONG)</li>
          <li>· <span className="text-neon-yellow">BB Riding (캔들이 upper 또는 lower 외부)</span> = 추세 가속 진행 중</li>
          <li>· <span className="text-neon-pink">ADX &gt; 25 + +DI &gt; -DI</span> = 강한 상승 추세 (NUM path 제한)</li>
          <li>· <span className="text-neon-red">ADX &gt; 30 + -DI 우위</span> = Falling Knife (진입 차단)</li>
        </ul>
      </HudPanel>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("inline-block h-2 w-2 rounded-full", color)} />
      <span>{label}</span>
    </span>
  );
}
