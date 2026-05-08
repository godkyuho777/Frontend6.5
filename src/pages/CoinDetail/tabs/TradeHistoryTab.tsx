/**
 * TradeHistoryTab — 백테스트 trade 배열 (TradeTable 재사용).
 *
 * useCoinBacktest 결과 의존 — 우선 BacktestTab 에서 RUN 후 데이터 채워짐.
 */

import { TradeTable } from "@/components/backtest/TradeTable";
import { useCoinBacktest } from "../hooks/useCoinBacktest";

interface TradeHistoryTabProps {
  symbol: string;
}

export function TradeHistoryTab({ symbol }: TradeHistoryTabProps) {
  const { result } = useCoinBacktest(symbol);

  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-2">
        <p className="font-mono text-xs text-muted-foreground">
          Trade history empty
        </p>
        <p className="font-mono text-[10px] text-muted-foreground/70">
          BACKTEST 탭에서 RUN 클릭하면 여기에 trade 가 표시됩니다.
        </p>
      </div>
    );
  }

  return (
    <TradeTable
      trades={result.trades as any}
      variant="compact"
      limit={300}
    />
  );
}
