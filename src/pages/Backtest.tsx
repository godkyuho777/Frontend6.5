/**
 * Backtesting Engine Page
 *
 * BBDX Signal Tracker 전략을 과거 데이터에 적용해 성과를 측정.
 * 04_TREND_WEIGHTING_FRAMEWORK.md Phase 2 기반 calibration pipeline 시각화.
 */

import { trpc } from "@/lib/trpc";
import { HudPanel } from "@/components/HudPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  FlaskConical,
  Loader2,
  Play,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { EquityChart } from "@/components/backtest/EquityChart";
import {
  BacktestStatCard,
  MetricCards,
} from "@/components/backtest/MetricCards";
import { TradeTable } from "@/components/backtest/TradeTable";
import { TradeDetailCardList } from "@/components/backtest/TradeDetailCard";
import { CalibrationPanel } from "@/components/backtest/CalibrationPanel";
import { CompositeBacktest } from "@/components/backtest/CompositeBacktest";
import EngineATab from "./backtest/EngineATab";
import EngineBTab from "./backtest/EngineBTab";

// ─── Types ────────────────────────────────────────────────

type TfOption = "1h" | "4h" | "6h" | "1d" | "1w";
// 백엔드 routers.ts 의 strategy enum 과 1:1 매핑. 새 전략 추가 시 양쪽 sync.
type StrategyOption =
  | "bbdx"
  | "bbdx-short"
  | "fibonacci"
  | "vwap"
  | "trend"
  | "trend-follow";

interface BacktestConfig {
  symbolsText: string;
  tf: TfOption;
  startDate: string;
  endDate: string;
  outcomeWindowCandles: number;
  cooldownCandles: number;
  saveToDb: boolean;
  runName: string;
  strategy: StrategyOption;
}

// 전략 메타 (백엔드 listStrategies 와 동일 enum).
// Tailwind 정적 분석을 위해 색상별 클래스 문자열을 explicit 하게 명시.
const STRATEGY_META: Record<
  StrategyOption,
  {
    label: string;
    description: string;
    activeClass: string; // 선택 상태 (border + text + bg)
    badgeClass: string;  // RESULTS 탭 badge
    textClass: string;
  }
> = {
  bbdx: {
    label: "BBDX",
    description: "RSI + BB + ADX 멀티-패스 (BB → PTN → NUM)",
    activeClass: "border-neon-pink text-neon-pink bg-neon-pink/10",
    badgeClass: "text-neon-pink border-neon-pink/40 bg-neon-pink/10",
    textClass: "text-neon-pink",
  },
  "bbdx-short": {
    label: "BBDX SHORT",
    description: "BBDX 의 SHORT 진입 (BB 상단 돌파 후 reversal)",
    activeClass: "border-rose-400 text-rose-400 bg-rose-500/10",
    badgeClass: "text-rose-400 border-rose-400/40 bg-rose-500/10",
    textClass: "text-rose-400",
  },
  fibonacci: {
    label: "Fibonacci",
    description: "Golden zone 0.382~0.618 진입 + Fib 1.0/1.272 타겟",
    activeClass: "border-neon-yellow text-neon-yellow bg-neon-yellow/10",
    badgeClass: "text-neon-yellow border-neon-yellow/40 bg-neon-yellow/10",
    textClass: "text-neon-yellow",
  },
  vwap: {
    label: "VWAP",
    description: "VWAP + EMA9 풀백 진입 + 1σ/2σ 밴드",
    activeClass: "border-neon-cyan text-neon-cyan bg-neon-cyan/10",
    badgeClass: "text-neon-cyan border-neon-cyan/40 bg-neon-cyan/10",
    textClass: "text-neon-cyan",
  },
  trend: {
    label: "Trend (Wave)",
    description: "멀티 TF 추세 정합 (EMA9>21>50 + ADX≥20 + HH/HL)",
    activeClass: "border-neon-green text-neon-green bg-neon-green/10",
    badgeClass: "text-neon-green border-neon-green/40 bg-neon-green/10",
    textClass: "text-neon-green",
  },
  "trend-follow": {
    label: "Trend-Follow ⭐",
    description: "5-gate (EMA 정배열 + ADX≥25 + +DI>-DI + price>SMA50 + HH) — winRate 44.8% (365d, P1 검증)",
    activeClass: "border-emerald-400 text-emerald-300 bg-emerald-500/10",
    badgeClass: "text-emerald-300 border-emerald-400/40 bg-emerald-500/10",
    textClass: "text-emerald-300",
  },
};

type SortKey =
  | "symbol"
  | "winRate"
  | "avgReturn"
  | "sharpe"
  | "totalTrades"
  | "maxDrawdown"
  | "expectancy";

// ─── Preset 심볼 그룹 ────────────────────────────────────

const SYMBOL_PRESETS = {
  "Top 5": "BTCUSDT,ETHUSDT,SOLUSDT,XRPUSDT,AAVEUSDT",
  "Top 10":
    "BTCUSDT,ETHUSDT,SOLUSDT,XRPUSDT,AAVEUSDT,DOGEUSDT,SUIUSDT,PEPEUSDT,AVAXUSDT,ADAUSDT",
  "BTC+ETH": "BTCUSDT,ETHUSDT",
};

// StatCard / EquityCurve / TradeRow 는 components/backtest/ 로 추출됨.
// (BacktestStatCard, EquityChart, TradeTable 로 import)

// ─── Exit Reason Pie Chart ────────────────────────────────

function ExitReasonChart({
  trades,
}: {
  trades: Array<{ exitReason: string }>;
}) {
  const counts: Record<string, number> = {
    target_hit: 0,
    stop_loss: 0,
    window_expired: 0,
    // v6.5 Phase 1 tiered exits
    tier2_full: 0,
    tier1_then_window: 0,
    tier1_then_stop: 0,
  };
  for (const t of trades) {
    counts[t.exitReason] = (counts[t.exitReason] ?? 0) + 1;
  }
  const data = [
    { name: "T1+T2 둘 다 (≥+5%)", value: counts.tier2_full, color: "#10b981" },
    { name: "목표가 (legacy)", value: counts.target_hit, color: "#00f5d4" },
    { name: "T1 후 만료", value: counts.tier1_then_window, color: "#06b6d4" },
    { name: "T1 후 손절", value: counts.tier1_then_stop, color: "#fb923c" },
    { name: "손절", value: counts.stop_loss, color: "#ff6b6b" },
    { name: "만료", value: counts.window_expired, color: "#ffd166" },
  ].filter((d) => d.value > 0);

  return (
    <ResponsiveContainer width="100%" height={140}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={36}
          outerRadius={56}
          paddingAngle={3}
          dataKey="value"
        >
          {data.map((entry, idx) => (
            <Cell key={idx} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: "#0d0d14",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "4px",
            fontFamily: "monospace",
            fontSize: "11px",
          }}
          formatter={(value: number, name: string) => [
            `${value}건`,
            name,
          ]}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ─── Symbol Breakdown Table ───────────────────────────────

type BySymbolEntry = {
  symbol: string;
  totalTrades: number;
  winRate: number;
  avgReturn: number;
  sharpe: number;
  maxDrawdown: number;
  expectancy: number;
};

function SymbolTable({ bySymbol }: { bySymbol: Record<string, any> }) {
  const [sortKey, setSortKey] = useState<SortKey>("winRate");
  const [sortAsc, setSortAsc] = useState(false);

  const rows: BySymbolEntry[] = useMemo(
    () =>
      Object.entries(bySymbol)
        .map(([symbol, m]) => ({ symbol, ...m }))
        .filter((r) => r.totalTrades > 0)
        .sort((a, b) => {
          const mul = sortAsc ? 1 : -1;
          if (sortKey === "symbol") return mul * a.symbol.localeCompare(b.symbol);
          return mul * ((a[sortKey] as number) - (b[sortKey] as number));
        }),
    [bySymbol, sortKey, sortAsc]
  );

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((p) => !p);
    else { setSortKey(key); setSortAsc(false); }
  };

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k ? (
      sortAsc ? <ChevronUp className="h-3 w-3 inline ml-0.5" /> : <ChevronDown className="h-3 w-3 inline ml-0.5" />
    ) : null;

  const th = (k: SortKey, label: string) => (
    <th
      className="px-2 py-2 text-left font-mono text-[10px] text-muted-foreground uppercase cursor-pointer hover:text-neon-cyan transition-colors whitespace-nowrap"
      onClick={() => handleSort(k)}
    >
      {label}
      <SortIcon k={k} />
    </th>
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border/20">
            {th("symbol", "Symbol")}
            {th("totalTrades", "Trades")}
            {th("winRate", "Win Rate")}
            {th("avgReturn", "Avg Return")}
            {th("sharpe", "Sharpe")}
            {th("maxDrawdown", "MDD")}
            {th("expectancy", "Expectancy")}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.symbol}
              className="border-b border-border/10 hover:bg-neon-cyan/5 transition-colors"
            >
              <td className="px-2 py-2 font-display font-bold text-foreground">
                {r.symbol.replace("USDT", "")}
              </td>
              <td className="px-2 py-2 font-mono text-muted-foreground">{r.totalTrades}</td>
              <td className="px-2 py-2 font-mono">
                <span className={r.winRate >= 0.5 ? "text-neon-green" : "text-red-400"}>
                  {(r.winRate * 100).toFixed(1)}%
                </span>
              </td>
              <td className="px-2 py-2 font-mono">
                <span className={r.avgReturn >= 0 ? "text-neon-cyan" : "text-red-400"}>
                  {r.avgReturn >= 0 ? "+" : ""}{r.avgReturn.toFixed(2)}%
                </span>
              </td>
              <td className="px-2 py-2 font-mono">
                <span className={r.sharpe >= 0.5 ? "text-neon-green" : r.sharpe >= 0 ? "text-neon-yellow" : "text-red-400"}>
                  {r.sharpe.toFixed(3)}
                </span>
              </td>
              <td className="px-2 py-2 font-mono text-red-400">{r.maxDrawdown.toFixed(2)}%</td>
              <td className="px-2 py-2 font-mono">
                <span className={r.expectancy >= 0 ? "text-neon-cyan" : "text-red-400"}>
                  {r.expectancy >= 0 ? "+" : ""}{r.expectancy.toFixed(2)}%
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Trade Row ────────────────────────────────────────────

function TradeRow({ trade }: { trade: any }) {
  const exitColors: Record<string, string> = {
    target_hit: "text-neon-green",
    stop_loss: "text-red-400",
    window_expired: "text-neon-yellow",
  };
  const exitLabels: Record<string, string> = {
    target_hit: "TARGET",
    stop_loss: "STOP",
    window_expired: "EXPIRED",
  };

  return (
    <tr className="border-b border-border/10 hover:bg-neon-cyan/5 transition-colors">
      <td className="px-2 py-1.5 font-display font-bold text-xs text-foreground whitespace-nowrap">
        {(trade.symbol as string).replace("USDT", "")}
      </td>
      <td className="px-2 py-1.5 font-mono text-[10px] text-muted-foreground whitespace-nowrap">
        {new Date(trade.signalTs as number).toLocaleDateString("ko-KR", {
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
        <span className={cn(exitColors[trade.exitReason as string] ?? "text-muted-foreground")}>
          {exitLabels[trade.exitReason as string] ?? trade.exitReason}
        </span>
      </td>
      <td className="px-2 py-1.5 font-mono text-xs">
        <span className={(trade.returnPct as number) >= 0 ? "text-neon-cyan" : "text-red-400"}>
          {(trade.returnPct as number) >= 0 ? "+" : ""}{(trade.returnPct as number).toFixed(2)}%
        </span>
      </td>
      <td className="px-2 py-1.5 font-mono text-[10px] text-muted-foreground hidden sm:table-cell">
        RSI {(trade.rsi as number).toFixed(1)}
      </td>
      <td className="px-2 py-1.5 font-mono text-[10px] text-muted-foreground hidden md:table-cell">
        ADX {(trade.adx as number).toFixed(1)}
      </td>
      <td className="px-2 py-1.5 font-mono text-[10px] text-neon-yellow hidden md:table-cell">
        {(trade.signalStrength as number).toFixed(0)}
      </td>
      <td className="px-2 py-1.5 font-mono text-[10px] text-muted-foreground hidden lg:table-cell">
        +{(trade.maxFavorable as number).toFixed(2)}%
      </td>
      <td className="px-2 py-1.5 font-mono text-[10px] text-muted-foreground hidden lg:table-cell">
        -{(trade.maxAdverse as number).toFixed(2)}%
      </td>
    </tr>
  );
}

// ─── Main Page ────────────────────────────────────────────

export default function Backtest() {
  // ── Config state ─────────────────────────────────────
  const [config, setConfig] = useState<BacktestConfig>({
    symbolsText: SYMBOL_PRESETS["Top 5"],
    tf: "4h",
    startDate: new Date(Date.now() - 365 * 86400_000).toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10),
    outcomeWindowCandles: 42,
    cooldownCandles: 5,
    saveToDb: true,
    runName: "",
    strategy: "bbdx",
  });
  const [activeTab, setActiveTab] = useState("config");
  const [tradeWinFilter, setTradeWinFilter] = useState<"all" | "win" | "loss">("all");

  // ── tRPC ────────────────────────────────────────────
  const { data: pastRuns, isLoading: runsLoading } = trpc.backtest.list.useQuery(
    undefined,
    { refetchInterval: 30000 }
  );

  const runMutation = trpc.backtest.run.useMutation({
    onSuccess: () => setActiveTab("results"),
  });

  // ── Derived data ─────────────────────────────────────
  const result = runMutation.data;
  const isRunning = runMutation.isPending;
  const error = runMutation.error;

  const filteredTrades = useMemo(() => {
    if (!result?.trades) return [];
    if (tradeWinFilter === "win") return result.trades.filter((t) => t.win);
    if (tradeWinFilter === "loss") return result.trades.filter((t) => !t.win);
    return result.trades;
  }, [result?.trades, tradeWinFilter]);

  const overall = result?.overall;

  // ── Handlers ─────────────────────────────────────────
  const handleRun = () => {
    const symbols = config.symbolsText
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    if (symbols.length === 0) return;

    const defaultWindow: Record<string, number> = {
      "1h": 168, "4h": 42, "6h": 28, "1d": 14, "1w": 4,
    };

    runMutation.mutate({
      symbols,
      tf: config.tf,
      startDate: config.startDate,
      endDate: config.endDate,
      outcomeWindowCandles: config.outcomeWindowCandles || defaultWindow[config.tf] || 42,
      cooldownCandles: config.cooldownCandles,
      saveToDb: config.saveToDb,
      runName: config.runName || undefined,
      strategy: config.strategy,
    });
  };

  // ── Render ────────────────────────────────────────────
  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold tracking-wider text-neon-pink glow-pink flex items-center gap-2">
          <FlaskConical className="h-6 w-6" />
          BACKTESTING ENGINE
        </h1>
        <p className="font-mono text-xs text-muted-foreground mt-1">
          MULTI-STRATEGY // BBDX · FIBONACCI · VWAP · TREND // HISTORICAL CALIBRATION
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-card/50 border border-border/20 h-8">
          <TabsTrigger value="config" className="font-mono text-xs h-7 data-[state=active]:text-neon-pink">
            CONFIG
          </TabsTrigger>
          <TabsTrigger value="results" className="font-mono text-xs h-7 data-[state=active]:text-neon-cyan" disabled={!result}>
            RESULTS {result ? `(${result.overall.totalTrades})` : ""}
          </TabsTrigger>
          <TabsTrigger value="calibration" className="font-mono text-xs h-7 data-[state=active]:text-neon-pink" disabled={!result}>
            CALIBRATION (v6.5)
          </TabsTrigger>
          <TabsTrigger value="history" className="font-mono text-xs h-7 data-[state=active]:text-neon-yellow">
            PAST RUNS
          </TabsTrigger>
          <TabsTrigger value="engine_a" className="font-mono text-xs h-7 data-[state=active]:text-neon-cyan">
            ENGINE A
          </TabsTrigger>
          <TabsTrigger value="engine_b" className="font-mono text-xs h-7 data-[state=active]:text-neon-pink">
            ENGINE B (BETA)
          </TabsTrigger>
          <TabsTrigger value="composite" className="font-mono text-xs h-7 data-[state=active]:text-neon-cyan">
            COMPOSITE ⚡
          </TabsTrigger>
        </TabsList>

        {/* ── Config Tab ── */}
        <TabsContent value="config" className="mt-3 space-y-3">
          <HudPanel title="Backtest Configuration" subtitle="시그널 전략 파라미터 설정">
            <div className="space-y-4">
              {/* Strategy Selector — Signal Tracker 4 전략 + Wave Tracker Trend */}
              <div>
                <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider block mb-1.5">
                  Strategy (시그널 전략)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(Object.keys(STRATEGY_META) as StrategyOption[]).map((s) => {
                    const meta = STRATEGY_META[s];
                    const active = config.strategy === s;
                    return (
                      <button
                        key={s}
                        onClick={() => setConfig((c) => ({ ...c, strategy: s }))}
                        className={cn(
                          "text-left font-mono text-[10px] px-3 py-2 rounded-sm border transition-all",
                          active
                            ? meta.activeClass
                            : "border-border/30 text-muted-foreground hover:border-border/60"
                        )}
                      >
                        <div className="font-bold uppercase tracking-wider mb-0.5">
                          {meta.label}
                          {active ? " ●" : ""}
                        </div>
                        <div className="text-[9px] text-muted-foreground/80 leading-tight">
                          {meta.description}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <p className="font-mono text-[10px] text-muted-foreground/60 mt-1.5">
                  각 전략별 시그널 발생 시점을 lookahead-free 로 재생하여 정밀한 승률 측정
                </p>
              </div>

              {/* Symbol Presets */}
              <div>
                <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider block mb-1.5">
                  Symbol Presets
                </label>
                <div className="flex gap-2 flex-wrap">
                  {Object.entries(SYMBOL_PRESETS).map(([label, val]) => (
                    <button
                      key={label}
                      onClick={() => setConfig((c) => ({ ...c, symbolsText: val }))}
                      className={cn(
                        "font-mono text-[10px] px-2 py-1 rounded-sm border transition-all",
                        config.symbolsText === val
                          ? "border-neon-cyan text-neon-cyan bg-neon-cyan/10"
                          : "border-border/30 text-muted-foreground hover:border-neon-cyan/40"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Symbols Input */}
              <div>
                <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider block mb-1.5">
                  Symbols (콤마 구분)
                </label>
                <textarea
                  value={config.symbolsText}
                  onChange={(e) => setConfig((c) => ({ ...c, symbolsText: e.target.value }))}
                  rows={2}
                  placeholder="BTCUSDT,ETHUSDT,SOLUSDT"
                  className="w-full font-mono text-xs bg-background border border-border/30 rounded-sm px-3 py-2 text-foreground placeholder:text-muted-foreground/50 focus:border-neon-cyan/50 focus:outline-none resize-none"
                />
                <p className="font-mono text-[10px] text-muted-foreground/60 mt-1">
                  {config.symbolsText.split(",").filter((s) => s.trim()).length}개 심볼 선택됨
                </p>
              </div>

              {/* TF + Dates */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div>
                  <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider block mb-1.5">
                    Timeframe
                  </label>
                  <select
                    value={config.tf}
                    onChange={(e) => {
                      const tf = e.target.value as TfOption;
                      const windowMap: Record<string, number> = {
                        "1h": 168, "4h": 42, "6h": 28, "1d": 14, "1w": 4,
                      };
                      setConfig((c) => ({
                        ...c,
                        tf,
                        outcomeWindowCandles: windowMap[tf] ?? 42,
                      }));
                    }}
                    className="w-full font-mono text-xs bg-background border border-border/30 rounded-sm px-3 py-2 text-foreground focus:border-neon-cyan/50 focus:outline-none"
                  >
                    {["1h", "4h", "6h", "1d", "1w"].map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider block mb-1.5">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={config.startDate}
                    onChange={(e) => setConfig((c) => ({ ...c, startDate: e.target.value }))}
                    className="w-full font-mono text-xs bg-background border border-border/30 rounded-sm px-3 py-2 text-foreground focus:border-neon-cyan/50 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider block mb-1.5">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={config.endDate}
                    onChange={(e) => setConfig((c) => ({ ...c, endDate: e.target.value }))}
                    className="w-full font-mono text-xs bg-background border border-border/30 rounded-sm px-3 py-2 text-foreground focus:border-neon-cyan/50 focus:outline-none"
                  />
                </div>
              </div>

              {/* Advanced */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider block mb-1.5">
                    Outcome Window (캔들)
                  </label>
                  <input
                    type="number"
                    value={config.outcomeWindowCandles}
                    onChange={(e) =>
                      setConfig((c) => ({ ...c, outcomeWindowCandles: parseInt(e.target.value) || 42 }))
                    }
                    min={5}
                    max={200}
                    className="w-full font-mono text-xs bg-background border border-border/30 rounded-sm px-3 py-2 text-foreground focus:border-neon-cyan/50 focus:outline-none"
                  />
                  <p className="font-mono text-[10px] text-muted-foreground/60 mt-1">
                    4h×42 = 7일
                  </p>
                </div>
                <div>
                  <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider block mb-1.5">
                    Cooldown (캔들)
                  </label>
                  <input
                    type="number"
                    value={config.cooldownCandles}
                    onChange={(e) =>
                      setConfig((c) => ({ ...c, cooldownCandles: parseInt(e.target.value) || 5 }))
                    }
                    min={1}
                    max={50}
                    className="w-full font-mono text-xs bg-background border border-border/30 rounded-sm px-3 py-2 text-foreground focus:border-neon-cyan/50 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider block mb-1.5">
                    Run Name (선택)
                  </label>
                  <input
                    type="text"
                    value={config.runName}
                    onChange={(e) => setConfig((c) => ({ ...c, runName: e.target.value }))}
                    placeholder="my_backtest"
                    className="w-full font-mono text-xs bg-background border border-border/30 rounded-sm px-3 py-2 text-foreground placeholder:text-muted-foreground/40 focus:border-neon-cyan/50 focus:outline-none"
                  />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.saveToDb}
                      onChange={(e) => setConfig((c) => ({ ...c, saveToDb: e.target.checked }))}
                      className="accent-neon-cyan"
                    />
                    <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                      DB에 저장
                    </span>
                  </label>
                </div>
              </div>

              {/* Run Button */}
              <div className="flex items-center gap-3 pt-1">
                <Button
                  onClick={handleRun}
                  disabled={isRunning}
                  className="bg-neon-pink/10 border border-neon-pink/40 text-neon-pink hover:bg-neon-pink/20 hover:border-neon-pink font-display font-bold tracking-wider h-9 px-6"
                >
                  {isRunning ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      RUNNING...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      RUN BACKTEST
                    </>
                  )}
                </Button>
                {isRunning && (
                  <p className="font-mono text-[10px] text-neon-yellow animate-pulse">
                    데이터 수집 중... 심볼 수 × 기간에 따라 수분 소요
                  </p>
                )}
              </div>

              {/* Error */}
              {error && (
                <div className="p-3 rounded-sm border border-red-500/30 bg-red-500/10">
                  <p className="font-mono text-xs text-red-400">
                    ❌ {error.message}
                  </p>
                </div>
              )}
            </div>
          </HudPanel>

          {/* How it works */}
          <HudPanel
            title="작동 원리"
            subtitle={`Lookahead-free 시그널 재생 — ${STRATEGY_META[config.strategy].label}`}
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              {[
                {
                  step: "01",
                  color: "text-neon-cyan",
                  title: "데이터 수집",
                  desc: "Bybit에서 선택 기간의 히스토리컬 캔들 전량 수집 (페이지네이션, 최대 1000개/요청)",
                },
                {
                  step: "02",
                  color: "text-neon-pink",
                  title: `${STRATEGY_META[config.strategy].label} 시그널 재생`,
                  desc: `각 캔들 시점에서 ${STRATEGY_META[config.strategy].description} → 진입 조건 체크 (미래 데이터 사용 안 함)`,
                },
                {
                  step: "03",
                  color: "text-neon-green",
                  title: "결과 측정",
                  desc: `시그널 후 ${config.outcomeWindowCandles}캔들 내 목표가(BB-Middle) 도달 vs 손절(BB-Lower×0.97) 추적`,
                },
              ].map((item) => (
                <div
                  key={item.step}
                  className="p-3 rounded-sm border border-border/20 bg-card/30"
                >
                  <div className={cn("font-display font-bold text-lg mb-1", item.color)}>
                    {item.step}
                  </div>
                  <div className="font-mono text-[10px] text-foreground font-medium mb-1">
                    {item.title}
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground leading-relaxed">
                    {item.desc}
                  </div>
                </div>
              ))}
            </div>
          </HudPanel>
        </TabsContent>

        {/* ── Results Tab ── */}
        <TabsContent value="results" className="mt-3 space-y-3">
          {result && overall ? (
            <>
              {/* Run summary */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Strategy badge — 어떤 전략으로 돌렸는지 표기 */}
                  <Badge
                    className={cn(
                      "font-mono text-[10px] border uppercase tracking-wider",
                      STRATEGY_META[config.strategy].badgeClass
                    )}
                  >
                    STRATEGY: {STRATEGY_META[config.strategy].label}
                  </Badge>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    완료: {new Date(result.runAt).toLocaleString("ko-KR")}
                    {" · "}소요: {(result.durationMs / 1000).toFixed(1)}초
                    {result.runId && ` · run #${result.runId}`}
                  </span>
                </div>
                <Badge
                  className={cn(
                    "font-mono text-[10px] border",
                    overall.expectancy > 0
                      ? "text-neon-green border-neon-green/30 bg-neon-green/10"
                      : "text-red-400 border-red-400/30 bg-red-400/10"
                  )}
                >
                  {overall.expectancy > 0 ? "✓ POSITIVE" : "✗ NEGATIVE"} EV
                </Badge>
              </div>

              {/* Stat Cards */}
              <MetricCards overall={overall} variant="full" />

              {/* Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                <div className="lg:col-span-2">
                  <HudPanel title="Equity Curve" subtitle="누적 수익률 (기준 100)">
                    <EquityChart trades={result.trades as any} />
                  </HudPanel>
                </div>
                <div>
                  <HudPanel title="Exit Breakdown" subtitle="청산 사유 분포">
                    {result.trades.length > 0 ? (
                      <>
                        <ExitReasonChart trades={result.trades as any} />
                        <div className="space-y-1 mt-2">
                          {[
                            { key: "target_hit", label: "목표가 도달", color: "text-neon-cyan" },
                            { key: "stop_loss", label: "손절", color: "text-red-400" },
                            { key: "window_expired", label: "만료", color: "text-neon-yellow" },
                          ].map(({ key, label, color }) => {
                            const count = result.trades.filter(
                              (t) => t.exitReason === key
                            ).length;
                            const pct = result.trades.length
                              ? ((count / result.trades.length) * 100).toFixed(1)
                              : "0";
                            return (
                              <div key={key} className="flex items-center justify-between">
                                <span className={cn("font-mono text-[10px]", color)}>{label}</span>
                                <span className="font-mono text-[10px] text-muted-foreground">
                                  {count} ({pct}%)
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    ) : (
                      <div className="h-[140px] flex items-center justify-center">
                        <p className="font-mono text-xs text-muted-foreground">시그널 없음</p>
                      </div>
                    )}
                  </HudPanel>
                </div>
              </div>

              {/* Win/Loss breakdown */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <BacktestStatCard
                  label="평균 승리 수익"
                  value={`+${overall.avgWin.toFixed(2)}%`}
                  color="green"
                />
                <BacktestStatCard
                  label="평균 패배 손실"
                  value={`${overall.avgLoss.toFixed(2)}%`}
                  color="red"
                />
                <BacktestStatCard
                  label="평균 MFE"
                  value={`+${overall.avgMaxFavorable.toFixed(2)}%`}
                  sub="평균 최대 순방향"
                  color="cyan"
                />
                <BacktestStatCard
                  label="평균 MAE"
                  value={`-${overall.avgMaxAdverse.toFixed(2)}%`}
                  sub="평균 최대 역방향"
                  color="yellow"
                />
              </div>

              {/* Symbol Breakdown */}
              {Object.keys(result.bySymbol).length > 0 && (
                <HudPanel
                  title="Symbol Breakdown"
                  subtitle={`${Object.keys(result.bySymbol).length}개 심볼 분석 · 승률 기준 정렬`}
                >
                  <SymbolTable bySymbol={result.bySymbol} />
                </HudPanel>
              )}

              {/* Trade List */}
              <HudPanel
                title="Individual Trades"
                subtitle={`${result.trades.length}건 · 필터: `}
              >
                {/* Filter */}
                <div className="flex gap-2 mb-3">
                  {(["all", "win", "loss"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setTradeWinFilter(f)}
                      className={cn(
                        "font-mono text-[10px] px-2 py-1 rounded-sm border transition-all",
                        tradeWinFilter === f
                          ? f === "win"
                            ? "border-neon-green text-neon-green bg-neon-green/10"
                            : f === "loss"
                            ? "border-red-400 text-red-400 bg-red-400/10"
                            : "border-neon-cyan text-neon-cyan bg-neon-cyan/10"
                          : "border-border/30 text-muted-foreground hover:border-neon-cyan/40"
                      )}
                    >
                      {f === "all" ? `ALL (${result.trades.length})` : f === "win" ? `WIN (${result.trades.filter(t => t.win).length})` : `LOSS (${result.trades.filter(t => !t.win).length})`}
                    </button>
                  ))}
                </div>

                <div className="overflow-x-auto max-h-96 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-background/90 backdrop-blur">
                      <tr className="border-b border-border/20">
                        {["Symbol", "Date", "W/L", "Exit", "Return", "RSI", "ADX", "Strength", "MFE", "MAE"].map(
                          (h) => (
                            <th
                              key={h}
                              className="px-2 py-2 text-left font-mono text-[10px] text-muted-foreground uppercase"
                            >
                              {h}
                            </th>
                          )
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTrades.slice(0, 300).map((t, i) => (
                        <TradeRow key={i} trade={t} />
                      ))}
                    </tbody>
                  </table>
                  {filteredTrades.length > 300 && (
                    <p className="font-mono text-[10px] text-muted-foreground text-center py-2">
                      상위 300건만 표시 · 전체 {filteredTrades.length}건
                    </p>
                  )}
                </div>
              </HudPanel>

              {/* Insight */}
              <HudPanel title="다음 단계 (MD 04 Phase 1)" subtitle="Trend Composite 캘리브레이션">
                <div className="p-3 rounded-sm border border-neon-yellow/20 bg-neon-yellow/5">
                  <p className="font-mono text-xs text-neon-yellow mb-2">
                    📊 베이스라인 승률: <strong>{(overall.winRate * 100).toFixed(1)}%</strong>
                    {" "}({overall.totalTrades}개 시그널)
                  </p>
                  <p className="font-mono text-[10px] text-muted-foreground leading-relaxed">
                    이 수치가 Calibration의 <code className="text-neon-cyan">baselineWinRate</code>가 됩니다.
                    Trend Composite (EMA200, ADX, MACD 등 7개 지표 합성) 추가 시 regime별 승률 비교 →
                    <code className="text-neon-pink"> strong_uptrend</code>에서 예상 승률:{" "}
                    {Math.min(99, Math.round(overall.winRate * 100 + 15))}%+
                  </p>
                </div>
              </HudPanel>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <FlaskConical className="h-12 w-12 text-muted-foreground/20 mb-4" />
              <p className="font-mono text-sm text-muted-foreground">아직 실행 결과가 없습니다</p>
              <p className="font-mono text-xs text-muted-foreground/60 mt-1">
                CONFIG 탭에서 설정 후 RUN BACKTEST 클릭
              </p>
            </div>
          )}
        </TabsContent>

        {/* ── Calibration Tab (v6.5 Phase 3) ── */}
        <TabsContent value="calibration" className="mt-3 space-y-3">
          {result?.trades?.length ? (
            <CalibrationPanel trades={result.trades as any} />
          ) : (
            <div className="text-center py-12">
              <FlaskConical className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="font-mono text-sm text-muted-foreground">
                백테스트 실행 후 calibration 분석 가능
              </p>
              <p className="font-mono text-xs text-muted-foreground/60 mt-1">
                Phase 1+2 결과 trade 가 ≥ 100 건이어야 통계적으로 유의미.
              </p>
            </div>
          )}
        </TabsContent>

        {/* ── History Tab ── */}
        <TabsContent value="history" className="mt-3">
          <HudPanel
            title="Past Runs"
            subtitle="saveToDb=true 로 실행된 백테스트 이력"
          >
            {runsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-neon-cyan" />
              </div>
            ) : !pastRuns?.length ? (
              <div className="text-center py-12">
                <Clock className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                <p className="font-mono text-sm text-muted-foreground">저장된 백테스트 없음</p>
                <p className="font-mono text-xs text-muted-foreground/60 mt-1">
                  DB 저장 옵션 켜고 실행하면 여기에 기록됩니다
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {pastRuns.map((run) => {
                  const symbols = (() => {
                    try {
                      const arr = JSON.parse(run.symbols);
                      return Array.isArray(arr) ? arr : [];
                    } catch { return []; }
                  })();

                  return (
                    <div
                      key={run.id}
                      className="flex items-center justify-between p-3 rounded-sm border border-border/20 bg-card/40 hover:border-neon-cyan/20 transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={cn(
                            "h-2 w-2 rounded-full shrink-0",
                            run.status === "complete"
                              ? "bg-neon-green"
                              : run.status === "running"
                              ? "bg-neon-yellow animate-pulse"
                              : "bg-red-400"
                          )}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-display text-sm font-bold text-foreground">
                              #{run.id} {run.runName ?? "unnamed"}
                            </span>
                            <Badge className="font-mono text-[10px] bg-neon-cyan/10 text-neon-cyan border-neon-cyan/30">
                              {run.tf}
                            </Badge>
                          </div>
                          <div className="font-mono text-[10px] text-muted-foreground mt-0.5 truncate">
                            {symbols.slice(0, 5).map((s: string) => s.replace("USDT", "")).join(", ")}
                            {symbols.length > 5 && ` +${symbols.length - 5}`}
                            {" · "}
                            {run.startDate
                              ? new Date(run.startDate).toLocaleDateString("ko-KR")
                              : "?"}{" "}
                            ~{" "}
                            {run.endDate
                              ? new Date(run.endDate).toLocaleDateString("ko-KR")
                              : "?"}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <div className="text-right hidden sm:block">
                          <div className="font-mono text-[10px] text-muted-foreground">Trades</div>
                          <div className="font-mono text-xs text-foreground">{run.totalTrades}</div>
                        </div>
                        <div className="text-right hidden sm:block">
                          <div className="font-mono text-[10px] text-muted-foreground">Win Rate</div>
                          <div className={cn("font-mono text-xs", (run.winRate ?? 0) >= 0.5 ? "text-neon-green" : "text-red-400")}>
                            {run.winRate != null ? `${(run.winRate * 100).toFixed(1)}%` : "—"}
                          </div>
                        </div>
                        <div className="text-right hidden md:block">
                          <div className="font-mono text-[10px] text-muted-foreground">Sharpe</div>
                          <div className="font-mono text-xs text-neon-cyan">
                            {run.sharpe != null ? run.sharpe.toFixed(3) : "—"}
                          </div>
                        </div>
                        <div className="text-right hidden md:block">
                          <div className="font-mono text-[10px] text-muted-foreground">MDD</div>
                          <div className="font-mono text-xs text-red-400">
                            {run.maxDrawdown != null ? `-${run.maxDrawdown.toFixed(2)}%` : "—"}
                          </div>
                        </div>
                        <div className="font-mono text-[10px] text-muted-foreground hidden lg:block">
                          {run.completedAt
                            ? new Date(run.completedAt).toLocaleString("ko-KR")
                            : new Date(run.createdAt).toLocaleString("ko-KR")}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </HudPanel>
        </TabsContent>

        {/* ── Engine A Tab (Dual Backtest §2) ── */}
        <TabsContent value="engine_a" className="mt-3">
          <EngineATab />
        </TabsContent>

        {/* ── Engine B Tab (Dual Backtest §3 — Phase 1 templates) ── */}
        <TabsContent value="engine_b" className="mt-3">
          <EngineBTab />
        </TabsContent>

        {/* ── COMPOSITE Tab — Phase B-2 (2026-05-11) ⭐
             사용자 요구 #2: Signal + Macro + Wave 3-Layer 조합 백테스트.
             기존 single-strategy 와 별도 트랙. */}
        <TabsContent value="composite" className="mt-3">
          <CompositeBacktest />
        </TabsContent>
      </Tabs>
    </div>
  );
}
