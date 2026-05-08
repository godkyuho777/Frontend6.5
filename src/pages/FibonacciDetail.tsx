/**
 * Fibonacci Detail Page
 * Candlestick chart + auto Fibonacci levels + trendline overlays.
 * Reads `:symbol` from URL and `?tf=` from query.
 */

import { useState } from "react";
import { useLocation, useParams, useSearch } from "wouter";
import { ChevronLeft, Clock, RefreshCw } from "lucide-react";
import { HudPanel } from "@/components/HudPanel";
import { CandleChartLW } from "@/components/CandleChartLW";
import { cn } from "@/lib/utils";
import { useFibonacciDetail } from "@/hooks/useFibonacciDetail";
import type { Trendline } from "@/lib/fibonacci-engine";
import { TIMEFRAMES } from "@shared/types";
import type { TimeframeValue } from "@shared/types";

const FIB_TIMEFRAMES = TIMEFRAMES;

export default function FibonacciDetail() {
  const params = useParams<{ symbol: string }>();
  const symbol = (params.symbol ?? "").toUpperCase();
  const [, setLocation] = useLocation();
  const searchString = useSearch();

  const urlParams = new URLSearchParams(searchString);
  const initialTf = (urlParams.get("tf") as TimeframeValue) || "1d";
  const [timeframe, setTimeframe] = useState<TimeframeValue>(initialTf);

  const { analysis, candles, isLoading, error, refetch } = useFibonacciDetail(
    symbol,
    timeframe
  );

  const tfLabel = FIB_TIMEFRAMES.find((t) => t.value === timeframe)?.label ?? timeframe;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <RefreshCw className="h-8 w-8 text-neon-cyan animate-spin" />
        <p className="font-mono text-sm text-muted-foreground">
          Analyzing {symbol} Fibonacci levels ({tfLabel})...
        </p>
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="font-mono text-sm text-neon-red">{error || "Analysis failed"}</p>
        <button
          onClick={() => setLocation("/fibonacci")}
          className="text-neon-cyan text-sm underline font-mono"
        >
          Back to Fibonacci scanner
        </button>
      </div>
    );
  }

  const currentPrice = candles[candles.length - 1]?.close ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap">
        <button
          onClick={() => setLocation("/fibonacci")}
          className="p-2 border border-border/30 rounded-sm hover:bg-neon-cyan/10 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-wider text-neon-pink glow-pink">
            {symbol.replace("USDT", "")} / USDT
          </h1>
          <p className="font-mono text-xs text-muted-foreground mt-1">
            FIBONACCI + TRENDLINE · {tfLabel} CHART
          </p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-1 border border-border/30 rounded-sm p-0.5">
            <Clock className="h-3 w-3 text-muted-foreground ml-1.5" />
            {FIB_TIMEFRAMES.map((tf) => (
              <button
                key={tf.value}
                onClick={() => setTimeframe(tf.value)}
                className={cn(
                  "px-2.5 py-1 text-xs font-mono rounded-sm transition-colors",
                  timeframe === tf.value
                    ? "bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                )}
              >
                {tf.label}
              </button>
            ))}
          </div>
          <button
            onClick={refetch}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-mono border border-neon-cyan/30 text-neon-cyan hover:bg-neon-cyan/10 rounded-sm transition-colors"
          >
            <RefreshCw className="h-3 w-3" />
            REFRESH
          </button>
        </div>
      </div>

      {/* Signal Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <HudPanel
          title="Signal"
          variant={
            analysis.signal.type === "BUY"
              ? "highlight"
              : analysis.signal.type === "SELL"
              ? "danger"
              : "default"
          }
        >
          <div className="flex items-center gap-4">
            <div
              className={cn(
                "text-3xl font-display font-bold",
                analysis.signal.type === "BUY"
                  ? "text-neon-green"
                  : analysis.signal.type === "SELL"
                  ? "text-neon-red"
                  : "text-muted-foreground"
              )}
            >
              {analysis.signal.type}
            </div>
            <div className="flex-1">
              <div className="font-mono text-xs text-muted-foreground mb-1">Strength</div>
              <div className="w-full h-2 bg-border/30 rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full",
                    analysis.signal.strength >= 60
                      ? "bg-neon-green"
                      : analysis.signal.strength >= 30
                      ? "bg-neon-yellow"
                      : "bg-muted-foreground/30"
                  )}
                  style={{ width: `${analysis.signal.strength}%` }}
                />
              </div>
              <div className="font-mono text-xs text-muted-foreground mt-1">
                {analysis.signal.strength}/100
              </div>
            </div>
          </div>
        </HudPanel>

        <HudPanel title="Current Zone">
          <div className="font-mono text-sm text-neon-cyan mb-2">{analysis.currentZone}</div>
          <div className="font-mono text-xs text-muted-foreground">
            Price: $
            {currentPrice < 1
              ? currentPrice.toPrecision(4)
              : currentPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </div>
          <div className="font-mono text-xs text-muted-foreground mt-1">
            Trend:{" "}
            <span
              className={cn(
                analysis.trend === "UP"
                  ? "text-neon-green"
                  : analysis.trend === "DOWN"
                  ? "text-neon-red"
                  : ""
              )}
            >
              {analysis.trend}
            </span>
          </div>
        </HudPanel>

        <HudPanel title="Analysis Reasons">
          <div className="space-y-1.5">
            {analysis.signal.reasons.map((reason, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-neon-cyan mt-0.5">◆</span>
                <span className="font-mono text-xs text-muted-foreground leading-relaxed">
                  {reason}
                </span>
              </div>
            ))}
          </div>
        </HudPanel>
      </div>

      {/* Candlestick Chart with Fibonacci + Trendlines */}
      <HudPanel
        title="Fibonacci Chart"
        subtitle={`${symbol} · ${tfLabel} · ${candles.length} candles`}
      >
        <CandleChartLW
          candles={candles}
          fibLevels={analysis.fibLevels}
          trendlines={analysis.trendlines}
          currentPrice={currentPrice}
        />
      </HudPanel>

      {/* Fibonacci Levels Table */}
      <HudPanel title="Fibonacci Levels" subtitle="±0.5% tolerance zones">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/30">
                {["Level", "Price", "Zone Low (-0.5%)", "Zone High (+0.5%)", "Status"].map(
                  (h, i) => (
                    <th
                      key={h}
                      className={cn(
                        "py-2 px-3 font-mono text-[10px] text-muted-foreground uppercase",
                        i === 0 ? "text-left" : i === 4 ? "text-center" : "text-right"
                      )}
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {analysis.fibLevels.map((level) => {
                const inZone = currentPrice >= level.zoneLow && currentPrice <= level.zoneHigh;
                return (
                  <tr
                    key={level.ratio}
                    className={cn("border-b border-border/20", inZone && "bg-neon-yellow/10")}
                  >
                    <td className="py-2 px-3">
                      <span
                        className={cn(
                          "font-mono text-sm font-bold",
                          level.ratio === 0.618
                            ? "text-yellow-400"
                            : level.ratio === 0.382
                            ? "text-neon-pink"
                            : "text-foreground"
                        )}
                      >
                        {level.label}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-sm">
                      ${level.price < 1 ? level.price.toPrecision(4) : level.price.toFixed(2)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-xs text-muted-foreground">
                      $
                      {level.zoneLow < 1
                        ? level.zoneLow.toPrecision(4)
                        : level.zoneLow.toFixed(2)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-xs text-muted-foreground">
                      $
                      {level.zoneHigh < 1
                        ? level.zoneHigh.toPrecision(4)
                        : level.zoneHigh.toFixed(2)}
                    </td>
                    <td className="py-2 px-3 text-center">
                      {inZone ? (
                        <span className="text-xs font-mono text-neon-yellow font-bold">
                          ● IN ZONE
                        </span>
                      ) : (
                        <span className="text-xs font-mono text-muted-foreground">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </HudPanel>

      {/* Trendlines */}
      <HudPanel
        title="Detected Trendlines"
        subtitle={`${analysis.trendlines.filter((t) => t.isValid).length} valid trendlines found`}
      >
        {analysis.trendlines.length === 0 ? (
          <p className="font-mono text-xs text-muted-foreground text-center py-4">
            No significant trendlines detected
          </p>
        ) : (
          <div className="space-y-3">
            {analysis.trendlines
              .slice()
              .sort((a, b) => (b.isValid ? 1 : 0) - (a.isValid ? 1 : 0))
              .map((tl, i) => (
                <TrendlineCard key={i} trendline={tl} currentPrice={currentPrice} />
              ))}
          </div>
        )}
      </HudPanel>
    </div>
  );
}

// ─── Trendline Card ─────────────────────────────────────────────────

function TrendlineCard({
  trendline,
  currentPrice,
}: {
  trendline: Trendline;
  currentPrice: number;
}) {
  const distance = ((currentPrice - trendline.currentPrice) / trendline.currentPrice) * 100;

  return (
    <div
      className={cn(
        "p-3 border rounded-sm",
        trendline.isValid
          ? trendline.type === "support"
            ? "border-neon-green/30 bg-neon-green/5"
            : "border-neon-red/30 bg-neon-red/5"
          : "border-border/30 opacity-50"
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-xs font-mono font-bold uppercase",
              trendline.type === "support" ? "text-neon-green" : "text-neon-red"
            )}
          >
            {trendline.type === "support" ? "▲ SUPPORT" : "▼ RESISTANCE"}
          </span>
          {trendline.isValid && (
            <span className="text-[10px] font-mono text-neon-cyan bg-neon-cyan/10 px-1.5 py-0.5 rounded">
              VALID
            </span>
          )}
        </div>
        <span className="font-mono text-xs text-muted-foreground">
          {trendline.touchCount} touches · {trendline.durationDays.toFixed(0)} days
        </span>
      </div>
      <div className="grid grid-cols-3 gap-4 text-xs font-mono">
        <div>
          <span className="text-muted-foreground">Current Level:</span>
          <div className="text-foreground">
            $
            {trendline.currentPrice < 1
              ? trendline.currentPrice.toPrecision(4)
              : trendline.currentPrice.toFixed(2)}
          </div>
        </div>
        <div>
          <span className="text-muted-foreground">Distance:</span>
          <div className={cn(distance >= 0 ? "text-neon-green" : "text-neon-red")}>
            {distance >= 0 ? "+" : ""}
            {distance.toFixed(2)}%
          </div>
        </div>
        <div>
          <span className="text-muted-foreground">Slope:</span>
          <div className={cn(trendline.slope >= 0 ? "text-neon-green" : "text-neon-red")}>
            {trendline.slope >= 0 ? "↑" : "↓"} $
            {Math.abs(trendline.slope) < 1
              ? Math.abs(trendline.slope).toPrecision(4)
              : Math.abs(trendline.slope).toFixed(2)}
            /candle
          </div>
        </div>
      </div>
    </div>
  );
}
