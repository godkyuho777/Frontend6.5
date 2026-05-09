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
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const TYPE_META: Record<
  string,
  { label: string; color: string; bg: string; border: string; desc: string }
> = {
  bullish: {
    label: "BULLISH DIV",
    color: "text-neon-green",
    bg: "bg-neon-green/15",
    border: "border-neon-green/50",
    desc: "가격 LL + Hist HL — 모멘텀 약화 후 반등 가능",
  },
  hidden_bullish: {
    label: "HIDDEN BULL",
    color: "text-emerald-300",
    bg: "bg-emerald-500/15",
    border: "border-emerald-500/40",
    desc: "가격 HL + Hist LL — trend continuation",
  },
  bearish: {
    label: "BEARISH DIV",
    color: "text-neon-red",
    bg: "bg-neon-red/15",
    border: "border-neon-red/50",
    desc: "가격 HH + Hist LH — 모멘텀 소진",
  },
  hidden_bearish: {
    label: "HIDDEN BEAR",
    color: "text-rose-300",
    bg: "bg-rose-500/15",
    border: "border-rose-500/40",
    desc: "가격 LH + Hist HH — downtrend continuation",
  },
  none: {
    label: "NONE",
    color: "text-muted-foreground",
    bg: "bg-muted/20",
    border: "border-muted-foreground/30",
    desc: "다이버전스 미감지",
  },
};

export default function MacdDivergence() {
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [tf, setTf] = useState<StrategyTf>("4h");

  const query = trpc.modifiers.macdDivergence.useQuery(
    { symbol, tf, lookback: 50 },
    {
      enabled: !!symbol,
      staleTime: 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    }
  );

  const result = query.data;
  const meta = result ? TYPE_META[result.type] : null;

  // Hist swing chart 데이터 — 인덱스 vs hist 값
  const swingData = result
    ? result.swings.histAtSwings.map((v, i) => ({
        idx: `s${i + 1}`,
        hist: Number.isFinite(v) ? v : 0,
      }))
    : [];

  return (
    <div className="space-y-4 max-w-6xl">
      <StrategyHeader
        title="MACD Divergence"
        subtitle="MACD(12,26,9) histogram swing vs 가격 swing 비교 — 1차원 모멘텀"
        dimension={1}
        symbol={symbol}
        tf={tf}
        onSymbolChange={setSymbol}
        onTfChange={setTf}
      />

      {query.isLoading && (
        <HudPanel>
          <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="font-mono text-xs">Detecting MACD divergence…</span>
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
            title="Divergence Detection"
            subtitle={`${symbol} · ${tf} · lookback=50`}
            variant="highlight"
            headerRight={
              <StatusBadge status={result.status} errorDetail={result.errorDetail} />
            }
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                  Multiplier
                </div>
                <MultiplierChip multiplier={result.multiplier} size="lg" />
              </div>

              <div className="space-y-2">
                <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                  Type
                </div>
                <span
                  className={cn(
                    "inline-flex items-center px-3 py-2 border rounded-sm font-display text-base font-bold tracking-wider",
                    meta.color,
                    meta.bg,
                    meta.border
                  )}
                >
                  {meta.label}
                </span>
                <p className="text-[11px] text-muted-foreground font-mono">
                  {meta.desc}
                </p>
              </div>

              <div className="space-y-2">
                <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                  Strength
                </div>
                <div className="space-y-1">
                  <div className="font-mono text-lg text-neon-cyan">
                    {(result.strength * 100).toFixed(1)}%
                  </div>
                  <div className="h-3 w-full bg-card/40 border border-border/40 rounded-sm overflow-hidden">
                    <div
                      className={cn(
                        "h-full transition-all",
                        result.strength > 0.5
                          ? "bg-neon-cyan"
                          : "bg-neon-cyan/40"
                      )}
                      style={{
                        width: `${Math.min(100, result.strength * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-border/30">
              <p className="text-xs text-muted-foreground font-mono">
                <span className="text-neon-cyan">REASON:</span> {result.reason}
              </p>
            </div>
          </HudPanel>

          <HudPanel title="Swing Indices" subtitle="lookback 윈도우 내 탐지된 swing">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-mono">
              <div className="hud-frame p-3">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                  Price Swing Highs (idx)
                </div>
                <div className="text-neon-red">
                  {result.swings.priceSwingHighIdxs.length === 0
                    ? "—"
                    : result.swings.priceSwingHighIdxs.join(", ")}
                </div>
              </div>
              <div className="hud-frame p-3">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                  Price Swing Lows (idx)
                </div>
                <div className="text-neon-green">
                  {result.swings.priceSwingLowIdxs.length === 0
                    ? "—"
                    : result.swings.priceSwingLowIdxs.join(", ")}
                </div>
              </div>
              <div className="hud-frame p-3">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                  Hist at Swings
                </div>
                <div className="text-neon-cyan">
                  {result.swings.histAtSwings.length === 0
                    ? "—"
                    : result.swings.histAtSwings
                        .map((v) => v.toFixed(4))
                        .join(", ")}
                </div>
              </div>
            </div>
          </HudPanel>

          {swingData.length > 0 && (
            <HudPanel
              title="Histogram at Swing Points"
              subtitle="MACD histogram value at detected swings"
            >
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={swingData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid stroke="oklch(0.3 0.02 280 / 0.2)" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="idx"
                    stroke="oklch(0.7 0.02 280)"
                    tick={{ fontFamily: "Share Tech Mono", fontSize: 11 }}
                  />
                  <YAxis
                    stroke="oklch(0.7 0.02 280)"
                    tick={{ fontFamily: "Share Tech Mono", fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "oklch(0.15 0.02 280 / 0.95)",
                      border: "1px solid oklch(0.6 0.2 200 / 0.4)",
                      fontFamily: "Share Tech Mono",
                      fontSize: 11,
                    }}
                  />
                  <Bar
                    dataKey="hist"
                    fill="oklch(0.7 0.2 200)"
                    radius={[2, 2, 0, 0]}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </HudPanel>
          )}
        </>
      )}

      <CharterFooter
        extraNote="MACD Divergence 는 RSI 와 동일한 1차원 momentum 이지만 측정 각도가 다름 — 헌장 규칙 1 예외 (rule1Exempt)."
      />
    </div>
  );
}
