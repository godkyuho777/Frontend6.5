import { HudPanel, StatCard } from "@/components/HudPanel";
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { useWaveTracker } from "@/hooks/useWaveTracker";
import { cn } from "@/lib/utils";
import {
  Activity,
  AlertTriangle,
  Loader2,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Waves,
  Zap,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";

type OIInterval = "5min" | "15min" | "30min" | "1h" | "4h" | "1d";

const OI_INTERVALS: { label: string; value: OIInterval }[] = [
  { label: "5M", value: "5min" },
  { label: "15M", value: "15min" },
  { label: "30M", value: "30min" },
  { label: "1H", value: "1h" },
  { label: "4H", value: "4h" },
  { label: "1D", value: "1d" },
];

const oiChartConfig: ChartConfig = {
  openInterest: {
    label: "Open Interest (BTC)",
    color: "oklch(0.82 0.18 195)",
  },
};

const lsChartConfig: ChartConfig = {
  buyRatio: {
    label: "Long %",
    color: "oklch(0.82 0.22 145)",
  },
  sellRatio: {
    label: "Short %",
    color: "oklch(0.65 0.25 25)",
  },
};

const fundingChartConfig: ChartConfig = {
  fundingRate: {
    label: "Funding Rate",
    color: "oklch(0.88 0.18 95)",
  },
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function formatNumber(n: number, decimals = 0): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(decimals)}K`;
  return n.toFixed(decimals);
}

// ─── Wave Score Gauge ────────────────────────────────────────

function WaveGauge({ score, label }: { score: number; label: string }) {
  const getColor = () => {
    if (score >= 75) return { ring: "text-neon-red", glow: "glow-red", bg: "bg-neon-red" };
    if (score >= 50) return { ring: "text-neon-yellow", glow: "", bg: "bg-neon-yellow" };
    if (score >= 25) return { ring: "text-neon-cyan", glow: "glow-cyan", bg: "bg-neon-cyan" };
    return { ring: "text-muted-foreground", glow: "", bg: "bg-muted-foreground" };
  };

  const getLabelText = () => {
    switch (label) {
      case "WAVE_LIKELY": return "WAVE LIKELY";
      case "IMMINENT": return "IMMINENT";
      case "BUILDING": return "BUILDING";
      default: return "SIDEWAYS";
    }
  };

  const getLabelKo = () => {
    switch (label) {
      case "WAVE_LIKELY": return "파동 임박";
      case "IMMINENT": return "파동 징후";
      case "BUILDING": return "에너지 축적";
      default: return "횡보 구간";
    }
  };

  const colors = getColor();
  const circumference = 2 * Math.PI * 54;
  const dashOffset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-36 h-36">
        {/* Background circle */}
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle
            cx="60" cy="60" r="54"
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            className="text-border/30"
          />
          <circle
            cx="60" cy="60" r="54"
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            className={cn(colors.ring, "transition-all duration-1000 ease-out")}
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn("font-display text-3xl font-bold", colors.ring, colors.glow)}>
            {score}
          </span>
          <span className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider">
            / 100
          </span>
        </div>
      </div>
      <div className="text-center">
        <div className={cn("font-display text-sm font-bold tracking-wider", colors.ring)}>
          {getLabelText()}
        </div>
        <div className="font-mono text-xs text-muted-foreground mt-0.5">
          {getLabelKo()}
        </div>
      </div>
    </div>
  );
}

// ─── Liquidation Pressure Bar ────────────────────────────────

function LiquidationPressureBar({
  longPressure,
  shortPressure,
  dominantSide,
}: {
  longPressure: number;
  shortPressure: number;
  dominantSide: "long" | "short" | "balanced";
}) {
  const total = longPressure + shortPressure;
  const longPct = total > 0 ? (longPressure / total) * 100 : 50;
  const shortPct = total > 0 ? (shortPressure / total) * 100 : 50;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-3.5 w-3.5 text-neon-green" />
          <span className="font-mono text-xs text-neon-green">
            LONG {longPressure}%
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-neon-red">
            SHORT {shortPressure}%
          </span>
          <TrendingDown className="h-3.5 w-3.5 text-neon-red" />
        </div>
      </div>

      {/* Pressure bar */}
      <div className="relative h-5 rounded-sm overflow-hidden bg-card border border-border/30">
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-neon-green/60 to-neon-green/30 transition-all duration-700"
          style={{ width: `${longPct}%` }}
        />
        <div
          className="absolute inset-y-0 right-0 bg-gradient-to-l from-neon-red/60 to-neon-red/30 transition-all duration-700"
          style={{ width: `${shortPct}%` }}
        />
        {/* Center marker */}
        <div className="absolute inset-y-0 left-1/2 w-px bg-foreground/30" />
      </div>

      <div className="text-center">
        <span className={cn(
          "font-mono text-[10px] uppercase tracking-wider",
          dominantSide === "long" ? "text-neon-green" : dominantSide === "short" ? "text-neon-red" : "text-muted-foreground"
        )}>
          {dominantSide === "long"
            ? "롱 청산 압력 우세 → 하방 파동 가능"
            : dominantSide === "short"
              ? "숏 청산 압력 우세 → 상방 파동 가능"
              : "균형 상태 → 방향성 미정"}
        </span>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────

export default function WaveSentiment() {
  const [oiInterval, setOiInterval] = useState<OIInterval>("1h");
  const {
    snapshot,
    oiHistory,
    lsHistory,
    fundingHistory,
    analysis,
    isLoading,
    error,
    lastUpdated,
    refetch,
  } = useWaveTracker(oiInterval);

  // ── Chart data ──
  const oiChartData = useMemo(
    () =>
      oiHistory.map((d) => ({
        time: formatTime(d.timestamp),
        openInterest: d.openInterest,
      })),
    [oiHistory]
  );

  const lsChartData = useMemo(
    () =>
      lsHistory.map((d) => ({
        time: formatTime(d.timestamp),
        buyRatio: +(d.buyRatio * 100).toFixed(2),
        sellRatio: +(d.sellRatio * 100).toFixed(2),
      })),
    [lsHistory]
  );

  const fundingChartData = useMemo(
    () =>
      fundingHistory.map((d) => ({
        time: formatDate(d.timestamp),
        fundingRate: +(d.fundingRate * 100).toFixed(6),
      })),
    [fundingHistory]
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-wider text-neon-pink glow-pink flex items-center gap-3">
            <Waves className="h-6 w-6" />
            SENTIMENT & MATRIX
          </h1>
          <p className="font-mono text-xs text-muted-foreground mt-1">
            BTC PERPETUAL // OI · LONG/SHORT · FUNDING · LIQUIDATIONS // BYBIT DATA
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Interval Selector */}
          <div className="flex items-center gap-1.5 bg-card/50 border border-border/30 rounded-sm px-2 py-1">
            <Activity className="h-3 w-3 text-neon-cyan" />
            <div className="flex gap-0.5">
              {OI_INTERVALS.map((iv) => (
                <button
                  key={iv.value}
                  onClick={() => setOiInterval(iv.value)}
                  className={cn(
                    "font-mono text-[10px] px-2 py-1 rounded-sm transition-all",
                    oiInterval === iv.value
                      ? "bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                  )}
                >
                  {iv.label}
                </button>
              ))}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={refetch}
            disabled={isLoading}
            className="border-neon-cyan/30 text-neon-cyan hover:bg-neon-cyan/10 font-mono text-xs"
          >
            {isLoading ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
            ) : (
              <RefreshCw className="h-3 w-3 mr-1" />
            )}
            REFRESH
          </Button>
        </div>
      </div>

      {/* Loading */}
      {isLoading && !snapshot && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-neon-pink" />
          <div className="text-center">
            <p className="font-mono text-sm text-foreground">Loading BTC derivatives data...</p>
            <p className="font-mono text-xs text-muted-foreground mt-1">
              Fetching OI, Long/Short Ratio, Funding Rate from Bybit
            </p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && !snapshot && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <AlertTriangle className="h-8 w-8 text-neon-red" />
          <p className="font-mono text-sm text-neon-red">Failed to load data</p>
          <Button
            variant="outline"
            size="sm"
            onClick={refetch}
            className="border-neon-cyan/30 text-neon-cyan hover:bg-neon-cyan/10 font-mono text-xs mt-2"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            RETRY
          </Button>
        </div>
      )}

      {/* Main content */}
      {snapshot && analysis && (
        <>
          {/* BTC Price Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <StatCard
              label="BTC Price"
              value={`$${snapshot.price.toLocaleString()}`}
              change={snapshot.change24h}
            />
            <StatCard
              label="Open Interest"
              value={formatNumber(snapshot.openInterest, 0)}
              unit="BTC"
            />
            <StatCard
              label="OI Value"
              value={`$${formatNumber(snapshot.openInterestValue)}`}
            />
            <StatCard
              label="24h Volume"
              value={formatNumber(snapshot.volume24h, 0)}
              unit="BTC"
            />
            <StatCard
              label="Funding Rate"
              value={`${(snapshot.fundingRate * 100).toFixed(4)}%`}
              variant={snapshot.fundingRate > 0.0001 ? "negative" : snapshot.fundingRate < -0.0001 ? "positive" : "default"}
            />
            <StatCard
              label="OI Change"
              value={`${analysis.oiChangeRate >= 0 ? "+" : ""}${analysis.oiChangeRate.toFixed(2)}%`}
              variant={analysis.oiChangeRate > 2 ? "positive" : analysis.oiChangeRate < -2 ? "negative" : "default"}
            />
          </div>

          {/* Wave Analysis + Liquidation Pressure */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Wave Gauge */}
            <HudPanel
              title="Wave Score"
              subtitle="OI + LS RATIO + FUNDING COMPOSITE"
              variant="highlight"
            >
              <div className="flex flex-col items-center py-4">
                <WaveGauge score={analysis.score} label={analysis.label} />
              </div>
            </HudPanel>

            {/* Liquidation Pressure */}
            <HudPanel
              title="Liquidation Pressure"
              subtitle="ESTIMATED FROM LONG/SHORT RATIO"
            >
              <div className="py-4">
                <LiquidationPressureBar
                  longPressure={analysis.longPressure}
                  shortPressure={analysis.shortPressure}
                  dominantSide={analysis.dominantLiqSide}
                />
              </div>
            </HudPanel>

            {/* Analysis Reasons */}
            <HudPanel
              title="Analysis Detail"
              subtitle="WAVE DETECTION REASONS"
            >
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {analysis.reasons.map((reason, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 text-xs font-mono"
                  >
                    <Zap className={cn(
                      "h-3 w-3 mt-0.5 shrink-0",
                      analysis.score >= 50 ? "text-neon-yellow" : "text-muted-foreground"
                    )} />
                    <span className="text-foreground/80 leading-relaxed">{reason}</span>
                  </div>
                ))}
              </div>
            </HudPanel>
          </div>

          {/* OI History Chart */}
          <HudPanel
            title="Open Interest History"
            subtitle={`BTCUSDT PERP · ${oiInterval.toUpperCase()} INTERVAL · ${oiHistory.length} DATA POINTS`}
          >
            {oiChartData.length > 0 ? (
              <ChartContainer config={oiChartConfig} className="h-[250px] w-full">
                <AreaChart data={oiChartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="oiGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="oklch(0.82 0.18 195)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="oklch(0.82 0.18 195)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/20" />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 9, fontFamily: "Share Tech Mono" }}
                    interval="preserveStartEnd"
                    tickCount={8}
                  />
                  <YAxis
                    tick={{ fontSize: 9, fontFamily: "Share Tech Mono" }}
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`}
                    domain={["dataMin - 500", "dataMax + 500"]}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelFormatter={(_, payload) => {
                          if (payload?.[0]?.payload?.time) return payload[0].payload.time;
                          return "";
                        }}
                        formatter={(value) => (
                          <span className="font-mono text-neon-cyan">
                            {Number(value).toLocaleString()} BTC
                          </span>
                        )}
                      />
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="openInterest"
                    stroke="oklch(0.82 0.18 195)"
                    strokeWidth={2}
                    fill="url(#oiGradient)"
                  />
                </AreaChart>
              </ChartContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground font-mono text-sm">
                No OI data available
              </div>
            )}
          </HudPanel>

          {/* Long/Short Ratio Chart */}
          <HudPanel
            title="Long / Short Ratio"
            subtitle={`ACCOUNT RATIO · ${oiInterval.toUpperCase()} INTERVAL`}
          >
            {lsChartData.length > 0 ? (
              <ChartContainer config={lsChartConfig} className="h-[250px] w-full">
                <AreaChart data={lsChartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="longGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="oklch(0.82 0.22 145)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="oklch(0.82 0.22 145)" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="shortGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="oklch(0.65 0.25 25)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="oklch(0.65 0.25 25)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/20" />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 9, fontFamily: "Share Tech Mono" }}
                    interval="preserveStartEnd"
                    tickCount={8}
                  />
                  <YAxis
                    tick={{ fontSize: 9, fontFamily: "Share Tech Mono" }}
                    tickFormatter={(v) => `${v}%`}
                    domain={[40, 60]}
                  />
                  <ReferenceLine y={50} stroke="oklch(0.65 0.02 260)" strokeDasharray="3 3" />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelFormatter={(_, payload) => {
                          if (payload?.[0]?.payload?.time) return payload[0].payload.time;
                          return "";
                        }}
                      />
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="buyRatio"
                    stroke="oklch(0.82 0.22 145)"
                    strokeWidth={2}
                    fill="url(#longGradient)"
                    name="buyRatio"
                  />
                  <Area
                    type="monotone"
                    dataKey="sellRatio"
                    stroke="oklch(0.65 0.25 25)"
                    strokeWidth={2}
                    fill="url(#shortGradient)"
                    name="sellRatio"
                  />
                </AreaChart>
              </ChartContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground font-mono text-sm">
                No Long/Short data available
              </div>
            )}
          </HudPanel>

          {/* Funding Rate Chart */}
          <HudPanel
            title="Funding Rate History"
            subtitle="8H INTERVAL · BTCUSDT PERP"
          >
            {fundingChartData.length > 0 ? (
              <ChartContainer config={fundingChartConfig} className="h-[200px] w-full">
                <BarChart data={fundingChartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/20" />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 9, fontFamily: "Share Tech Mono" }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 9, fontFamily: "Share Tech Mono" }}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <ReferenceLine y={0} stroke="oklch(0.65 0.02 260)" />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelFormatter={(_, payload) => {
                          if (payload?.[0]?.payload?.time) return payload[0].payload.time;
                          return "";
                        }}
                        formatter={(value) => (
                          <span className="font-mono text-neon-yellow">
                            {Number(value).toFixed(4)}%
                          </span>
                        )}
                      />
                    }
                  />
                  <Bar
                    dataKey="fundingRate"
                    fill="oklch(0.88 0.18 95)"
                    radius={[2, 2, 0, 0]}
                  />
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-muted-foreground font-mono text-sm">
                No Funding Rate data available
              </div>
            )}
          </HudPanel>

          {/* Last updated */}
          {lastUpdated && (
            <div className="text-center font-mono text-[10px] text-muted-foreground">
              Last updated: {new Date(lastUpdated).toLocaleTimeString()} · Data from Bybit V5 API
            </div>
          )}
        </>
      )}
    </div>
  );
}
