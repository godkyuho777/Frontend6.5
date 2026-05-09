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

  // ── v6.5 Phase 1: 진입 게이트 메타 + 부분 청산 ──
  patternConfluenceScore?: number;
  higherTfBullish?: boolean;
  partialExits?: Array<{
    tier: 1 | 2;
    candleOffset: number;
    price: number;
    ratio: number;
    returnPct: number;
  }>;
  target?: number;
  target2?: number;
  stopLoss?: number;

  // ── v6.5 Phase 2: Modifier multipliers ──
  emaRibbonMult?: number;
  macdDivergenceMult?: number;
  orderBlockMult?: number;
  modifiersProduct?: number;
  adjustedConfidence?: number;
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
    // v6.5 Phase 1: tiered exits
    tier2_full: "text-emerald-300",
    tier1_then_window: "text-cyan-300",
    tier1_then_stop: "text-orange-400",
  };
  const exitLabels: Record<string, string> = {
    target_hit: "T1 (legacy)",
    stop_loss: "STOP",
    window_expired: "EXPIRED",
    tier2_full: "T1+T2 ✓",
    tier1_then_window: "T1 + 만료",
    tier1_then_stop: "T1 + STOP",
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
      {/* v6.5 Phase 1: Pattern Confluence */}
      <td className="px-2 py-1.5 font-mono text-[10px] hidden lg:table-cell">
        {trade.patternConfluenceScore != null ? (
          <span
            className={cn(
              trade.patternConfluenceScore >= 0.6
                ? "text-emerald-300"
                : trade.patternConfluenceScore >= 0.4
                ? "text-neon-cyan"
                : "text-muted-foreground",
            )}
          >
            {(trade.patternConfluenceScore * 100).toFixed(0)}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      {/* v6.5 Phase 2: Modifiers Product */}
      <td className="px-2 py-1.5 font-mono text-[10px] hidden lg:table-cell">
        {trade.modifiersProduct != null ? (
          <span
            className={cn(
              trade.modifiersProduct >= 1.05
                ? "text-emerald-300"
                : trade.modifiersProduct < 0.95
                ? "text-red-300"
                : "text-muted-foreground",
            )}
          >
            ×{trade.modifiersProduct.toFixed(2)}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-2 py-1.5 font-mono text-[10px] text-muted-foreground hidden xl:table-cell">
        +{trade.maxFavorable.toFixed(2)}%
      </td>
      <td className="px-2 py-1.5 font-mono text-[10px] text-muted-foreground hidden xl:table-cell">
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
  // v6.5 Phase 1+2: Pattern Confluence (PC) + Modifier Product (Mod) 추가
  const headers = showSymbol
    ? ["Symbol", "Date", "W/L", "Exit", "Return", "RSI", "ADX", "Strength", "PC", "Mod", "MFE", "MAE"]
    : ["Date", "W/L", "Exit", "Return", "RSI", "ADX", "Strength", "PC", "Mod", "MFE", "MAE"];

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
