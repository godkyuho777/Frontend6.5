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
        <p className="font-sans text-xs text-muted-foreground">
          아직 거래 기록이 없습니다.
        </p>
        <p className="font-sans text-[10px] text-muted-foreground/70">
          백테스트 탭에서 백테스트를 실행하면 거래 내역이 여기에 표시됩니다.
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
