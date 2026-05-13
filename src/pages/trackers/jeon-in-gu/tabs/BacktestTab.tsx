/**
 * 전인구 시그널 — 백테스트 탭.
 *
 * 명세: JEON_IN_GU_SIGNAL_TRACKER §3.6 [6.5] — Phase 5 백테스트 + calibration.
 *
 * 백엔드 라우트 (Phase 5 활성 후 사용 예정):
 *   - trpc.jeonInGu.calibrationHistory.useQuery()
 *   - (관리자) trpc.adminJeonInGu.triggerCalibrationManual
 *
 * Phase 5 미완 = 백테스트 데이터 누적 X. 모든 메트릭/곡선 비활성.
 */

import { BacktestTab as BacktestTabStandard } from "@/components/trackers/tabs";
import { PhasePendingCard } from "../components/PhasePendingCard";

export function BacktestTab() {
  return (
    <BacktestTabStandard
      metrics={undefined}
      cumulative_returns={undefined}
      modifier_impacts={undefined}
      calibration_history={[]}
      baseline_comparison={undefined}
      isLoading={false}
      footer={
        <PhasePendingCard
          phase="Phase 5 pending"
          title="백테스트 + Calibration 데이터 누적 대기"
          unlocksWhen="Phase 5 백테스트 strategy + 매주 일요일 23:00 KST calibration cron 활성 후 데이터 90일 누적"
        >
          <div className="space-y-3 font-mono text-xs">
            <div>
              <span className="text-muted-foreground uppercase tracking-wider text-[10px]">
                활성 시 표시:
              </span>
              <ul className="space-y-1 mt-1.5 text-foreground/80">
                <li>· 메트릭: 승률 + Wilson 95% CI / 평균 수익 / Sharpe / MDD / 시그널 수</li>
                <li>· 누적 수익 곡선 (VP+Trend 단독 vs +전인구 modifier)</li>
                <li>· Modifier 영향도 (modifier 별 contribution)</li>
                <li>· Calibration 히스토리 (R² + weight 변경 추적)</li>
                <li>· 학술 baseline 비교 (Buy-and-hold · SMA Cross · Random)</li>
              </ul>
            </div>
            <div className="pt-2 border-t border-border/30">
              <span className="text-muted-foreground uppercase tracking-wider text-[10px]">
                trpc 경로:
              </span>
              <div className="mt-1.5 text-neon-cyan space-y-0.5">
                <div>
                  <code>trpc.jeonInGu.calibrationHistory.useQuery()</code>
                </div>
                <div>
                  <code>trpc.backtest.run.useMutation()</code> (기존 백테스트 엔진 통합)
                </div>
              </div>
            </div>
            <div className="pt-2 border-t border-border/30">
              <span className="text-muted-foreground uppercase tracking-wider text-[10px]">
                자동 calibration 규칙:
              </span>
              <ul className="space-y-1 mt-1.5 text-foreground/80">
                <li>· R² &lt; 0.10 → weight 자동 감소 (0.50 → 0.40 → 0.30 → 0.20)</li>
                <li>· R² ≥ 0.15 → weight 유지</li>
                <li>· R² ≥ 0.20 → weight 유지 (충분)</li>
              </ul>
            </div>
          </div>
        </PhasePendingCard>
      }
    />
  );
}
