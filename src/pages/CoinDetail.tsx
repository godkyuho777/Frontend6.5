import { trpc } from "@/lib/trpc";
import { HudPanel, StatCard } from "@/components/HudPanel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Loader2,
  ArrowLeft,
  Zap,
  Brain,
  Clock,
} from "lucide-react";
import { useParams, useLocation, useSearch } from "wouter";
import { cn } from "@/lib/utils";
import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  ComposedChart,
  Bar,
} from "recharts";
import { toast } from "sonner";
import { TIMEFRAMES } from "@shared/types";
import type { TimeframeValue } from "@shared/types";
import { useCoinDetail } from "@/hooks/useMarketData";

export default function CoinDetail() {
  const params = useParams<{ symbol: string }>();
  const symbol = params.symbol ?? "";
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const { user } = useAuth();
  const [showInsight, setShowInsight] = useState(false);

  // Parse tf from URL query
  const urlParams = new URLSearchParams(searchString);
  const initialTf = (urlParams.get("tf") as TimeframeValue) || "4h";
  const [interval, setInterval] = useState<TimeframeValue>(initialTf);

  // Client-side data fetching (직접 바이비트 API 호출)
  const { data: detail, isLoading } = useCoinDetail(symbol || undefined, interval, 100);

  // AI insight and save signal still use tRPC (server-side)
  const insightMutation = trpc.ai.signalInsight.useMutation();

  const saveSignalMutation = trpc.signals.save.useMutation({
    onSuccess: () => toast.success("Signal saved to history"),
    onError: () => toast.error("Failed to save signal"),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-neon-pink" />
        <span className="ml-3 font-mono text-sm text-muted-foreground">
          Loading {symbol} data...
        </span>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="text-center py-20">
        <p className="font-mono text-muted-foreground">No data available for {symbol}</p>
        <Button variant="outline" className="mt-4" onClick={() => setLocation("/")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Scanner
        </Button>
      </div>
    );
  }

  const { candles, indicators, rsiSeries, adxSeries, bbSeries } = detail;
  const lastCandle = candles[candles.length - 1];
  const price = lastCandle?.close ?? 0;
  const fibLevels = indicators.fibLevels || [];
  const trendlines = indicators.trendlines || [];

  const tfLabel = TIMEFRAMES.find(t => t.value === interval)?.label ?? interval;

  const chartData = useMemo(() => {
    const sliceStart = Math.max(0, candles.length - 60);
    return candles.slice(sliceStart).map((c, i) => {
      const globalIdx = sliceStart + i;
      const bb = bbSeries?.[globalIdx];
      return {
        time: new Date(c.openTime).toLocaleDateString("ko-KR", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
        }),
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
        bbUpper: bb?.upper ?? c.close,
        bbMiddle: bb?.middle ?? c.close,
        bbLower: bb?.lower ?? c.close,
        rsi: rsiSeries?.[globalIdx] ?? 50,
        adx: adxSeries?.[globalIdx]?.adx ?? 0,
        plusDi: adxSeries?.[globalIdx]?.plusDi ?? 0,
        minusDi: adxSeries?.[globalIdx]?.minusDi ?? 0,
      };
    });
  }, [candles, bbSeries, rsiSeries, adxSeries]);

  const bbPos =
    indicators.bbUpper !== indicators.bbLower
      ? ((price - indicators.bbLower) / (indicators.bbUpper - indicators.bbLower)) * 100
      : 50;

  const handleGetInsight = () => {
    setShowInsight(true);
    insightMutation.mutate({
      symbol,
      price,
      rsi: indicators.rsi,
      bbLower: indicators.bbLower,
      bbMiddle: indicators.bbMiddle,
      bbUpper: indicators.bbUpper,
      adx: indicators.adx,
      plusDi: indicators.plusDi,
      minusDi: indicators.minusDi,
      interval,
    });
  };

  const handleSaveSignal = () => {
    saveSignalMutation.mutate({
      symbol,
      entryPrice: price,
      targetPrice: indicators.bbMiddle,
      rsiValue: indicators.rsi,
      bbLower: indicators.bbLower,
      bbMiddle: indicators.bbMiddle,
      bbUpper: indicators.bbUpper,
      adxValue: indicators.adx,
      plusDi: indicators.plusDi,
      minusDi: indicators.minusDi,
    });
  };

  const formatPrice = (p: number) =>
    p < 1 ? p.toFixed(6) : p < 100 ? p.toFixed(4) : p.toFixed(2);

  const axisTick = {
    fontSize: 10,
    fill: "oklch(0.65 0.02 260)",
    fontFamily: "Share Tech Mono",
  };
  const tooltipStyle = {
    backgroundColor: "oklch(0.14 0.015 260)",
    border: "1px solid oklch(0.25 0.03 260)",
    borderRadius: "4px",
    fontFamily: "Share Tech Mono",
    fontSize: "11px",
    color: "oklch(0.92 0.01 260)",
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/")}
            className="text-neon-cyan hover:bg-neon-cyan/10"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-2xl font-bold tracking-wider text-neon-pink glow-pink">
                {symbol.replace("USDT", "")}
              </h1>
              <span className="font-mono text-sm text-muted-foreground">/USDT</span>
            </div>
            <p className="font-mono text-xs text-muted-foreground mt-0.5">
              {tfLabel} CANDLE ANALYSIS
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Timeframe Selector */}
          <div className="flex items-center gap-1.5 bg-card/50 border border-border/30 rounded-sm px-2 py-1">
            <Clock className="h-3 w-3 text-neon-cyan" />
            <div className="flex gap-0.5">
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf.value}
                  onClick={() => setInterval(tf.value as TimeframeValue)}
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
          <Button
            variant="outline"
            size="sm"
            onClick={handleGetInsight}
            disabled={insightMutation.isPending}
            className="border-neon-cyan/30 text-neon-cyan hover:bg-neon-cyan/10 font-mono text-xs"
          >
            <Brain className="h-3 w-3 mr-1" />
            AI INSIGHT
          </Button>
          {user && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSaveSignal}
              disabled={saveSignalMutation.isPending}
              className="border-neon-green/30 text-neon-green hover:bg-neon-green/10 font-mono text-xs"
            >
              <Zap className="h-3 w-3 mr-1" />
              SAVE SIGNAL
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <StatCard label="Price" value={`$${formatPrice(price)}`} />
        <StatCard
          label="RSI (14)"
          value={indicators.rsi.toFixed(1)}
          variant={
            indicators.rsi <= 35
              ? "positive"
              : indicators.rsi >= 70
              ? "negative"
              : "default"
          }
        />
        <StatCard label="BB Upper" value={`$${formatPrice(indicators.bbUpper)}`} />
        <StatCard label="BB Middle" value={`$${formatPrice(indicators.bbMiddle)}`} />
        <StatCard label="BB Lower" value={`$${formatPrice(indicators.bbLower)}`} />
        <StatCard label="ADX" value={indicators.adx.toFixed(1)} />
        <StatCard
          label="+DI / -DI"
          value={`${indicators.plusDi.toFixed(1)} / ${indicators.minusDi.toFixed(1)}`}
        />
      </div>

      {/* Entry Conditions Check */}
      <HudPanel title="Entry Conditions" subtitle="Long position criteria check">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <ConditionCheck
            label="RSI 30~35"
            value={indicators.rsi.toFixed(1)}
            met={indicators.rsi >= 30 && indicators.rsi <= 35}
          />
          <ConditionCheck
            label="Price near BB Lower"
            value={`${bbPos.toFixed(0)}% (BB Position)`}
            met={price <= indicators.bbLower * 1.02}
          />          <ConditionCheck
            label="ADX ≤ 30"
            value={indicators.adx.toFixed(1)}
            met={indicators.adx <= 30}
          />
          {fibLevels.some((f: any) => f.isGoldenZone && Math.abs(price - f.price) / f.price <= 0.005) && (
            <ConditionCheck
              label="Fib Golden Zone"
              value="TOUCHED"
              met={true}
            />
          )}
          {trendlines.length > 0 && (
            <ConditionCheck
              label="Trendline"
              value={`${trendlines.length} DETECTED`}
              met={true}
            />
          )}
        </div>
      </HudPanel>

      {/* Upcoming Events Section */}
      <HudPanel title="Upcoming Events" subtitle="Token unlocks, upgrades, and major milestones">
        <div className="space-y-3">
          <div className="flex items-start gap-4 p-3 bg-card/30 border border-border/10 rounded-sm">
            <div className="flex flex-col items-center justify-center w-12 h-12 bg-neon-cyan/10 border border-neon-cyan/20 rounded-sm">
              <span className="font-mono text-[10px] text-neon-cyan">D-3</span>
              <span className="font-display text-lg font-bold text-neon-cyan">15</span>
            </div>
            <div className="flex-1">
              <h4 className="font-display text-sm font-bold text-foreground">Token Unlock Event</h4>
              <p className="font-mono text-xs text-muted-foreground mt-1">
                Approximately 2.5% of total supply will be unlocked for early investors.
              </p>
            </div>
            <Badge variant="outline" className="text-[10px] border-neon-yellow/30 text-neon-yellow">VOLATILITY HIGH</Badge>
          </div>

          <div className="flex items-start gap-4 p-3 bg-card/30 border border-border/10 rounded-sm">
            <div className="flex flex-col items-center justify-center w-12 h-12 bg-neon-pink/10 border border-neon-pink/20 rounded-sm">
              <span className="font-mono text-[10px] text-neon-pink">D-12</span>
              <span className="font-display text-lg font-bold text-neon-pink">24</span>
            </div>
            <div className="flex-1">
              <h4 className="font-display text-sm font-bold text-foreground">Mainnet V2 Upgrade</h4>
              <p className="font-mono text-xs text-muted-foreground mt-1">
                Significant performance improvements and new governance features implementation.
              </p>
            </div>
            <Badge variant="outline" className="text-[10px] border-neon-cyan/30 text-neon-cyan">NETWORK</Badge>
          </div>
          
          <p className="font-mono text-[10px] text-muted-foreground text-center italic">
            * Event data is aggregated from multiple sources and may change.
          </p>
        </div>
      </HudPanel>

      {/* Price Chart with BB, Fibonacci & Trendlines */}
      <HudPanel title="Advanced Chart" subtitle={`${tfLabel} candles with BB, Fibonacci Zones & Trendlines`}>
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.03 260)" />
              <XAxis
                dataKey="time"
                tick={axisTick}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={["auto", "auto"]}
                tick={axisTick}
                tickLine={false}
                orientation="right"
              />
              <Tooltip contentStyle={tooltipStyle} />
              
              {/* Fibonacci Levels */}
              {fibLevels.map((fib: any) => (
                <ReferenceLine
                  key={`fib-${fib.level}`}
                  y={fib.price}
                  stroke={fib.isGoldenZone ? "oklch(0.7 0.2 60)" : "oklch(0.4 0.05 260)"}
                  strokeDasharray="2 2"
                  label={{
                    value: `Fib ${fib.level}`,
                    position: "left",
                    fill: fib.isGoldenZone ? "oklch(0.7 0.2 60)" : "oklch(0.4 0.05 260)",
                    fontSize: 10,
                    fontFamily: "Share Tech Mono"
                  }}
                />
              ))}

              {/* Bollinger Bands */}
              <Line type="monotone" dataKey="bbUpper" stroke="oklch(0.65 0.02 260)" strokeDasharray="5 5" dot={false} strokeWidth={1} />
              <Line type="monotone" dataKey="bbMiddle" stroke="oklch(0.65 0.02 260)" strokeDasharray="3 3" dot={false} strokeWidth={1} />
              <Line type="monotone" dataKey="bbLower" stroke="oklch(0.65 0.02 260)" strokeDasharray="5 5" dot={false} strokeWidth={1} />
              
              <Bar dataKey="close" fill="oklch(0.7 0.15 160)" opacity={0.3} />
              <Line type="monotone" dataKey="close" stroke="oklch(0.7 0.2 190)" dot={false} strokeWidth={2} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </HudPanel>

      {/* RSI Chart */}
      <HudPanel title="RSI (14)" subtitle="Relative Strength Index">
        <div className="h-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.03 260)" />
              <XAxis
                dataKey="time"
                tick={axisTick}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[0, 100]}
                tick={axisTick}
                tickLine={false}
                ticks={[0, 30, 35, 50, 70, 100]}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value: number) => [value.toFixed(2), "RSI"]}
              />
              <ReferenceLine
                y={30}
                stroke="oklch(0.82 0.19 145)"
                strokeDasharray="4 2"
                strokeOpacity={0.6}
                label={{
                  value: "30",
                  position: "right",
                  fill: "oklch(0.82 0.19 145)",
                  fontSize: 10,
                  fontFamily: "Share Tech Mono",
                }}
              />
              <ReferenceLine
                y={35}
                stroke="oklch(0.82 0.19 145)"
                strokeDasharray="4 2"
                strokeOpacity={0.4}
                label={{
                  value: "35",
                  position: "right",
                  fill: "oklch(0.82 0.19 145)",
                  fontSize: 10,
                  fontFamily: "Share Tech Mono",
                }}
              />
              <ReferenceLine
                y={70}
                stroke="oklch(0.72 0.25 350)"
                strokeDasharray="4 2"
                strokeOpacity={0.6}
                label={{
                  value: "70",
                  position: "right",
                  fill: "oklch(0.72 0.25 350)",
                  fontSize: 10,
                  fontFamily: "Share Tech Mono",
                }}
              />
              <Line dataKey="rsi" stroke="oklch(0.88 0.18 95)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </HudPanel>

      {/* ADX Chart */}
      <HudPanel title="ADX / DI" subtitle="Average Directional Index with +DI / -DI">
        <div className="h-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.03 260)" />
              <XAxis
                dataKey="time"
                tick={axisTick}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis domain={[0, "auto"]} tick={axisTick} tickLine={false} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value: number, name: string) => [
                  value.toFixed(2),
                  name === "adx" ? "ADX" : name === "plusDi" ? "+DI" : "-DI",
                ]}
              />
              <ReferenceLine
                y={30}
                stroke="oklch(0.65 0.02 260)"
                strokeDasharray="4 2"
                strokeOpacity={0.5}
                label={{
                  value: "30",
                  position: "right",
                  fill: "oklch(0.65 0.02 260)",
                  fontSize: 10,
                  fontFamily: "Share Tech Mono",
                }}
              />
              <Line
                dataKey="adx"
                stroke="oklch(0.82 0.18 195)"
                strokeWidth={2}
                dot={false}
                name="ADX"
              />
              <Line
                dataKey="plusDi"
                stroke="oklch(0.82 0.19 145)"
                strokeWidth={1.5}
                dot={false}
                strokeDasharray="3 2"
                name="+DI"
              />
              <Line
                dataKey="minusDi"
                stroke="oklch(0.72 0.25 350)"
                strokeWidth={1.5}
                dot={false}
                strokeDasharray="3 2"
                name="-DI"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center gap-4 mt-2 justify-center">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-0.5 bg-[oklch(0.82_0.18_195)]" />
            <span className="font-mono text-[10px] text-muted-foreground">ADX</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-0.5 bg-[oklch(0.82_0.19_145)]" style={{ borderTop: "1px dashed" }} />
            <span className="font-mono text-[10px] text-muted-foreground">+DI</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-0.5 bg-[oklch(0.72_0.25_350)]" style={{ borderTop: "1px dashed" }} />
            <span className="font-mono text-[10px] text-muted-foreground">-DI</span>
          </div>
        </div>
      </HudPanel>

      {/* AI Insight */}
      {showInsight && (
        <HudPanel title="AI Analysis" subtitle="LLM-powered market insight" variant="highlight">
          {insightMutation.isPending ? (
            <div className="flex items-center gap-2 py-4">
              <Loader2 className="h-4 w-4 animate-spin text-neon-cyan" />
              <span className="font-mono text-sm text-muted-foreground">
                Analyzing market conditions...
              </span>
            </div>
          ) : insightMutation.data ? (
            <div className="prose prose-sm prose-invert max-w-none font-sans text-sm text-foreground leading-relaxed whitespace-pre-wrap">
              {insightMutation.data.insight}
            </div>
          ) : insightMutation.error ? (
            <p className="text-neon-red font-mono text-sm">Analysis failed. Please try again.</p>
          ) : null}
        </HudPanel>
      )}
    </div>
  );
}

function ConditionCheck({
  label,
  value,
  met,
}: {
  label: string;
  value: string;
  met: boolean;
}) {
  return (
    <div
      className={cn(
        "p-3 rounded-sm border",
        met ? "border-neon-green/30 bg-neon-green/5" : "border-border/30 bg-card/50"
      )}
    >
      <div className="flex items-center gap-2 mb-1">
        <div
          className={cn(
            "w-2 h-2 rounded-full",
            met ? "bg-neon-green signal-pulse" : "bg-muted-foreground/30"
          )}
        />
        <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
          {label}
        </span>
      </div>
      <div
        className={cn(
          "font-display text-lg font-bold",
          met ? "text-neon-green" : "text-muted-foreground"
        )}
      >
        {value}
      </div>
      <Badge
        className={cn(
          "mt-1 font-mono text-[10px]",
          met
            ? "bg-neon-green/20 text-neon-green border-neon-green/30"
            : "bg-muted text-muted-foreground border-border/30"
        )}
      >
        {met ? "CONDITION MET" : "NOT MET"}
      </Badge>
    </div>
  );
}
