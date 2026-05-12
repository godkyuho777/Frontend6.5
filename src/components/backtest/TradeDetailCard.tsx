/**
 * Per-Trade Detail Card — Phase A-1 (2026-05-11)
 *
 * 사용자 요구 #1: "매매할 때마다 각 암호화폐 별로 진입 사유, 진입 가격,
 * 종료 가격 표시를 해주는 UI".
 *
 * 기존 TradeTable 은 컴팩트한 행 기반 — 한 화면에 많은 trade 보기에 최적.
 * 본 카드는 *각 trade 의 결정 맥락* 을 펼쳐 보여주는 카드 — 사용자가
 * trade 1건씩 깊이 검토할 때 사용.
 *
 * 표시 내용:
 *   - 심볼 + 일시 (진입 / 종료)
 *   - 진입 사유 (entryReasons 배열, bullet list)
 *   - 진입 가격 → Tier 1 / Tier 2 / Stop 표적
 *   - 종료 가격 + 종료 사유 + 수익률
 *   - 부분 청산 단계 (partialExits) 시각화
 *   - 시그널 강도 (signalStrength)
 */

import { CheckCircle2, XCircle, ArrowRight, Target, ShieldAlert, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TradeDetailData {
  symbol: string;
  signalTs: number;
  tf?: string;
  strategy?: string;
  side?: "long" | "short";
  entryReasons?: string[];
  entryPrice: number;
  target: number;
  target2?: number;
  stopLoss: number;
  exitPrice: number;
  exitTs: number;
  exitReason: string;
  returnPct: number;
  win: boolean;
  signalStrength: number;
  rsi: number;
  bbLower: number;
  bbMiddle: number;
  bbUpper: number;
  adx: number;
  plusDi: number;
  minusDi: number;
  partialExits?: Array<{
    tier: 1 | 2;
    candleOffset: number;
    price: number;
    ratio: number;
    returnPct: number;
  }>;
  patternConfluenceScore?: number;
  modifiersProduct?: number;
}

interface Props {
  trade: TradeDetailData;
  /** Compact 모드 — 핵심 정보만 (모바일/리스트뷰). */
  compact?: boolean;
}

const EXIT_LABEL: Record<string, string> = {
  target_hit: "Tier 1 도달",
  tier2_full: "Tier 1 + Tier 2 ✓",
  tier1_then_window: "Tier 1 + 윈도우 만료",
  tier1_then_stop: "Tier 1 + 손절",
  stop_loss: "손절 (Tier 1 도달 X)",
  window_expired: "윈도우 만료",
};

const EXIT_COLOR: Record<string, string> = {
  target_hit: "text-neon-green",
  tier2_full: "text-emerald-300",
  tier1_then_window: "text-cyan-300",
  tier1_then_stop: "text-orange-400",
  stop_loss: "text-red-400",
  window_expired: "text-neon-yellow",
};

function formatPrice(p: number): string {
  if (p === 0) return "—";
  if (p < 0.01) return p.toFixed(8);
  if (p < 1) return p.toFixed(6);
  if (p < 100) return p.toFixed(4);
  return p.toFixed(2);
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TradeDetailCard({ trade, compact }: Props) {
  const exitColor = EXIT_COLOR[trade.exitReason] ?? "text-muted-foreground";
  const exitLabel = EXIT_LABEL[trade.exitReason] ?? trade.exitReason;
  const isLong = trade.side !== "short";
  const sideColor = isLong ? "text-neon-cyan" : "text-neon-orange";

  return (
    <div
      className={cn(
        "rounded-md border p-3 transition-colors",
        trade.win
          ? "border-neon-green/30 bg-neon-green/5 hover:bg-neon-green/10"
          : "border-red-500/30 bg-red-500/5 hover:bg-red-500/10",
      )}
    >
      {/* Header — Symbol + Side + Date + Win/Loss */}
      <div className="flex items-baseline justify-between gap-2 flex-wrap mb-2">
        <div className="flex items-baseline gap-2">
          <span className="font-display font-bold text-base text-foreground">
            {trade.symbol.replace("USDT", "")}
          </span>
          <span className={cn("font-mono text-[10px] uppercase", sideColor)}>
            {isLong ? "LONG" : "SHORT"}
          </span>
          {trade.strategy && (
            <span className="font-mono text-[10px] text-muted-foreground">
              {trade.strategy}
            </span>
          )}
          {trade.tf && (
            <span className="font-mono text-[10px] text-muted-foreground">
              {trade.tf}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "font-display font-bold text-sm",
              trade.returnPct >= 0 ? "text-neon-green" : "text-red-400",
            )}
          >
            {trade.returnPct >= 0 ? "+" : ""}
            {trade.returnPct.toFixed(2)}%
          </span>
          {trade.win ? (
            <CheckCircle2 className="h-4 w-4 text-neon-green" />
          ) : (
            <XCircle className="h-4 w-4 text-red-400" />
          )}
        </div>
      </div>

      {/* Date row */}
      <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground mb-2">
        <Clock className="h-3 w-3" />
        <span>진입 {formatDate(trade.signalTs)}</span>
        <ArrowRight className="h-3 w-3" />
        <span>종료 {formatDate(trade.exitTs)}</span>
      </div>

      {/* Price flow: entry → target / stop → exit */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3 text-[10px]">
        <div className="rounded border border-neon-cyan/20 bg-neon-cyan/5 p-2">
          <div className="font-mono text-[9px] uppercase text-muted-foreground">진입가</div>
          <div className="font-display font-bold text-sm text-neon-cyan">
            ${formatPrice(trade.entryPrice)}
          </div>
        </div>
        <div className="rounded border border-neon-green/20 bg-neon-green/5 p-2">
          <div className="font-mono text-[9px] uppercase text-muted-foreground flex items-center gap-1">
            <Target className="h-2.5 w-2.5" /> Tier 1
          </div>
          <div className="font-display text-sm text-neon-green">
            ${formatPrice(trade.target)}
          </div>
        </div>
        {trade.target2 != null && (
          <div className="rounded border border-emerald-400/20 bg-emerald-500/5 p-2">
            <div className="font-mono text-[9px] uppercase text-muted-foreground flex items-center gap-1">
              <Target className="h-2.5 w-2.5" /> Tier 2
            </div>
            <div className="font-display text-sm text-emerald-300">
              ${formatPrice(trade.target2)}
            </div>
          </div>
        )}
        <div className="rounded border border-red-500/20 bg-red-500/5 p-2">
          <div className="font-mono text-[9px] uppercase text-muted-foreground flex items-center gap-1">
            <ShieldAlert className="h-2.5 w-2.5" /> Stop
          </div>
          <div className="font-display text-sm text-red-400">
            ${formatPrice(trade.stopLoss)}
          </div>
        </div>
      </div>

      {/* Exit row */}
      <div className="flex items-baseline justify-between gap-2 mb-3 pb-3 border-b border-border/20">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[10px] uppercase text-muted-foreground">종료</span>
          <span className="font-display font-bold text-sm text-foreground">
            ${formatPrice(trade.exitPrice)}
          </span>
          <span className={cn("font-mono text-[10px] uppercase", exitColor)}>
            ({exitLabel})
          </span>
        </div>
        <span className="font-mono text-[10px] text-neon-yellow">
          강도 {trade.signalStrength.toFixed(0)}/100
        </span>
      </div>

      {/* Entry reasons (사용자 요구 핵심!) */}
      {trade.entryReasons && trade.entryReasons.length > 0 && (
        <div className="mb-3">
          <div className="font-mono text-[10px] uppercase text-muted-foreground mb-1">
            진입 사유
          </div>
          <ul className="space-y-1">
            {trade.entryReasons.map((reason, i) => (
              <li
                key={i}
                className="font-mono text-[11px] text-foreground flex items-start gap-2"
              >
                <span className="text-neon-cyan mt-0.5">▸</span>
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Partial exits 시각화 */}
      {trade.partialExits && trade.partialExits.length > 0 && (
        <div className="mb-3">
          <div className="font-mono text-[10px] uppercase text-muted-foreground mb-1">
            부분 청산 단계
          </div>
          <div className="space-y-1">
            {trade.partialExits.map((p, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-2 text-[10px] font-mono"
              >
                <span
                  className={cn(
                    "px-1.5 py-0.5 rounded border",
                    p.tier === 1
                      ? "border-neon-cyan/40 text-neon-cyan"
                      : "border-emerald-400/40 text-emerald-300",
                  )}
                >
                  Tier {p.tier} · {(p.ratio * 100).toFixed(0)}%
                </span>
                <span className="text-muted-foreground">
                  +{p.candleOffset} 캔들 후
                </span>
                <span className="text-foreground">
                  ${formatPrice(p.price)}
                </span>
                <span
                  className={
                    p.returnPct >= 0 ? "text-neon-green" : "text-red-400"
                  }
                >
                  {p.returnPct >= 0 ? "+" : ""}
                  {p.returnPct.toFixed(2)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Indicators footer (compact 모드에서는 숨김) */}
      {!compact && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-[10px] font-mono text-muted-foreground pt-2 border-t border-border/20">
          <div>RSI <span className="text-foreground">{trade.rsi.toFixed(1)}</span></div>
          <div>ADX <span className="text-foreground">{trade.adx.toFixed(1)}</span></div>
          <div>+DI <span className="text-foreground">{trade.plusDi.toFixed(1)}</span></div>
          <div>-DI <span className="text-foreground">{trade.minusDi.toFixed(1)}</span></div>
          {trade.patternConfluenceScore != null && (
            <div>
              PC{" "}
              <span
                className={cn(
                  trade.patternConfluenceScore >= 0.4
                    ? "text-neon-cyan"
                    : "text-muted-foreground",
                )}
              >
                {(trade.patternConfluenceScore * 100).toFixed(0)}
              </span>
            </div>
          )}
          {trade.modifiersProduct != null && (
            <div>
              Mod{" "}
              <span
                className={cn(
                  trade.modifiersProduct >= 1.05
                    ? "text-emerald-300"
                    : trade.modifiersProduct < 0.95
                      ? "text-red-300"
                      : "text-foreground",
                )}
              >
                ×{trade.modifiersProduct.toFixed(2)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface ListProps {
  trades: TradeDetailData[];
  limit?: number;
  compact?: boolean;
}

export function TradeDetailCardList({ trades, limit = 50, compact }: ListProps) {
  if (trades.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="font-mono text-xs text-muted-foreground">
          시그널 없음 — 백테스트 실행 후 확인하세요.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {trades.slice(0, limit).map((t, i) => (
        <TradeDetailCard key={`${t.symbol}-${t.signalTs}-${i}`} trade={t} compact={compact} />
      ))}
      {trades.length > limit && (
        <p className="font-mono text-[10px] text-muted-foreground text-center py-3">
          상위 {limit}건 표시 · 전체 {trades.length}건
        </p>
      )}
    </div>
  );
}
