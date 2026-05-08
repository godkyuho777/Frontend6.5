/**
 * BacktestTab — 단일 코인 백테스트.
 *
 * useCoinBacktest 결과를 받아 MetricCards (compact) + EquityChart + TradeTable 렌더.
 */

import { Button } from "@/components/ui/button";
import { Loader2, Play } from "lucide-react";
import { EquityChart } from "@/components/backtest/EquityChart";
import { MetricCards } from "@/components/backtest/MetricCards";
import { TradeTable } from "@/components/backtest/TradeTable";
import { useCoinBacktest } from "../hooks/useCoinBacktest";

interface BacktestTabProps {
  symbol: string;
}

export function BacktestTab({ symbol }: BacktestTabProps) {
  const { result, isLoading, error, run } = useCoinBacktest(symbol);

  if (!result && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <p className="font-mono text-xs text-muted-foreground">
          {symbol} 단일 코인 백테스트 — 1년 4시간봉 기준
        </p>
        <Button
          onClick={() => run({ tf: "4h" })}
          className="bg-neon-pink/10 border border-neon-pink/40 text-neon-pink hover:bg-neon-pink/20 font-display tracking-wider"
        >
          <Play className="h-4 w-4 mr-2" />
          RUN BACKTEST
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-neon-cyan" />
        <span className="font-mono text-xs text-muted-foreground">
          백테스트 실행 중...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <p className="font-mono text-xs text-neon-red py-4">
        ✗ {error.message}
      </p>
    );
  }

  if (!result) return null;
  const { overall, trades } = result;

  return (
    <div className="space-y-3">
      <MetricCards overall={overall} variant="compact" />
      <EquityChart trades={trades as any} />
      <TradeTable trades={trades as any} variant="compact" limit={100} />
    </div>
  );
}
