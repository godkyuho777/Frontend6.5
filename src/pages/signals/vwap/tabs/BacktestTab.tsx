/**
 * VWAP Strategy — 백테스트 탭 (placeholder).
 *
 * 명세: TRACKER_TAB_STANDARD §2.4. 전체 백테스트는 `/backtest` 페이지에서 처리.
 * 본 탭은 VWAP 전략에 한정한 메트릭 요약 placeholder 만 표시.
 */

import { BacktestTab as BacktestTabStandard } from "@/components/trackers/tabs";
import { HudPanel } from "@/components/HudPanel";
import { Link } from "wouter";
import { FlaskConical } from "lucide-react";

export function BacktestTab() {
  return (
    <BacktestTabStandard
      metrics={undefined}
      cumulative_returns={undefined}
      modifier_impacts={undefined}
      calibration_history={[]}
      isLoading={false}
      footer={
        <HudPanel title="전체 백테스트" subtitle="ENGINE A / ENGINE B" variant="highlight">
          <div className="space-y-3">
            <p className="font-mono text-xs text-foreground/90">
              VWAP 단독 백테스트 메트릭은 활성 calibration 후 누적 표시 예정.
              현재는 BBDX 통합 백테스트 페이지에서 전체 시그널 성능을 확인 가능.
            </p>
            <Link
              href="/backtest"
              className="inline-flex items-center gap-2 font-mono text-xs px-3 py-1.5 rounded-sm border border-neon-cyan/40 bg-neon-cyan/10 text-neon-cyan hover:bg-neon-cyan/20 transition-colors"
            >
              <FlaskConical className="h-3.5 w-3.5" />
              /backtest 페이지에서 BBDX 백테스트 실행
            </Link>
            <div className="pt-2 border-t border-border/30">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                향후 표시 메트릭 (calibration 후):
              </span>
              <ul className="space-y-1 mt-1.5 font-mono text-xs text-foreground/80">
                <li>· 승률 + Wilson 95% CI</li>
                <li>· 평균 수익 / Sharpe / MDD / 시그널 수</li>
                <li>· 누적 수익 곡선 (BBDX baseline vs +VWAP modifier)</li>
                <li>· 5-component 별 contribution (VWAP / EMA / Pullback / HVN / LVN)</li>
                <li>· 1σ vs 2σ band 진입 시 승률 비교</li>
              </ul>
            </div>
          </div>
        </HudPanel>
      }
    />
  );
}
