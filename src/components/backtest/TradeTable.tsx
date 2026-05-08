/**
 * 백테스트 trade 리스트 테이블.
 *
 * Backtest 페이지 + CoinDetail/TradeHistoryTab 공통.
 * Win/Loss 필터는 호출자가 props 로 trades 를 미리 필터링해 전달.
 */

import { CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BacktestTrade {
  symbol: string;
  signalTs: number;
  win: boolean;
  exitReason: string;
  returnPct: number;
  rsi: number;
  adx: number;
  signalStrength: number;
  maxFavorable: number;
  maxAdverse: number;
}

interface TradeTableProps {
  trades: BacktestTrade[];
  /** "compact" 는 Symbol 컬럼 숨김 (단일 코인 페이지용) */
  variant?: "compact" | "full";
  /** 표시 한도 (default 300) */
  limit?: number;
}

function TradeRow({
  trade,
  showSymbol,
}: {
  trade: BacktestTrade;
  showSymbol: boolean;
}) {
  const exitColors: Record<string, string> = {
    target_hit: "text-neon-green",
    stop_loss: "text-red-400",
    window_expired: "text-neon-yellow",
  };
  const exitLabels: Record<string, string> = {
    target_hit: "TARGET",
    stop_loss: "STOP",
    window_expired: "EXPIRED",
  };

  return (
    <tr className="border-b border-border/10 hover:bg-neon-cyan/5 transition-colors">
      {showSymbol && (
        <td className="px-2 py-1.5 font-display font-bold text-xs text-foreground whitespace-nowrap">
          {trade.symbol.replace("USDT", "")}
        </td>
      )}
      <td className="px-2 py-1.5 font-mono text-[10px] text-muted-foreground whitespace-nowrap">
        {new Date(trade.signalTs).toLocaleDateString("ko-KR", {
          month: "short",
          day: "numeric",
        })}
      </td>
      <td className="px-2 py-1.5">
        {trade.win ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-neon-green" />
        ) : (
          <XCircle className="h-3.5 w-3.5 text-red-400" />
        )}
      </td>
      <td className="px-2 py-1.5 font-mono text-[10px]">
        <span
          className={cn(
            exitColors[trade.exitReason] ?? "text-muted-foreground"
          )}
        >
          {exitLabels[trade.exitReason] ?? trade.exitReason}
        </span>
      </td>
      <td className="px-2 py-1.5 font-mono text-xs">
        <span
          className={trade.returnPct >= 0 ? "text-neon-cyan" : "text-red-400"}
        >
          {trade.returnPct >= 0 ? "+" : ""}
          {trade.returnPct.toFixed(2)}%
        </span>
      </td>
      <td className="px-2 py-1.5 font-mono text-[10px] text-muted-foreground hidden sm:table-cell">
        RSI {trade.rsi.toFixed(1)}
      </td>
      <td className="px-2 py-1.5 font-mono text-[10px] text-muted-foreground hidden md:table-cell">
        ADX {trade.adx.toFixed(1)}
      </td>
      <td className="px-2 py-1.5 font-mono text-[10px] text-neon-yellow hidden md:table-cell">
        {trade.signalStrength.toFixed(0)}
      </td>
      <td className="px-2 py-1.5 font-mono text-[10px] text-muted-foreground hidden lg:table-cell">
        +{trade.maxFavorable.toFixed(2)}%
      </td>
      <td className="px-2 py-1.5 font-mono text-[10px] text-muted-foreground hidden lg:table-cell">
        -{trade.maxAdverse.toFixed(2)}%
      </td>
    </tr>
  );
}

export function TradeTable({
  trades,
  variant = "full",
  limit = 300,
}: TradeTableProps) {
  const showSymbol = variant === "full";
  const headers = showSymbol
    ? ["Symbol", "Date", "W/L", "Exit", "Return", "RSI", "ADX", "Strength", "MFE", "MAE"]
    : ["Date", "W/L", "Exit", "Return", "RSI", "ADX", "Strength", "MFE", "MAE"];

  if (trades.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="font-mono text-xs text-muted-foreground">
          시그널 없음
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto max-h-96 overflow-y-auto">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-background/90 backdrop-blur">
          <tr className="border-b border-border/20">
            {headers.map((h) => (
              <th
                key={h}
                className="px-2 py-2 text-left font-mono text-[10px] text-muted-foreground uppercase"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {trades.slice(0, limit).map((t, i) => (
            <TradeRow key={i} trade={t} showSymbol={showSymbol} />
          ))}
        </tbody>
      </table>
      {trades.length > limit && (
        <p className="font-mono text-[10px] text-muted-foreground text-center py-2">
          상위 {limit}건만 표시 · 전체 {trades.length}건
        </p>
      )}
    </div>
  );
}
