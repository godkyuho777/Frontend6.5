/**
 * Fibonacci & Trendline — 차트 탭 (placeholder).
 *
 * 명세: TRACKER_TAB_STANDARD §2.3. 메인 차트는 코인 클릭 시 FibonacciDetail
 * 페이지 (`/fibonacci/:symbol`) 로 이동 — lightweight-charts 기반 Fib level +
 * 추세선 overlay 를 표시.
 */

import { ChartTab as ChartTabStandard } from "@/components/trackers/tabs";
import { HudPanel } from "@/components/HudPanel";
import { BarChart3 } from "lucide-react";
import { Link } from "wouter";

export function ChartTab() {
  return (
    <ChartTabStandard
      chart={
        <div className="flex flex-col items-center justify-center min-h-[300px] gap-3 border border-dashed border-border/40 rounded-sm bg-background/30">
          <BarChart3 className="h-10 w-10 text-muted-foreground/60" />
          <div className="text-center">
            <div className="font-mono text-sm text-foreground/80">
              Fibonacci 차트는 코인별 상세 페이지에서 제공
            </div>
            <div className="font-mono text-[10px] text-muted-foreground mt-1">
              실시간 신호 탭에서 코인 행 클릭 → /fibonacci/:symbol 으로 이동
            </div>
            <div className="mt-3">
              <Link
                href="/fibonacci/BTCUSDT"
                className="font-mono text-xs px-3 py-1.5 rounded-sm border border-neon-cyan/40 bg-neon-cyan/10 text-neon-cyan hover:bg-neon-cyan/20 transition-colors"
              >
                BTC Fibonacci 차트 보기
              </Link>
            </div>
          </div>
        </div>
      }
      legend={[
        { color: "bg-neon-yellow", label: "Golden Pocket (0.382~0.618)" },
        { color: "bg-neon-cyan", label: "Fib level (0.236/0.5/0.786)" },
        { color: "bg-neon-pink", label: "Extension (1.272/1.618)" },
        { color: "bg-neon-green", label: "Active trendline (bullish)" },
        { color: "bg-neon-red", label: "Active trendline (bearish)" },
      ]}
      analysis={[
        "Fibonacci 차트 컴포넌트는 lightweight-charts + Recharts 하이브리드 (FibonacciDetail.tsx 에 구현)",
        "본 wrapper 탭은 trackers/jeon-in-gu/tabs/ChartTab 패턴 따라 향후 코인 선택 UI 추가 가능",
      ]}
      footer={
        <HudPanel title="향후 개선 사항" subtitle="ROADMAP">
          <ul className="space-y-1.5 font-mono text-xs text-foreground/80">
            <li>· 차트 컴포넌트 wrapper 내부 inline 렌더링 (현재는 외부 라우트 이동)</li>
            <li>· Multi-coin overlay (BTC vs ETH Fib 동시 비교)</li>
            <li>· Trendline auto-detection visual debugger</li>
          </ul>
        </HudPanel>
      }
    />
  );
}
