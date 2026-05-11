import { HudPanel } from "@/components/HudPanel";
import { CharterFooter } from "@/components/strategies/CharterFooter";
import { MultiplierChip } from "@/components/strategies/MultiplierChip";
import { StatusBadge } from "@/components/strategies/StatusBadge";
import {
  StrategyHeader,
  type StrategyTf,
} from "@/components/strategies/StrategyHeader";
import { TrackerBreadcrumb } from "@/components/trackers/TrackerBreadcrumb";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp, Loader2, TrendingUp } from "lucide-react";
import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const ALIGNMENT_META: Record<
  string,
  { label: string; color: string; bg: string; border: string }
> = {
  strong_bull: {
    label: "STRONG BULL",
    color: "text-neon-green",
    bg: "bg-neon-green/15",
    border: "border-neon-green/50",
  },
  weak_bull: {
    label: "WEAK BULL",
    color: "text-emerald-300",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
  },
  neutral: {
    label: "NEUTRAL",
    color: "text-muted-foreground",
    bg: "bg-muted/20",
    border: "border-muted-foreground/30",
  },
  weak_bear: {
    label: "WEAK BEAR",
    color: "text-rose-300",
    bg: "bg-rose-500/10",
    border: "border-rose-500/30",
  },
  strong_bear: {
    label: "STRONG BEAR",
    color: "text-neon-red",
    bg: "bg-neon-red/15",
    border: "border-neon-red/50",
  },
};

const EMA_LABELS: Array<{ key: keyof EmaSnapshot; label: string }> = [
  { key: "ema9", label: "EMA 9" },
  { key: "ema21", label: "EMA 21" },
  { key: "ema50", label: "EMA 50" },
  { key: "ema100", label: "EMA 100" },
  { key: "ema200", label: "EMA 200" },
];

type EmaSnapshot = {
  ema9: number;
  ema21: number;
  ema50: number;
  ema100: number;
  ema200: number;
};

export default function EmaRibbon() {
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [tf, setTf] = useState<StrategyTf>("4h");

  const query = trpc.modifiers.emaRibbon.useQuery(
    { symbol, tf },
    {
      enabled: !!symbol,
      staleTime: 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    }
  );

  const result = query.data;
  const meta = result ? ALIGNMENT_META[result.alignment] : null;

  // EMA 값을 단순 line chart 로 — 5개 점을 가로축에 배치 (period order).
  const emaChartData = result
    ? EMA_LABELS.map((e) => ({
        period: e.label,
        value: result.emas[e.key],
      }))
    : [];

  const expansionPct = result ? result.expansion * 100 : 0;
  const isExpanding = expansionPct > 0;

  return (
    <div className="space-y-4 max-w-6xl">
      <TrackerBreadcrumb
        layer="wave"
        modifierName="EMA Ribbon"
        dimensions={[3]}
      />
      <StrategyHeader
        title="EMA Ribbon"
        subtitle="EMA(9, 21, 50, 100, 200) 정렬 + ribbon expansion 으로 추세 건강도 측정"
        dimension={3}
        symbol={symbol}
        tf={tf}
        onSymbolChange={setSymbol}
        onTfChange={setTf}
      />

      {query.isLoading && (
        <HudPanel>
          <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="font-mono text-xs">Computing EMA ribbon…</span>
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
          {/* Top summary card */}
          <HudPanel
            title="Ribbon Summary"
            subtitle={`${symbol} · ${tf}`}
            variant="highlight"
            headerRight={<StatusBadge status={result.status} errorDetail={result.errorDetail} />}
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
                  Alignment
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
              </div>

              <div className="space-y-2">
                <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                  Expansion
                </div>
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-2 border rounded-sm font-mono text-sm",
                    isExpanding
                      ? "text-neon-green border-neon-green/40 bg-neon-green/10"
                      : "text-neon-red border-neon-red/40 bg-neon-red/10"
                  )}
                >
                  {isExpanding ? (
                    <ArrowUp className="h-3.5 w-3.5" />
                  ) : (
                    <ArrowDown className="h-3.5 w-3.5" />
                  )}
                  {isExpanding ? "+" : ""}
                  {expansionPct.toFixed(2)}%{" "}
                  <span className="text-[10px] text-muted-foreground">
                    {isExpanding ? "EXPANDING" : "CONTRACTING"}
                  </span>
                </span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-border/30">
              <p className="text-xs text-muted-foreground font-mono">
                <span className="text-neon-cyan">REASON:</span> {result.reason}
              </p>
            </div>
          </HudPanel>

          {/* EMA values table */}
          <HudPanel title="EMA Values" subtitle="period ascending">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {EMA_LABELS.map((e, i) => {
                const value = result.emas[e.key];
                // 정렬 등급: ema9 가 가장 높을수록 perfect bull → 초록 그라데이션
                const intensity = result.alignment.includes("bull")
                  ? "text-neon-green"
                  : result.alignment.includes("bear")
                    ? "text-neon-red"
                    : "text-neon-cyan";
                return (
                  <div
                    key={e.key}
                    className="hud-frame p-3 flex flex-col gap-1"
                    style={{ opacity: 1 - i * 0.08 }}
                  >
                    <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                      {e.label}
                    </div>
                    <div
                      className={cn("font-mono text-sm font-semibold", intensity)}
                    >
                      $
                      {value.toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </HudPanel>

          {/* Chart — EMA snapshot bar */}
          <HudPanel
            title="Ribbon Snapshot"
            subtitle="period vs EMA value (현재 캔들 기준)"
            headerRight={
              <Badge
                variant="outline"
                className="font-mono text-[10px] border-neon-cyan/40 text-neon-cyan"
              >
                <TrendingUp className="h-3 w-3 mr-1" />
                {result.alignment.toUpperCase()}
              </Badge>
            }
          >
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={emaChartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid stroke="oklch(0.3 0.02 280 / 0.2)" strokeDasharray="3 3" />
                <XAxis
                  dataKey="period"
                  stroke="oklch(0.7 0.02 280)"
                  tick={{ fontFamily: "Share Tech Mono", fontSize: 11 }}
                />
                <YAxis
                  stroke="oklch(0.7 0.02 280)"
                  tick={{ fontFamily: "Share Tech Mono", fontSize: 11 }}
                  domain={["auto", "auto"]}
                />
                <Tooltip
                  contentStyle={{
                    background: "oklch(0.15 0.02 280 / 0.95)",
                    border: "1px solid oklch(0.6 0.2 200 / 0.4)",
                    fontFamily: "Share Tech Mono",
                    fontSize: 11,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="oklch(0.75 0.2 200)"
                  strokeWidth={2}
                  dot={{ r: 4, fill: "oklch(0.75 0.2 200)" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </HudPanel>
        </>
      )}

      <CharterFooter />
    </div>
  );
}
