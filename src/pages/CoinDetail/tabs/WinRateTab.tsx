/**
 * WinRateTab — 30 / 90 / 365 일 rolling 승률 + Wilson CI bar.
 *
 * 백엔드 winRate.rolling 미존재 시 friendly placeholder.
 */

import { useWinRate } from "../hooks/useWinRate";
import type { TimeframeValue } from "@shared/types";
import { Loader2 } from "lucide-react";

interface WinRateTabProps {
  symbol: string;
  tf?: TimeframeValue;
}

export function WinRateTab({ symbol, tf = "4h" }: WinRateTabProps) {
  const { windows, isAvailable, isLoading, status } = useWinRate(symbol, tf);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-neon-cyan" />
        <span className="font-mono text-xs text-muted-foreground">
          rolling 백테스트 캐시 조회 중...
        </span>
      </div>
    );
  }

  if (!isAvailable || windows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-2">
        <p className="font-mono text-xs text-muted-foreground">
          rolling 승률 데이터 없음
        </p>
        <p className="font-mono text-[10px] text-muted-foreground/70">
          {status === "stub"
            ? "백테스트 데이터가 없는 코인입니다."
            : "잠시 후 다시 시도하세요."}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {windows.map((w) => {
        const pct = (w.winRate * 100).toFixed(1);
        const ciLowPct = w.ciLow * 100;
        const ciHighPct = w.ciHigh * 100;
        return (
          <div
            key={w.windowDays}
            className="p-4 rounded-sm border border-border/20 bg-card/40"
          >
            <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
              Last {w.windowDays} days
            </div>
            <div className="font-display text-3xl font-bold text-neon-cyan mt-1">
              {pct}%
            </div>
            <div className="font-mono text-[10px] text-muted-foreground mt-0.5">
              {w.trades} trades
            </div>
            <div className="mt-3">
              <div className="flex items-center justify-between font-mono text-[9px] text-muted-foreground mb-1">
                <span>{ciLowPct.toFixed(1)}%</span>
                <span>95% CI</span>
                <span>{ciHighPct.toFixed(1)}%</span>
              </div>
              <div className="relative h-1.5 bg-muted/30 rounded-sm overflow-hidden">
                <div
                  className="absolute h-full bg-neon-cyan/40"
                  style={{
                    left: `${ciLowPct}%`,
                    width: `${ciHighPct - ciLowPct}%`,
                  }}
                />
                <div
                  className="absolute top-0 h-full w-0.5 bg-neon-pink"
                  style={{ left: `${pct}%` }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
