/**
 * BacktestTab — 백테스트 표준 레이아웃.
 *
 * 명세: TRACKER_TAB_STANDARD §2.4.
 *   - 메트릭 grid (승률 · 평균 수익 · Sharpe · MDD · 시그널 수)
 *   - 누적 수익 그래프 (baseline vs +modifier)
 *   - Modifier 영향도 차트
 *   - Calibration 히스토리 표
 *   - 학술 baseline 비교 (Buy-and-hold, SMA, Random)
 *   - 면책 라벨
 */

import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { HudPanel, StatCard } from "@/components/HudPanel";
import { cn } from "@/lib/utils";

export interface BacktestMetrics {
  win_rate: number;
  win_rate_ci?: [number, number];
  avg_return: number;
  sharpe: number;
  mdd: number;
  total_signals: number;
}

export interface CumulativeReturnPoint {
  ts: number;
  baseline: number;
  withModifier: number;
}

export interface ModifierImpactItem {
  name: string;
  /** -100 ~ +100 (전체 수익 대비 기여 %). */
  contribution: number;
}

export interface CalibrationHistoryRow {
  date: string;
  weight_before: number;
  weight_after: number;
  reason: string;
  r_squared?: number;
}

export interface BaselineComparisonRow {
  label: string;
  value: number;
}

export interface BacktestTabProps {
  metrics?: BacktestMetrics;
  cumulative_returns?: CumulativeReturnPoint[];
  modifier_impacts?: ModifierImpactItem[];
  calibration_history?: CalibrationHistoryRow[];
  baseline_comparison?: BaselineComparisonRow[];
  /** 컨트롤 (기간/심볼 선택 등) 슬롯. */
  controls?: ReactNode;
  /** Phase pending 안내. */
  footer?: ReactNode;
  isLoading?: boolean;
}

const TOOLTIP_STYLE = {
  backgroundColor: "oklch(0.18 0.02 280 / 0.95)",
  border: "1px solid oklch(0.55 0.18 320 / 0.4)",
  borderRadius: "2px",
  fontFamily: "Share Tech Mono, monospace",
  fontSize: "11px",
};

export function BacktestTab({
  metrics,
  cumulative_returns,
  modifier_impacts,
  calibration_history,
  baseline_comparison,
  controls,
  footer,
  isLoading,
}: BacktestTabProps) {
  return (
    <div className="space-y-4">
      {controls && <div>{controls}</div>}

      {/* Metrics grid */}
      <HudPanel title="핵심 메트릭" subtitle="PERFORMANCE">
        {metrics ? (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <StatCard
              label="승률"
              value={`${metrics.win_rate.toFixed(1)}%`}
              variant={metrics.win_rate >= 50 ? "positive" : "negative"}
            />
            <StatCard
              label="평균 수익"
              value={`${metrics.avg_return.toFixed(2)}%`}
              variant={metrics.avg_return >= 0 ? "positive" : "negative"}
            />
            <StatCard
              label="Sharpe"
              value={metrics.sharpe.toFixed(2)}
              variant={metrics.sharpe >= 1 ? "positive" : "default"}
            />
            <StatCard
              label="MDD"
              value={`${metrics.mdd.toFixed(1)}%`}
              variant="negative"
            />
            <StatCard label="시그널 수" value={metrics.total_signals} />
          </div>
        ) : (
          <p className="font-mono text-xs text-muted-foreground italic">
            {isLoading ? "백테스트 결과 로드 중..." : "백테스트 데이터 없음"}
          </p>
        )}
        {metrics?.win_rate_ci && (
          <p className="mt-2 font-mono text-[10px] text-muted-foreground">
            Wilson 95% CI: [{metrics.win_rate_ci[0].toFixed(1)}%,{" "}
            {metrics.win_rate_ci[1].toFixed(1)}%]
          </p>
        )}
      </HudPanel>

      {/* Cumulative returns */}
      {cumulative_returns && cumulative_returns.length > 0 && (
        <HudPanel title="누적 수익 곡선" subtitle="EQUITY CURVE">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cumulative_returns}>
                <defs>
                  <linearGradient id="bt-base" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.7 0.18 200)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="oklch(0.7 0.18 200)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="bt-mod" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.85 0.25 320)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="oklch(0.85 0.25 320)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="oklch(0.3 0.02 280 / 0.3)" strokeDasharray="3 3" />
                <XAxis
                  dataKey="ts"
                  stroke="oklch(0.55 0.02 280)"
                  tick={{ fontFamily: "Share Tech Mono", fontSize: 10 }}
                />
                <YAxis
                  stroke="oklch(0.55 0.02 280)"
                  tick={{ fontFamily: "Share Tech Mono", fontSize: 10 }}
                />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontFamily: "Share Tech Mono", fontSize: 11 }} />
                <Area
                  type="monotone"
                  name="Baseline"
                  dataKey="baseline"
                  stroke="oklch(0.7 0.18 200)"
                  strokeWidth={2}
                  fill="url(#bt-base)"
                />
                <Area
                  type="monotone"
                  name="+ Modifier"
                  dataKey="withModifier"
                  stroke="oklch(0.85 0.25 320)"
                  strokeWidth={2}
                  fill="url(#bt-mod)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </HudPanel>
      )}

      {/* Modifier impact */}
      {modifier_impacts && modifier_impacts.length > 0 && (
        <HudPanel title="Modifier 영향도">
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={modifier_impacts} layout="vertical">
                <CartesianGrid stroke="oklch(0.3 0.02 280 / 0.3)" />
                <XAxis
                  type="number"
                  stroke="oklch(0.55 0.02 280)"
                  tick={{ fontFamily: "Share Tech Mono", fontSize: 10 }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke="oklch(0.55 0.02 280)"
                  tick={{ fontFamily: "Share Tech Mono", fontSize: 11 }}
                  width={110}
                />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="contribution" fill="oklch(0.85 0.25 320)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </HudPanel>
      )}

      {/* Calibration history */}
      {calibration_history && (
        <HudPanel title="Calibration 히스토리">
          {calibration_history.length === 0 ? (
            <p className="font-mono text-xs text-muted-foreground italic">
              calibration 기록 없음
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-border/30">
                    <th className="py-1.5 pr-2">Date</th>
                    <th className="py-1.5 pr-2">Weight</th>
                    <th className="py-1.5 pr-2">R²</th>
                    <th className="py-1.5 pr-2">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {calibration_history.map((row, i) => {
                    const diff = row.weight_after - row.weight_before;
                    return (
                      <tr key={i} className="border-b border-border/20">
                        <td className="py-1.5 pr-2">{row.date}</td>
                        <td className="py-1.5 pr-2 tabular-nums">
                          {row.weight_before.toFixed(2)} →{" "}
                          <span
                            className={cn(
                              diff >= 0 ? "text-neon-green" : "text-neon-red"
                            )}
                          >
                            {row.weight_after.toFixed(2)}
                          </span>
                        </td>
                        <td className="py-1.5 pr-2 tabular-nums text-neon-cyan">
                          {row.r_squared != null ? row.r_squared.toFixed(3) : "—"}
                        </td>
                        <td className="py-1.5 pr-2 text-foreground/80">
                          {row.reason}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </HudPanel>
      )}

      {/* Baseline comparison */}
      {baseline_comparison && baseline_comparison.length > 0 && (
        <HudPanel title="학술 baseline 비교">
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4">
            {baseline_comparison.map((b, i) => (
              <StatCard
                key={i}
                label={b.label}
                value={`${b.value.toFixed(2)}%`}
                variant={b.value >= 0 ? "positive" : "negative"}
              />
            ))}
          </div>
        </HudPanel>
      )}

      {/* Disclaimer */}
      <div className="flex items-start gap-2 px-3 py-2 border border-yellow-500/30 bg-yellow-500/5 rounded-sm">
        <AlertTriangle className="h-4 w-4 text-yellow-400 shrink-0 mt-0.5" />
        <p className="font-mono text-[11px] text-yellow-200/90">
          백테스트 결과 ≠ 미래 수익 보장. Realistic execution (slippage 0.1% ·
          수수료 0.1% · latency 1 캔들) 반영. Lookahead-free 검증 통과.
        </p>
      </div>

      {footer}
    </div>
  );
}
