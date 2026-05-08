/**
 * useCoinBacktest — 단일 코인 백테스트.
 *
 * 백엔드에 backtest.runForCoin 이 아직 wire 되지 않음. 현재는
 * 사용자가 RUN 클릭 후 mutation 실행하는 방식 (full-page Backtest 와 유사).
 * 화면이 바로 빈 상태일 때 friendly placeholder 표시.
 */

import { trpc } from "@/lib/trpc";

export function useCoinBacktest(symbol: string | undefined) {
  const mutation = trpc.backtest.run.useMutation();

  const run = (opts?: { tf?: "1h" | "4h" | "6h" | "1d" | "1w" }) => {
    if (!symbol) return;
    const tf = opts?.tf ?? "4h";
    const defaultWindow: Record<string, number> = {
      "1h": 168,
      "4h": 42,
      "6h": 28,
      "1d": 14,
      "1w": 4,
    };
    const endDate = new Date().toISOString().slice(0, 10);
    const startDate = new Date(Date.now() - 365 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    mutation.mutate({
      symbols: [symbol],
      tf,
      startDate,
      endDate,
      outcomeWindowCandles: defaultWindow[tf] ?? 42,
      cooldownCandles: 5,
      saveToDb: false,
    });
  };

  return {
    result: mutation.data,
    isLoading: mutation.isPending,
    error: mutation.error,
    run,
    isAvailable: true,
  };
}
