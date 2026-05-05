import { useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
  Bar,
  ResponsiveContainer,
  Tooltip as RTooltip,
} from "recharts";
import { Loader2, RefreshCw, Waves } from "lucide-react";

import { HudPanel, StatCard } from "@/components/HudPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCoinDetail } from "@/hooks/useMarketData";
import { cn } from "@/lib/utils";
import { TOP_COINS } from "@shared/types";
import type { Candle, TimeframeValue } from "@shared/types";

// Spec timeframes: 1W / 1D / 4H / 1H
type WaveTimeframe = Extract<TimeframeValue, "1h" | "4h" | "1d" | "1w">;

const WAVE_TIMEFRAMES: { label: string; value: WaveTimeframe }[] = [
  { label: "1H", value: "1h" },
  { label: "4H", value: "4h" },
  { label: "1D", value: "1d" },
  { label: "1W", value: "1w" },
];

// 10 Fibonacci ratios (retracement + extensions) — per spec.
const FIB_RATIOS = [
  { ratio: 0, label: "0.0%", color: "oklch(0.5 0.02 260)" },
  { ratio: 0.236, label: "23.6%", color: "oklch(0.65 0.18 235)" },
  { ratio: 0.382, label: "38.2%", color: "oklch(0.65 0.18 235)" },
  { ratio: 0.5, label: "50.0%", color: "oklch(0.7 0.22 305)" },
  { ratio: 0.618, label: "61.8%", color: "oklch(0.65 0.18 235)" },
  { ratio: 0.786, label: "78.6%", color: "oklch(0.65 0.18 235)" },
  { ratio: 1.0, label: "100.0%", color: "oklch(0.5 0.02 260)" },
  { ratio: 1.272, label: "127.2%", color: "oklch(0.7 0.18 60)" },
  { ratio: 1.618, label: "161.8%", color: "oklch(0.7 0.18 60)" },
  { ratio: 2.618, label: "261.8%", color: "oklch(0.65 0.25 25)" },
] as const;

type FibLevel = {
  ratio: number;
  label: string;
  price: number;
  color: string;
};

type TrendlineComputed = {
  type: "support" | "resistance";
  startIdx: number;
  endIdx: number;
  startPrice: number;
  endPrice: number;
  slope: number;
  /** percentage of candles touching the line */
  strength: number;
};

function computeFibLevels(low: number, high: number): FibLevel[] {
  const range = high - low;
  return FIB_RATIOS.map((f) => ({
    ratio: f.ratio,
    label: f.label,
    color: f.color,
    price: low + range * f.ratio,
  }));
}

/**
 * Build the chart data table — one row per candle, joining trendline
 * prices computed from each line's slope/intercept.
 */
function buildChartData(
  candles: Candle[],
  upTrend: TrendlineComputed | null,
  downTrend: TrendlineComputed | null
) {
  return candles.map((c, i) => ({
    idx: i,
    time: c.openTime,
    timeLabel: formatTime(c.openTime),
    close: c.close,
    high: c.high,
    low: c.low,
    open: c.open,
    volume: c.volume,
    upTrend: upTrend
      ? upTrend.startPrice + upTrend.slope * (i - upTrend.startIdx)
      : null,
    downTrend: downTrend
      ? downTrend.startPrice + downTrend.slope * (i - downTrend.startIdx)
      : null,
  }));
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(
    2,
    "0"
  )}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatPrice(p: number): string {
  if (p === 0) return "—";
  return p < 1 ? p.toFixed(6) : p < 100 ? p.toFixed(4) : p.toFixed(2);
}

/**
 * Convert the indicator-pipeline trendline format (2 time-anchored points)
 * into a candle-index-anchored line with strength. Walks the candle array
 * and counts touches within ±0.5%.
 */
function resolveTrendline(
  candles: Candle[],
  raw: { type: "support" | "resistance"; points: { time: number; price: number }[] }
): TrendlineComputed | null {
  if (raw.points.length < 2 || candles.length === 0) return null;
  const sorted = [...raw.points].sort((a, b) => a.time - b.time);
  const start = sorted[0];
  const end = sorted[sorted.length - 1];

  const findIdx = (time: number): number => {
    let best = 0;
    let bestDiff = Math.abs(candles[0].openTime - time);
    for (let i = 1; i < candles.length; i++) {
      const d = Math.abs(candles[i].openTime - time);
      if (d < bestDiff) {
        bestDiff = d;
        best = i;
      }
    }
    return best;
  };

  const startIdx = findIdx(start.time);
  const endIdx = findIdx(end.time);
  if (endIdx === startIdx) return null;
  const slope = (end.price - start.price) / (endIdx - startIdx);

  // Strength = candles touching the line within 0.5% / total candles
  const tolerance = 0.005;
  let touches = 0;
  for (let i = 0; i < candles.length; i++) {
    const linePrice = start.price + slope * (i - startIdx);
    if (linePrice <= 0) continue;
    const c = candles[i];
    if (raw.type === "support") {
      // Touch if low is within tolerance of line
      if (Math.abs(c.low - linePrice) / linePrice <= tolerance) touches++;
    } else {
      if (Math.abs(c.high - linePrice) / linePrice <= tolerance) touches++;
    }
  }
  const strength = (touches / candles.length) * 100;

  return {
    type: raw.type,
    startIdx,
    endIdx,
    startPrice: start.price,
    endPrice: end.price,
    slope,
    strength,
  };
}

function strengthLabel(s: number): { label: string; color: string } {
  if (s >= 70) return { label: "매우 강함", color: "text-neon-green" };
  if (s >= 60) return { label: "강함", color: "text-neon-cyan" };
  if (s >= 50) return { label: "중간", color: "text-neon-yellow" };
  if (s >= 40) return { label: "약함", color: "text-muted-foreground" };
  return { label: "매우 약함", color: "text-muted-foreground/50" };
}

export default function WaveTrend() {
  const [symbolInput, setSymbolInput] = useState("BTCUSDT");
  const [symbol, setSymbol] = useState<string>("BTCUSDT");
  const [interval, setSelectedInterval] = useState<WaveTimeframe>("4h");

  const { data: detail, isLoading, error } = useCoinDetail(symbol, interval, 120);
  const candles = detail?.candles ?? [];
  const indicators = detail?.indicators;

  // ─── Fibonacci levels ──────────────────────────────────────────────
  const { fibLow, fibHigh, fibLevels } = useMemo(() => {
    if (candles.length === 0) {
      return { fibLow: 0, fibHigh: 0, fibLevels: [] as FibLevel[] };
    }
    const highs = candles.map((c) => c.high);
    const lows = candles.map((c) => c.low);
    const high = Math.max(...highs);
    const low = Math.min(...lows);
    return {
      fibLow: low,
      fibHigh: high,
      fibLevels: computeFibLevels(low, high),
    };
  }, [candles]);

  // ─── Trendlines (resolved + strength) ──────────────────────────────
  const { upTrend, downTrend } = useMemo(() => {
    const tls = indicators?.trendlines ?? [];
    const support = tls.find((t) => t.type === "support");
    const resistance = tls.find((t) => t.type === "resistance");
    return {
      upTrend: support ? resolveTrendline(candles, support) : null,
      downTrend: resistance ? resolveTrendline(candles, resistance) : null,
    };
  }, [candles, indicators]);

  // ─── Chart data ────────────────────────────────────────────────────
  const chartData = useMemo(
    () => buildChartData(candles, upTrend, downTrend),
    [candles, upTrend, downTrend]
  );

  // ─── Trade signals ─────────────────────────────────────────────────
  const tradeSignals = useMemo(() => {
    if (!detail || candles.length === 0) {
      return { buy: [], sell: [], buyStrength: 0, sellStrength: 0 };
    }
    const last = candles[candles.length - 1];
    const price = last.close;
    const fib = fibLevels;
    const fib382 = fib.find((f) => f.ratio === 0.382);
    const fib618 = fib.find((f) => f.ratio === 0.618);
    const fib1618 = fib.find((f) => f.ratio === 1.618);
    const fib0 = fib.find((f) => f.ratio === 0);

    // Volume change (last 5 vs prior 20)
    const recent = candles.slice(-5);
    const prior = candles.slice(-25, -5);
    const recentAvg =
      recent.length > 0
        ? recent.reduce((a, c) => a + c.volume, 0) / recent.length
        : 0;
    const priorAvg =
      prior.length > 0 ? prior.reduce((a, c) => a + c.volume, 0) / prior.length : 1;
    const volChangePct =
      priorAvg > 0 ? ((recentAvg - priorAvg) / priorAvg) * 100 : 0;

    const buy: { ok: boolean; label: string }[] = [];
    const sell: { ok: boolean; label: string }[] = [];

    if (fib382 && fib618) {
      const inGoldenZone = price >= fib382.price && price <= fib618.price;
      buy.push({ ok: inGoldenZone, label: "황금비 38.2~61.8% 구간" });
    }
    if (upTrend) {
      // Current line price at last index
      const linePrice =
        upTrend.startPrice + upTrend.slope * (candles.length - 1 - upTrend.startIdx);
      buy.push({
        ok: price >= linePrice,
        label: `상승 추세선 지지 (강도 ${upTrend.strength.toFixed(0)}%)`,
      });
    } else {
      buy.push({ ok: false, label: "상승 추세선 미감지" });
    }
    buy.push({ ok: volChangePct > 10, label: `거래량 +${volChangePct.toFixed(0)}% (≥ +10% 필요)` });

    if (fib1618) {
      sell.push({ ok: price >= fib1618.price, label: "Fib 161.8% 도달" });
    }
    if (downTrend) {
      const linePrice =
        downTrend.startPrice +
        downTrend.slope * (candles.length - 1 - downTrend.startIdx);
      sell.push({
        ok: price >= linePrice,
        label: `하락 추세선 저항 (강도 ${downTrend.strength.toFixed(0)}%)`,
      });
    } else {
      sell.push({ ok: false, label: "하락 추세선 미감지" });
    }
    if (fib0) {
      sell.push({
        ok: price <= fib0.price * 1.005,
        label: "Fib 0% 이하 (붕괴 신호)",
      });
    }

    const buyStrength = (buy.filter((b) => b.ok).length / Math.max(1, buy.length)) * 100;
    const sellStrength =
      (sell.filter((s) => s.ok).length / Math.max(1, sell.length)) * 100;
    return { buy, sell, buyStrength, sellStrength };
  }, [detail, candles, fibLevels, upTrend, downTrend]);

  const lastCandle = candles[candles.length - 1];
  const currentPrice = lastCandle?.close ?? 0;
  const tfLabel =
    WAVE_TIMEFRAMES.find((t) => t.value === interval)?.label ?? interval;

  const handleSymbolSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = symbolInput.trim().toUpperCase();
    if (trimmed) setSymbol(trimmed.endsWith("USDT") ? trimmed : `${trimmed}USDT`);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-wider text-neon-pink glow-pink flex items-center gap-3">
            <Waves className="h-6 w-6" />
            TREND ANALYSIS
          </h1>
          <p className="font-mono text-xs text-muted-foreground mt-1">
            {symbol.replace("USDT", "")} · {tfLabel} · FIBONACCI + TRENDLINE
            ANALYSIS
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Symbol selector */}
          <form
            onSubmit={handleSymbolSubmit}
            className="flex items-center gap-1.5 bg-card/50 border border-border/30 rounded-sm px-2 py-1"
          >
            <Input
              value={symbolInput}
              onChange={(e) => setSymbolInput(e.target.value)}
              list="wave-tracker-symbols"
              className="h-6 w-28 px-1 font-mono text-[10px] bg-background/50 border-border/30"
              placeholder="Symbol"
            />
            <datalist id="wave-tracker-symbols">
              {TOP_COINS.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
            <Button
              type="submit"
              size="sm"
              variant="outline"
              className="h-6 px-2 font-mono text-[10px] border-neon-cyan/30 text-neon-cyan hover:bg-neon-cyan/10"
            >
              GO
            </Button>
          </form>
          {/* Timeframe selector */}
          <div className="flex items-center gap-0.5 bg-card/50 border border-border/30 rounded-sm px-2 py-1">
            {WAVE_TIMEFRAMES.map((tf) => (
              <button
                key={tf.value}
                onClick={() => setSelectedInterval(tf.value)}
                className={cn(
                  "font-mono text-[10px] px-2 py-1 rounded-sm transition-all",
                  interval === tf.value
                    ? "bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                )}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Current Price" value={`$${formatPrice(currentPrice)}`} />
        <StatCard label="Fib Low" value={`$${formatPrice(fibLow)}`} />
        <StatCard label="Fib High" value={`$${formatPrice(fibHigh)}`} />
        <StatCard
          label="Range"
          value={`${
            fibLow > 0 ? (((fibHigh - fibLow) / fibLow) * 100).toFixed(1) : "0"
          }%`}
          unit={`($${formatPrice(fibHigh - fibLow)})`}
        />
      </div>

      {/* Loading / error states */}
      {isLoading && (
        <HudPanel title="Loading">
          <div className="flex items-center justify-center py-12 gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-neon-pink" />
            <span className="font-mono text-sm text-muted-foreground">
              Fetching {symbol} {tfLabel} candles...
            </span>
          </div>
        </HudPanel>
      )}

      {error && !isLoading && (
        <HudPanel title="Error" variant="danger">
          <div className="flex flex-col items-center gap-2 py-8">
            <p className="font-mono text-sm text-neon-red">
              Failed to load {symbol}
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                // Force refetch by toggling the symbol back and forth.
                setSymbol((prev) => prev);
              }}
              className="border-neon-cyan/30 text-neon-cyan hover:bg-neon-cyan/10 font-mono text-xs"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              RETRY
            </Button>
          </div>
        </HudPanel>
      )}

      {!isLoading && detail && candles.length > 0 && (
        <>
          {/* Chart */}
          <HudPanel
            title="Price Chart"
            subtitle={`${candles.length} candles · 10 fib levels · ${
              [upTrend, downTrend].filter(Boolean).length
            } trendlines`}
            variant="highlight"
          >
            <div className="h-[420px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={chartData}
                  margin={{ top: 10, right: 60, left: 10, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/20" />
                  <XAxis
                    dataKey="timeLabel"
                    tick={{ fontSize: 9, fontFamily: "Share Tech Mono" }}
                    interval="preserveStartEnd"
                    tickCount={8}
                  />
                  <YAxis
                    domain={[fibLow * 0.98, fibHigh * 1.02]}
                    tick={{ fontSize: 9, fontFamily: "Share Tech Mono" }}
                    tickFormatter={(v) => `$${formatPrice(v)}`}
                    width={60}
                    orientation="right"
                  />
                  <RTooltip
                    contentStyle={{
                      backgroundColor: "oklch(0.14 0.015 260)",
                      border: "1px solid oklch(0.3 0.02 260)",
                      fontFamily: "Share Tech Mono",
                      fontSize: 10,
                    }}
                    formatter={(value: number, name: string) => [
                      `$${formatPrice(value)}`,
                      name,
                    ]}
                  />
                  {/* Fib levels — horizontal reference lines */}
                  {fibLevels.map((f) => (
                    <ReferenceLine
                      key={f.ratio}
                      y={f.price}
                      stroke={f.color}
                      strokeDasharray="2 4"
                      strokeWidth={f.ratio === 0.5 ? 1.5 : 1}
                      label={{
                        value: f.label,
                        position: "right",
                        fill: f.color,
                        fontSize: 8,
                        fontFamily: "Share Tech Mono",
                      }}
                    />
                  ))}
                  {/* Price area */}
                  <Area
                    type="monotone"
                    dataKey="close"
                    name="Price"
                    stroke="oklch(0.82 0.18 195)"
                    strokeWidth={1.5}
                    fill="oklch(0.82 0.18 195 / 0.06)"
                    dot={false}
                    isAnimationActive={false}
                  />
                  {/* Trendlines */}
                  {upTrend && (
                    <Line
                      type="linear"
                      dataKey="upTrend"
                      name="Up Trendline"
                      stroke="oklch(0.7 0.22 145)"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  )}
                  {downTrend && (
                    <Line
                      type="linear"
                      dataKey="downTrend"
                      name="Down Trendline"
                      stroke="oklch(0.65 0.25 25)"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            {/* Volume strip below */}
            <div className="h-[80px] w-full mt-2 border-t border-border/20 pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={chartData}
                  margin={{ top: 0, right: 60, left: 10, bottom: 0 }}
                >
                  <XAxis dataKey="timeLabel" hide />
                  <YAxis
                    tick={{ fontSize: 8, fontFamily: "Share Tech Mono" }}
                    tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}K` : `${v}`)}
                    width={60}
                    orientation="right"
                  />
                  <Bar
                    dataKey="volume"
                    fill="oklch(0.65 0.02 260 / 0.5)"
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </HudPanel>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Fibonacci panel */}
            <HudPanel title="Fibonacci Levels" subtitle="10 RETRACEMENT + EXTENSION">
              <div className="space-y-1 max-h-72 overflow-y-auto">
                {fibLevels.map((f) => {
                  const distance =
                    currentPrice > 0
                      ? ((f.price - currentPrice) / currentPrice) * 100
                      : 0;
                  const inZone = Math.abs(distance) < 1;
                  return (
                    <div
                      key={f.ratio}
                      className={cn(
                        "flex items-center justify-between font-mono text-[11px] px-2 py-1 rounded-sm",
                        inZone
                          ? "bg-neon-cyan/10 border border-neon-cyan/30"
                          : "border border-transparent"
                      )}
                    >
                      <span style={{ color: f.color }}>{f.label}</span>
                      <span className="text-foreground">${formatPrice(f.price)}</span>
                      <span
                        className={cn(
                          "text-[10px] w-12 text-right",
                          distance >= 0
                            ? "text-muted-foreground"
                            : "text-muted-foreground/70"
                        )}
                      >
                        {distance >= 0 ? "+" : ""}
                        {distance.toFixed(1)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </HudPanel>

            {/* Trendline panel */}
            <HudPanel title="Trendlines" subtitle="STRENGTH + ANCHORING">
              <div className="space-y-3">
                <TrendlineSummary
                  trendline={upTrend}
                  type="support"
                  noneLabel="No support trendline detected"
                />
                <TrendlineSummary
                  trendline={downTrend}
                  type="resistance"
                  noneLabel="No resistance trendline detected"
                />
              </div>
            </HudPanel>

            {/* Trade signals panel */}
            <HudPanel title="Trade Signals" subtitle="BUY / SELL CRITERIA">
              <div className="space-y-3">
                <SignalChecklist
                  title="BUY"
                  items={tradeSignals.buy}
                  strength={tradeSignals.buyStrength}
                  positive
                />
                <SignalChecklist
                  title="SELL"
                  items={tradeSignals.sell}
                  strength={tradeSignals.sellStrength}
                />
              </div>
            </HudPanel>
          </div>
        </>
      )}
    </div>
  );
}

function TrendlineSummary({
  trendline,
  type,
  noneLabel,
}: {
  trendline: TrendlineComputed | null;
  type: "support" | "resistance";
  noneLabel: string;
}) {
  const colorClass = type === "support" ? "text-neon-green" : "text-neon-red";
  if (!trendline) {
    return (
      <div className="font-mono text-[11px] text-muted-foreground">{noneLabel}</div>
    );
  }
  const s = strengthLabel(trendline.strength);
  return (
    <div className="space-y-0.5 font-mono text-[11px]">
      <div className={cn("flex items-center gap-1 font-bold", colorClass)}>
        {type === "support" ? "↑" : "↓"}{" "}
        {type === "support" ? "Support" : "Resistance"}
      </div>
      <Row label="Start" value={`$${formatPrice(trendline.startPrice)}`} />
      <Row label="End" value={`$${formatPrice(trendline.endPrice)}`} />
      <Row
        label="Slope"
        value={`${trendline.slope >= 0 ? "+" : ""}${trendline.slope.toFixed(4)} / candle`}
      />
      <Row
        label="Strength"
        value={
          <span className={s.color}>
            {trendline.strength.toFixed(0)}% · {s.label}
          </span>
        }
      />
    </div>
  );
}

function SignalChecklist({
  title,
  items,
  strength,
  positive = false,
}: {
  title: string;
  items: { ok: boolean; label: string }[];
  strength: number;
  positive?: boolean;
}) {
  const titleColor = positive ? "text-neon-green" : "text-neon-red";
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between">
        <span className={cn("font-display text-xs font-bold", titleColor)}>{title}</span>
        <span className="font-mono text-[10px] text-muted-foreground">
          {items.filter((i) => i.ok).length}/{items.length}
        </span>
      </div>
      <div className="space-y-0.5">
        {items.map((item, i) => (
          <div
            key={i}
            className={cn(
              "flex items-start gap-2 font-mono text-[11px]",
              item.ok ? "text-foreground" : "text-muted-foreground/60"
            )}
          >
            <span className={item.ok ? titleColor : "text-muted-foreground/40"}>
              {item.ok ? "✓" : "✗"}
            </span>
            <span>{item.label}</span>
          </div>
        ))}
      </div>
      <div className="font-mono text-[10px] text-muted-foreground pt-1">
        Confidence:{" "}
        <span
          className={cn(
            strength >= 66
              ? titleColor
              : strength >= 33
              ? "text-neon-yellow"
              : "text-muted-foreground"
          )}
        >
          {strength.toFixed(0)}%
        </span>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between font-mono text-[11px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}
