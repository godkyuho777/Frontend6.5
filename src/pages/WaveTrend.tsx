/**
 * Wave Tracker → Trend Analysis (v2.0)
 *
 * Multi-Timeframe Trend Analysis Engine 시각화.
 * 1h/4h/1d/1w 4개 TF에 대해 ATR/EMA/ADX/HH-LL/브레이크아웃을 종합하여 추세 방향과
 * 강도, 7단계 phase, 신뢰도를 계산하고 한글 예측을 제공.
 *
 * 데이터 흐름:
 *   useCoinDetail(symbol, tf, 200) × 4 → analyzeTimeframeTrend() × 4
 *     → synthesizeMultiTFTrend() → MultiTFTrendAnalysis
 */

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
import { Loader2, RefreshCw, Waves, Zap, AlertTriangle, TrendingUp, TrendingDown, Minus } from "lucide-react";

import { HudPanel } from "@/components/HudPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCoinDetail } from "@/hooks/useMarketData";
import { cn } from "@/lib/utils";
import { TOP_COINS } from "@shared/types";
import type { Candle, TimeframeValue } from "@shared/types";
import {
  analyzeTimeframeTrend,
  synthesizeMultiTFTrend,
  type TimeframeTrend,
  type TrendDirection,
  type TrendPhase,
  type MultiTFTrendAnalysis,
  type TrendlineInfo,
} from "@/lib/trend-analysis";

// ─── Constants ─────────────────────────────────────────────────────

type TFv = Extract<TimeframeValue, "1h" | "4h" | "1d" | "1w">;

const TFs: { tf: TFv; label: string; weight: number; count: number }[] = [
  { tf: "1h", label: "1시간", weight: 1, count: 200 },
  { tf: "4h", label: "4시간", weight: 2, count: 200 },
  { tf: "1d", label: "일봉", weight: 3, count: 200 },
  { tf: "1w", label: "주봉", weight: 4, count: 120 },
];

// ─── Helpers ───────────────────────────────────────────────────────

function formatPrice(p: number | null | undefined): string {
  if (!p || p === 0) return "—";
  return p < 1 ? p.toFixed(6) : p < 100 ? p.toFixed(4) : p.toFixed(2);
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function directionColor(d: TrendDirection): string {
  if (d === "BULLISH") return "text-neon-green";
  if (d === "BEARISH") return "text-neon-red";
  return "text-muted-foreground";
}

function directionBg(d: TrendDirection): string {
  if (d === "BULLISH") return "bg-neon-green/10 border-neon-green/30";
  if (d === "BEARISH") return "bg-neon-red/10 border-neon-red/30";
  return "bg-muted/10 border-muted/30";
}

function phaseLabel(p: TrendPhase): string {
  switch (p) {
    case "STRONG_BULLISH": return "강한 상승";
    case "BULLISH": return "상승";
    case "BULLISH_WEAKENING": return "상승 약화";
    case "SIDEWAYS": return "횡보";
    case "BEARISH_WEAKENING": return "하락 약화";
    case "BEARISH": return "하락";
    case "STRONG_BEARISH": return "강한 하락";
  }
}

function phaseColor(p: TrendPhase): string {
  if (p === "STRONG_BULLISH") return "text-neon-green glow-green";
  if (p === "BULLISH") return "text-neon-green";
  if (p === "BULLISH_WEAKENING") return "text-yellow-300";
  if (p === "SIDEWAYS") return "text-muted-foreground";
  if (p === "BEARISH_WEAKENING") return "text-orange-300";
  if (p === "BEARISH") return "text-neon-red";
  if (p === "STRONG_BEARISH") return "text-neon-red glow-red";
  return "text-muted-foreground";
}

function DirectionIcon({ d, className }: { d: TrendDirection; className?: string }) {
  if (d === "BULLISH") return <TrendingUp className={cn("text-neon-green", className)} />;
  if (d === "BEARISH") return <TrendingDown className={cn("text-neon-red", className)} />;
  return <Minus className={cn("text-muted-foreground", className)} />;
}

// ─── Per-TF data fetcher (collapses 4 hooks into one component) ─────

function useTFTrend(symbol: string, tf: TFv, label: string, count: number) {
  const { data, isLoading, error } = useCoinDetail(symbol, tf, count);
  const candles: Candle[] = data?.candles ?? [];
  const trend: TimeframeTrend | null = useMemo(() => {
    if (candles.length < 20) return null;
    return analyzeTimeframeTrend(candles, tf, label);
  }, [candles, tf, label]);
  return { trend, candles, isLoading, error };
}

// ─── Main page ─────────────────────────────────────────────────────

export default function WaveTrend() {
  const [symbolInput, setSymbolInput] = useState("BTCUSDT");
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [selectedTF, setSelectedTF] = useState<TFv>("4h");

  // 4 TF in parallel
  const tf1h = useTFTrend(symbol, "1h", "1시간", 200);
  const tf4h = useTFTrend(symbol, "4h", "4시간", 200);
  const tf1d = useTFTrend(symbol, "1d", "일봉", 200);
  const tf1w = useTFTrend(symbol, "1w", "주봉", 120);

  const allTfStates = [tf1h, tf4h, tf1d, tf1w];
  const isAnyLoading = allTfStates.some((s) => s.isLoading);
  const anyError = allTfStates.find((s) => s.error)?.error;

  const trends = useMemo(
    () =>
      allTfStates
        .map((s) => s.trend)
        .filter((t): t is TimeframeTrend => t !== null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tf1h.trend, tf4h.trend, tf1d.trend, tf1w.trend]
  );

  const multi: MultiTFTrendAnalysis = useMemo(
    () => synthesizeMultiTFTrend(trends),
    [trends]
  );

  // Selected TF chart data
  const selectedState = allTfStates.find((s) => s.trend?.timeframe === selectedTF) ?? tf4h;
  const selectedTrend = selectedState.trend;
  const selectedCandles = selectedState.candles;

  const chartData = useMemo(() => {
    if (!selectedTrend || selectedCandles.length === 0) return [];
    const sup = selectedTrend.supportLine;
    const res = selectedTrend.resistanceLine;
    return selectedCandles.map((c, i) => ({
      idx: i,
      timeLabel: formatTime(c.openTime),
      close: c.close,
      high: c.high,
      low: c.low,
      volume: c.volume,
      support: sup ? sup.intercept + sup.slope * i : null,
      resistance: res ? res.intercept + res.slope * i : null,
    }));
  }, [selectedTrend, selectedCandles]);

  const handleSymbolSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = symbolInput.trim().toUpperCase();
    if (t) setSymbol(t.endsWith("USDT") ? t : `${t}USDT`);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-wider text-neon-pink glow-pink flex items-center gap-3">
            <Waves className="h-6 w-6" />
            TREND ANALYSIS ENGINE
          </h1>
          <p className="font-mono text-xs text-muted-foreground mt-1">
            v2.0 · MULTI-TF · ATR DYNAMIC + EMA + ADX + VOLUME · {symbol.replace("USDT", "")}
          </p>
        </div>
        <form
          onSubmit={handleSymbolSubmit}
          className="flex items-center gap-1.5 bg-card/50 border border-border/30 rounded-sm px-2 py-1"
        >
          <Input
            value={symbolInput}
            onChange={(e) => setSymbolInput(e.target.value)}
            list="trend-symbols"
            className="h-6 w-32 px-1 font-mono text-[10px] bg-background/50 border-border/30"
            placeholder="Symbol"
          />
          <datalist id="trend-symbols">
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
            ANALYZE
          </Button>
        </form>
      </div>

      {/* Loading / Error */}
      {isAnyLoading && (
        <HudPanel title="Loading 4 timeframes">
          <div className="flex items-center justify-center py-8 gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-neon-pink" />
            <span className="font-mono text-xs text-muted-foreground">
              Fetching {symbol} candles for 1h / 4h / 1d / 1w...
            </span>
          </div>
        </HudPanel>
      )}

      {anyError && !isAnyLoading && (
        <HudPanel title="Error" variant="danger">
          <div className="flex flex-col items-center gap-2 py-6">
            <p className="font-mono text-xs text-neon-red">
              Failed to load {symbol}: {String(anyError.message ?? anyError)}
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSymbol((p) => p)}
              className="border-neon-cyan/30 text-neon-cyan hover:bg-neon-cyan/10 font-mono text-[10px]"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              RETRY
            </Button>
          </div>
        </HudPanel>
      )}

      {!isAnyLoading && trends.length > 0 && (
        <>
          {/* OVERALL synthesis card */}
          <HudPanel
            title="Overall Synthesis"
            subtitle="가중치 1h:1 / 4h:2 / 1d:3 / 1w:4"
            variant="highlight"
          >
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
              <OverallStat
                label="Direction"
                value={multi.overallDirection}
                color={directionColor(multi.overallDirection)}
                icon={<DirectionIcon d={multi.overallDirection} className="h-4 w-4" />}
              />
              <OverallStat
                label="Phase"
                value={phaseLabel(multi.overallPhase)}
                color={phaseColor(multi.overallPhase)}
              />
              <OverallStat
                label="Strength"
                value={`${multi.overallStrength}%`}
                color="text-neon-cyan"
                bar={multi.overallStrength}
              />
              <OverallStat
                label="Confidence"
                value={`${multi.confidence}%`}
                color="text-neon-cyan"
                bar={multi.confidence}
              />
            </div>
            <div className="flex items-center gap-3 mt-3 px-3 py-2 bg-background/40 border border-border/30 rounded-sm">
              <span className={cn("font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-sm border",
                multi.alignment === "ALIGNED_BULL" ? "border-neon-green/40 text-neon-green" :
                multi.alignment === "ALIGNED_BEAR" ? "border-neon-red/40 text-neon-red" :
                multi.alignment === "DIVERGENT" ? "border-yellow-300/40 text-yellow-300" :
                "border-border/40 text-muted-foreground"
              )}>
                {multi.alignment.replace("_", " ")}
              </span>
              <p className="font-mono text-xs text-foreground flex-1">
                {multi.predictionKo}
              </p>
            </div>
            <p className="font-mono text-[10px] text-muted-foreground mt-1.5 px-1">
              EN: {multi.prediction}
            </p>
          </HudPanel>

          {/* Per-TF cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {trends.map((t) => (
              <TFCard
                key={t.timeframe}
                trend={t}
                selected={t.timeframe === selectedTF}
                onSelect={() => setSelectedTF(t.timeframe as TFv)}
              />
            ))}
          </div>

          {/* Selected TF detail (chart + reason) */}
          {selectedTrend && (
            <HudPanel
              title={`${selectedTrend.label} Detail`}
              subtitle={`${selectedCandles.length} candles · 추세선 + 가격 + 거래량`}
            >
              <div className="h-[360px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 10, right: 60, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/20" />
                    <XAxis
                      dataKey="timeLabel"
                      tick={{ fontSize: 9, fontFamily: "Share Tech Mono" }}
                      interval="preserveStartEnd"
                      tickCount={8}
                    />
                    <YAxis
                      tick={{ fontSize: 9, fontFamily: "Share Tech Mono" }}
                      tickFormatter={(v) => `$${formatPrice(v)}`}
                      width={60}
                      orientation="right"
                      domain={["auto", "auto"]}
                    />
                    <RTooltip
                      contentStyle={{
                        backgroundColor: "oklch(0.14 0.015 260)",
                        border: "1px solid oklch(0.3 0.02 260)",
                        fontFamily: "Share Tech Mono",
                        fontSize: 10,
                      }}
                      formatter={(v: number, n: string) => [`$${formatPrice(v)}`, n]}
                    />
                    {/* EMA reference lines (latest values) */}
                    <ReferenceLine
                      y={selectedTrend.emaAlignment.ema9}
                      stroke="oklch(0.7 0.18 60)"
                      strokeDasharray="3 3"
                      strokeWidth={1}
                      label={{ value: "EMA9", position: "right", fill: "oklch(0.7 0.18 60)", fontSize: 8, fontFamily: "Share Tech Mono" }}
                    />
                    <ReferenceLine
                      y={selectedTrend.emaAlignment.ema21}
                      stroke="oklch(0.65 0.18 235)"
                      strokeDasharray="3 3"
                      strokeWidth={1}
                      label={{ value: "EMA21", position: "right", fill: "oklch(0.65 0.18 235)", fontSize: 8, fontFamily: "Share Tech Mono" }}
                    />
                    <ReferenceLine
                      y={selectedTrend.emaAlignment.ema50}
                      stroke="oklch(0.7 0.22 305)"
                      strokeDasharray="3 3"
                      strokeWidth={1}
                      label={{ value: "EMA50", position: "right", fill: "oklch(0.7 0.22 305)", fontSize: 8, fontFamily: "Share Tech Mono" }}
                    />
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
                    {selectedTrend.supportLine && (
                      <Line
                        type="linear"
                        dataKey="support"
                        name="Support"
                        stroke="oklch(0.7 0.22 145)"
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                      />
                    )}
                    {selectedTrend.resistanceLine && (
                      <Line
                        type="linear"
                        dataKey="resistance"
                        name="Resistance"
                        stroke="oklch(0.65 0.25 25)"
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                      />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              {/* Volume strip */}
              <div className="h-[60px] w-full mt-2 border-t border-border/20 pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 0, right: 60, left: 10, bottom: 0 }}>
                    <XAxis dataKey="timeLabel" hide />
                    <YAxis
                      tick={{ fontSize: 8, fontFamily: "Share Tech Mono" }}
                      tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}K` : `${v}`)}
                      width={60}
                      orientation="right"
                    />
                    <Bar dataKey="volume" fill="oklch(0.65 0.02 260 / 0.5)" isAnimationActive={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
                <ReasonPanel trend={selectedTrend} />
                <TrendlinePanel trend={selectedTrend} />
              </div>
            </HudPanel>
          )}
        </>
      )}
    </div>
  );
}

// ─── OverallStat block ─────────────────────────────────────────────

function OverallStat({
  label,
  value,
  color,
  icon,
  bar,
}: {
  label: string;
  value: string;
  color: string;
  icon?: React.ReactNode;
  bar?: number;
}) {
  return (
    <div className="bg-background/40 border border-border/30 rounded-sm px-3 py-2">
      <div className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider mb-1">
        {label}
      </div>
      <div className={cn("font-display text-xl font-bold flex items-center gap-2", color)}>
        {icon}
        {value}
      </div>
      {bar !== undefined && (
        <div className="mt-1.5 h-1 bg-muted/30 rounded-sm overflow-hidden">
          <div
            className={cn(
              "h-full rounded-sm transition-all",
              bar >= 70 ? "bg-neon-green" : bar >= 50 ? "bg-neon-cyan" : "bg-neon-red"
            )}
            style={{ width: `${Math.min(100, bar)}%` }}
          />
        </div>
      )}
    </div>
  );
}

// ─── Per-TF card ───────────────────────────────────────────────────

function TFCard({
  trend,
  selected,
  onSelect,
}: {
  trend: TimeframeTrend;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "text-left bg-card/80 backdrop-blur-sm border rounded-sm overflow-hidden p-3 space-y-2 transition-all hover:border-neon-cyan/40",
        selected ? "border-neon-cyan/60 ring-1 ring-neon-cyan/30" : "border-border/40",
        directionBg(trend.direction)
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="font-display text-sm font-bold tracking-wider text-foreground">
          {trend.label}
        </span>
        <DirectionIcon d={trend.direction} className="h-4 w-4" />
      </div>
      {/* Phase */}
      <div className={cn("font-mono text-[11px] font-bold", phaseColor(trend.phase))}>
        {phaseLabel(trend.phase)}
      </div>
      {/* Strength bar */}
      <div className="space-y-1">
        <div className="flex items-baseline justify-between font-mono text-[10px]">
          <span className="text-muted-foreground uppercase">Strength</span>
          <span className={directionColor(trend.direction)}>{trend.strength}%</span>
        </div>
        <div className="h-1 bg-muted/30 rounded-sm overflow-hidden">
          <div
            className={cn(
              "h-full transition-all",
              trend.direction === "BULLISH" ? "bg-neon-green" :
              trend.direction === "BEARISH" ? "bg-neon-red" :
              "bg-neon-cyan"
            )}
            style={{ width: `${trend.strength}%` }}
          />
        </div>
      </div>
      {/* Mini facts */}
      <div className="grid grid-cols-2 gap-1 font-mono text-[10px]">
        <Fact label="ADX" value={trend.adxValue.toFixed(1)} highlight={trend.adxTrending ? "text-neon-cyan" : "text-muted-foreground"} />
        <Fact label="EMA" value={emaShort(trend.emaAlignment.state)} />
        <Fact
          label="MOM"
          value={`${trend.recentMomentum >= 0 ? "+" : ""}${trend.recentMomentum.toFixed(2)}%`}
          highlight={trend.recentMomentum > 0 ? "text-neon-green" : trend.recentMomentum < 0 ? "text-neon-red" : "text-muted-foreground"}
        />
        <Fact
          label="VOL"
          value={trend.volumeTrend}
          highlight={trend.volumeConfirmed ? "text-neon-green" : "text-neon-red"}
        />
      </div>
      {/* Structure & breakout */}
      <div className="font-mono text-[10px] text-muted-foreground border-t border-border/20 pt-1.5">
        {trend.hhllCount.structureLabel}
      </div>
      {trend.breakout.detected && (
        <div className={cn(
          "flex items-center gap-1 font-mono text-[10px] px-1.5 py-1 rounded-sm border",
          trend.breakout.type === "BULLISH_BREAKOUT"
            ? "border-neon-green/40 text-neon-green bg-neon-green/10"
            : "border-neon-red/40 text-neon-red bg-neon-red/10"
        )}>
          <Zap className="h-3 w-3" />
          {trend.breakout.type === "BULLISH_BREAKOUT" ? "상향 돌파" : "하향 이탈"} ({trend.breakout.confidence}%)
        </div>
      )}
    </button>
  );
}

function Fact({ label, value, highlight }: { label: string; value: string; highlight?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-1">
      <span className="text-muted-foreground/70">{label}</span>
      <span className={cn("text-foreground", highlight)}>{value}</span>
    </div>
  );
}

function emaShort(state: string): string {
  if (state === "GOLDEN_CROSS") return "↑GC";
  if (state === "DEATH_CROSS") return "↓DC";
  if (state === "BULLISH_ALIGNED") return "정배";
  if (state === "BEARISH_ALIGNED") return "역배";
  return "혼합";
}

// ─── Reason / Trendline detail panels ─────────────────────────────

function ReasonPanel({ trend }: { trend: TimeframeTrend }) {
  const lines = trend.reason.split(" | ");
  return (
    <div className="bg-background/40 border border-border/30 rounded-sm px-3 py-2 space-y-1">
      <div className="flex items-center gap-2 font-display text-[11px] tracking-wider text-neon-pink">
        <AlertTriangle className="h-3 w-3" />
        판단 근거
      </div>
      {lines.map((line, i) => (
        <div key={i} className="font-mono text-[10px] text-muted-foreground">
          • {line}
        </div>
      ))}
      <div className="pt-1.5 border-t border-border/20 mt-1.5">
        <div className="font-mono text-[10px] text-muted-foreground">
          {trend.emaAlignment.description}
        </div>
      </div>
    </div>
  );
}

function TrendlinePanel({ trend }: { trend: TimeframeTrend }) {
  return (
    <div className="bg-background/40 border border-border/30 rounded-sm px-3 py-2 space-y-2">
      <div className="font-display text-[11px] tracking-wider text-neon-pink">추세선</div>
      <TrendlineRow type="support" line={trend.supportLine} />
      <TrendlineRow type="resistance" line={trend.resistanceLine} />
      <div className="pt-1.5 border-t border-border/20 mt-1.5 grid grid-cols-2 gap-2">
        <Fact label="POSITION" value={posLabel(trend.pricePosition)} />
        <Fact label="MOMENTUM" value={`${trend.recentMomentum >= 0 ? "+" : ""}${trend.recentMomentum.toFixed(2)}%`}
          highlight={trend.recentMomentum > 0 ? "text-neon-green" : "text-neon-red"} />
      </div>
    </div>
  );
}

function TrendlineRow({ type, line }: { type: "support" | "resistance"; line: TrendlineInfo | null }) {
  const color = type === "support" ? "text-neon-green" : "text-neon-red";
  const label = type === "support" ? "↑ 지지선" : "↓ 저항선";
  if (!line) {
    return (
      <div className="font-mono text-[10px] text-muted-foreground/60">
        {label}: 미감지
      </div>
    );
  }
  return (
    <div className="space-y-0.5 font-mono text-[10px]">
      <div className={cn("font-bold", color)}>{label}</div>
      <Fact label="START" value={`$${formatPrice(line.startPrice)}`} />
      <Fact label="END" value={`$${formatPrice(line.endPrice)}`} />
      <Fact label="SLOPE" value={`${line.slopePct >= 0 ? "+" : ""}${line.slopePct.toFixed(3)}% /c`} />
      <Fact label="TOUCHES" value={`${line.touchCount}`} />
    </div>
  );
}

function posLabel(p: TimeframeTrend["pricePosition"]): string {
  switch (p) {
    case "ABOVE_RESISTANCE": return "저항선 위";
    case "NEAR_RESISTANCE": return "저항선 근접";
    case "MID_RANGE": return "중간 영역";
    case "NEAR_SUPPORT": return "지지선 근접";
    case "BELOW_SUPPORT": return "지지선 아래";
  }
}
