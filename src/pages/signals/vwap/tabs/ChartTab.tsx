/**
 * VWAP Strategy — 차트 탭 (link to coin detail).
 *
 * 명세: TRACKER_TAB_STANDARD §2.3. 메인 차트는 코인 클릭 시 VwapDetail 페이지
 * (`/vwap/:symbol`) 로 이동 — VWAP + 1σ/2σ/3σ band + Volume Profile.
 */

import { ChartTab as ChartTabStandard } from "@/components/trackers/tabs";
import { HudPanel } from "@/components/HudPanel";
import { BarChart3 } from "lucide-react";
import { Link } from "wouter";

export function ChartTab() {
  return (
    <ChartTabStandard
      timeframes={[
        { value: "1h", label: "1H" },
        { value: "4h", label: "4H" },
        { value: "1d", label: "1D" },
      ]}
      selectedTimeframe="4h"
      chart={
        <div className="flex flex-col items-center justify-center min-h-[300px] gap-3 border border-dashed border-border/40 rounded-sm bg-background/30">
          <BarChart3 className="h-10 w-10 text-muted-foreground/60" />
          <div className="text-center">
            <div className="font-mono text-sm text-foreground/80">
              VWAP 차트는 코인별 상세 페이지에서 제공
            </div>
            <div className="font-mono text-[10px] text-muted-foreground mt-1">
              실시간 신호 탭에서 코인 행 클릭 → /vwap/:symbol 으로 이동
            </div>
            <div className="mt-3">
              <Link
                href="/vwap/BTCUSDT"
                className="font-mono text-xs px-3 py-1.5 rounded-sm border border-neon-cyan/40 bg-neon-cyan/10 text-neon-cyan hover:bg-neon-cyan/20 transition-colors"
              >
                BTC VWAP 상세 차트 보기
              </Link>
            </div>
          </div>
        </div>
      }
      legend={[
        { color: "bg-neon-cyan", label: "VWAP (중심선)" },
        { color: "bg-neon-green", label: "1σ band (지지/저항)" },
        { color: "bg-neon-yellow", label: "2σ band (확장)" },
        { color: "bg-neon-red", label: "3σ band (극단)" },
        { color: "bg-neon-pink", label: "EMA(9) (단기 추세)" },
        { color: "bg-purple-400", label: "POC / HVN / LVN (Volume Profile)" },
      ]}
      analysis={[
        "VWAP 차트 컴포넌트는 lightweight-charts + Recharts 하이브리드 (VwapDetail.tsx 에 구현)",
        "본 wrapper 탭은 코인 선택 UI + inline 차트 주입 가능 (향후 확장)",
      ]}
      footer={
        <HudPanel title="향후 개선 사항" subtitle="ROADMAP">
          <ul className="space-y-1.5 font-mono text-xs text-foreground/80">
            <li>· 차트 컴포넌트 wrapper 내부 inline 렌더링 (현재는 외부 라우트 이동)</li>
            <li>· Volume Profile overlay toggle (POC/VAH/VAL/HVN/LVN)</li>
            <li>· Multi-TF VWAP 비교 (1H/4H/1D 동시)</li>
          </ul>
        </HudPanel>
      }
    />
  );
}
