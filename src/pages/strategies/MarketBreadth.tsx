import { HudPanel } from "@/components/HudPanel";
import { CharterFooter } from "@/components/strategies/CharterFooter";
import { MultiplierChip } from "@/components/strategies/MultiplierChip";
import { StatusBadge } from "@/components/strategies/StatusBadge";
import {
  StrategyHeader,
  type StrategyTf,
} from "@/components/strategies/StrategyHeader";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { useState } from "react";

const SENTIMENT_META: Record<
  string,
  {
    label: string;
    color: string;
    bg: string;
    border: string;
    description: string;
  }
> = {
  panic: {
    label: "PANIC",
    color: "text-neon-red",
    bg: "bg-neon-red/15",
    border: "border-neon-red/50",
    description: "RSI<30 비율 60% 초과 — LONG 가산 (역행 베팅)",
  },
  fear: {
    label: "FEAR",
    color: "text-rose-300",
    bg: "bg-rose-500/15",
    border: "border-rose-500/40",
    description: "RSI<30 비율 30% 초과 — LONG 약가산",
  },
  neutral: {
    label: "NEUTRAL",
    color: "text-muted-foreground",
    bg: "bg-muted/20",
    border: "border-muted-foreground/30",
    description: "균형 — multiplier 1.0",
  },
  greed: {
    label: "GREED",
    color: "text-orange-300",
    bg: "bg-orange-500/15",
    border: "border-orange-500/40",
    description: "RSI>70 비율 30% 초과 — LONG 약차감",
  },
  euphoria: {
    label: "EUPHORIA",
    color: "text-fuchsia-300",
    bg: "bg-fuchsia-500/20",
    border: "border-fuchsia-500/50",
    description: "RSI>70 비율 50% 초과 — 천장 근접, LONG 약화",
  },
};

interface BarRowProps {
  label: string;
  value: number; // 0~1 비율
  total: number;
  color: string; // tailwind bg color
  hint?: string;
}

function BarRow({ label, value, total, color, hint }: BarRowProps) {
  const pct = Math.min(100, Math.max(0, value * 100));
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between font-mono text-[11px]">
        <span className="text-muted-foreground uppercase tracking-wider">
          {label}
        </span>
        <span className="text-foreground">
          {pct.toFixed(1)}%{" "}
          <span className="text-muted-foreground">
            ({Math.round(value * total)}/{total})
          </span>
        </span>
      </div>
      <div className="h-3 w-full bg-card/40 border border-border/40 rounded-sm overflow-hidden">
        <div
          className={cn("h-full transition-all", color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      {hint && (
        <p className="text-[10px] text-muted-foreground/70 font-mono">{hint}</p>
      )}
    </div>
  );
}

export default function MarketBreadth() {
  // Market Breadth 는 universe 전체 — symbol 입력 불필요.
  const [tf, setTf] = useState<StrategyTf>("4h");

  const query = trpc.modifiers.marketBreadth.useQuery(
    { tf },
    {
      staleTime: 5 * 60_000, // 5분 캐시 (백엔드와 동일)
      retry: 1,
      refetchOnWindowFocus: false,
    }
  );

  const result = query.data;
  const meta = result ? SENTIMENT_META[result.sentiment] : null;

  return (
    <div className="space-y-4 max-w-5xl">
      <StrategyHeader
        title="Market Breadth"
        subtitle="96 코인 universe 일괄 RSI 분포 → 5단계 sentiment (역행 베팅)"
        dimension={6}
        symbol=""
        tf={tf}
        onSymbolChange={() => {}}
        onTfChange={setTf}
        showSymbolInput={false}
      />

      {query.isLoading && (
        <HudPanel>
          <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="font-mono text-xs">
              Scanning universe (~3s, 96 coins)…
            </span>
          </div>
        </HudPanel>
      )}

      {query.isError && (
        <HudPanel variant="danger">
          <p className="text-xs text-neon-red font-mono">
            Error: {query.error.message}
          </p>
        </HudPanel>
      )}

      {result && meta && (
        <>
          <HudPanel
            title="Sentiment Regime"
            subtitle={`tf=${tf} · ${result.breakdown.totalCoins} coins`}
            variant="highlight"
            headerRight={
              <StatusBadge status={result.status} errorDetail={result.errorDetail} />
            }
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
              <div className="space-y-3">
                <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                  Multiplier
                </div>
                <MultiplierChip multiplier={result.multiplier} size="lg" />

                <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mt-3">
                  Sentiment
                </div>
                <span
                  className={cn(
                    "inline-flex items-center px-4 py-2 border rounded-sm font-display text-lg font-bold tracking-wider",
                    meta.color,
                    meta.bg,
                    meta.border
                  )}
                >
                  {meta.label}
                </span>
                <p className="text-xs text-muted-foreground font-mono mt-2">
                  {meta.description}
                </p>
              </div>

              <div className="space-y-3">
                <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-2">
                  Universe Breakdown
                </div>
                <BarRow
                  label="RSI < 30 (Oversold)"
                  value={result.breakdown.rsiBelow30Pct}
                  total={result.breakdown.totalCoins}
                  color="bg-neon-red/70"
                />
                <BarRow
                  label="RSI > 70 (Overbought)"
                  value={result.breakdown.rsiAbove70Pct}
                  total={result.breakdown.totalCoins}
                  color="bg-orange-400/70"
                />
                <BarRow
                  label="EMA200 위 (Bullish trend)"
                  value={result.breakdown.aboveEMA200Pct}
                  total={result.breakdown.totalCoins}
                  color="bg-neon-green/70"
                />
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-border/30">
              <p className="text-xs text-muted-foreground font-mono">
                <span className="text-neon-cyan">REASON:</span> {result.reason}
              </p>
            </div>
          </HudPanel>

          <HudPanel title="Contrarian Logic" subtitle="역행 베팅 가중 정책">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-2 text-[11px] font-mono">
              {(
                [
                  ["panic", "1.30 ×", "LONG +30%"],
                  ["fear", "1.10 ×", "LONG +10%"],
                  ["neutral", "1.00 ×", "—"],
                  ["greed", "0.90 ×", "LONG -10%"],
                  ["euphoria", "0.60 ×", "LONG -40%"],
                ] as const
              ).map(([key, mult, effect]) => {
                const m = SENTIMENT_META[key];
                const isCurrent = result.sentiment === key;
                return (
                  <div
                    key={key}
                    className={cn(
                      "p-2 border rounded-sm",
                      isCurrent
                        ? `${m.bg} ${m.border}`
                        : "border-border/30 bg-card/20 opacity-60"
                    )}
                  >
                    <div className={cn("font-display text-xs uppercase", m.color)}>
                      {m.label}
                    </div>
                    <div className="text-foreground mt-1">{mult}</div>
                    <div className="text-muted-foreground text-[10px]">
                      {effect}
                    </div>
                  </div>
                );
              })}
            </div>
          </HudPanel>
        </>
      )}

      <CharterFooter />
    </div>
  );
}
