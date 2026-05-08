/**
 * DimensionBreakdown — 7차원 multiplier breakdown.
 *
 * v6.5 머지 후 useCoinSignal.dimensions 가 채워지면 BarChart 표시.
 * 현재는 placeholder.
 */

import type { CoinSignal } from "../hooks/useCoinSignal";

interface DimensionBreakdownProps {
  signal: CoinSignal | null;
}

export function DimensionBreakdown({ signal }: DimensionBreakdownProps) {
  if (!signal?.dimensions) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-2">
        <p className="font-mono text-xs text-muted-foreground">
          7차원 breakdown
        </p>
        <p className="font-mono text-[10px] text-muted-foreground/70 max-w-md text-center leading-relaxed">
          현재 시그널 엔진은 BBDX-PATTERN v6.1 (5차원). v6.5 머지 후 onchain ·
          macro 차원이 추가되면 multiplier 별 막대그래프가 자동 표시됩니다.
        </p>
      </div>
    );
  }

  // forward-compatible — v6.5 머지 후 BarChart 추가 자리
  return (
    <div className="space-y-3">
      <p className="font-mono text-xs text-muted-foreground">
        7-dimension breakdown · v6.5 dimensions
      </p>
      {Object.entries(signal.dimensions).map(([key, value]) => (
        <div key={key} className="flex items-center gap-3">
          <span className="font-mono text-[11px] text-muted-foreground uppercase tracking-wider w-20">
            {key}
          </span>
          <div className="flex-1 h-2 bg-muted/30 rounded-sm overflow-hidden">
            <div
              className="h-full bg-neon-cyan"
              style={{ width: `${Math.min(100, (value as number) * 100)}%` }}
            />
          </div>
          <span className="font-mono text-xs text-foreground w-10 text-right">
            {(value as number).toFixed(2)}
          </span>
        </div>
      ))}
    </div>
  );
}
