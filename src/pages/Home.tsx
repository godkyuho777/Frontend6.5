import { HudPanel, StatCard } from "@/components/HudPanel";
import { SignalDetailDialog } from "@/components/SignalDetailDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Search,
  ArrowUpDown,
  Clock,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
} from "lucide-react";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { TIMEFRAMES } from "@shared/types";
import type { CoinScanResult, PressureLabel, TimeframeValue } from "@shared/types";
import { useMarketScan } from "@/hooks/useMarketData";

type SortKey = "symbol" | "price" | "change24h" | "rsi" | "bbPos" | "adx" | "strength" | "signal";
type SortDir = "asc" | "desc";

const EMPTY_COINS: CoinScanResult[] = [];

type SortHeaderProps = {
  label: string;
  sortKeyVal: SortKey;
  className?: string;
  sortKey: SortKey;
  onSort: (key: SortKey) => void;
};

function SortHeader({ label, sortKeyVal, className, sortKey, onSort }: SortHeaderProps) {
  return (
    <th
      className={cn(
        "font-mono text-[10px] text-muted-foreground uppercase tracking-wider py-2 px-2 cursor-pointer hover:text-neon-cyan transition-colors select-none",
        className
      )}
      onClick={() => onSort(sortKeyVal)}
    >
      <div className="flex items-center gap-0.5 justify-end">
        {label}
        {sortKey === sortKeyVal && (
          <ArrowUpDown className="h-2.5 w-2.5 text-neon-cyan" />
        )}
      </div>
    </th>
  );
}

function renderPressureCell(pressure: PressureLabel, strong: boolean) {
  if (pressure === "NEUTRAL") {
    return (
      <span className="font-mono text-[10px] text-muted-foreground">↔ Neutral</span>
    );
  }
  const isBull = pressure === "BULL_PRESSURE" || pressure === "WEAK_BULL";
  const colorClass = isBull
    ? strong
      ? "text-neon-green"
      : "text-neon-green/60"
    : strong
    ? "text-neon-red"
    : "text-neon-red/60";
  const arrow = isBull ? "↑" : "↓";
  const label = isBull
    ? strong
      ? "BULL"
      : "Bull"
    : strong
    ? "BEAR"
    : "Bear";
  return (
    <span className={cn("font-mono text-[10px] inline-flex items-center gap-0.5", colorClass)}>
      <span>{arrow}</span>
      <span>{label}</span>
    </span>
  );
}

function renderPatternCell(coin: CoinScanResult) {
  // Audit-권고 합산이 있으면 score 위주로 표시. 없으면 raw count fallback.
  const conf = coin.patternConfluence;
  if (conf) {
    const bullScore = Math.round(conf.bullishScore * 100);
    const bearScore = Math.round(conf.bearishScore * 100);
    if (conf.bullishCount === 0 && conf.bearishCount === 0) {
      return <span className="font-mono text-[10px] text-muted-foreground">—</span>;
    }
    return (
      <span
        className="font-mono text-[10px] inline-flex items-center gap-1.5"
        title={`강세 ${bullScore} (${conf.bullishCount}개) / 약세 ${bearScore} (${conf.bearishCount}개)`}
      >
        {conf.bullishCount > 0 && (
          <span className="text-neon-green inline-flex items-center gap-0.5">
            <span className="font-bold">{bullScore}</span>
            {conf.bullishCount > 1 && (
              <span className="text-[8px] opacity-70">+{conf.bullishCount - 1}</span>
            )}
            ↑
          </span>
        )}
        {conf.bearishCount > 0 && (
          <span className="text-neon-red inline-flex items-center gap-0.5">
            <span className="font-bold">{bearScore}</span>
            {conf.bearishCount > 1 && (
              <span className="text-[8px] opacity-70">+{conf.bearishCount - 1}</span>
            )}
            ↓
          </span>
        )}
      </span>
    );
  }
  const patterns = coin.candlePatterns ?? [];
  const bullCount = patterns.filter((p) => p.bias === "bullish").length;
  const bearCount = patterns.filter((p) => p.bias === "bearish").length;
  if (bullCount === 0 && bearCount === 0) {
    return <span className="font-mono text-[10px] text-muted-foreground">—</span>;
  }
  return (
    <span className="font-mono text-[10px] inline-flex items-center gap-1">
      {bullCount > 0 && (
        <span className="text-neon-green">{bullCount}↑</span>
      )}
      {bearCount > 0 && (
        <span className="text-neon-red">{bearCount}↓</span>
      )}
    </span>
  );
}

function renderSignalBadges(coin: CoinScanResult) {
  const badges: { key: string; node: React.ReactNode }[] = [];

  if (coin.isStopLossHit ?? false) {
    badges.push({
      key: "stop",
      node: (
        <Badge className="bg-neon-red/20 text-neon-red border-neon-red/40 font-mono text-[10px]">
          <ShieldAlert className="h-2.5 w-2.5 mr-0.5" />
          STOP
        </Badge>
      ),
    });
  }

  if (coin.entryDecision) {
    const path = coin.entryDecision.path;
    const colorClass =
      path === "NUM"
        ? "bg-neon-cyan/20 text-neon-cyan border-neon-cyan/40"
        : path === "PTN"
        ? "bg-neon-pink/20 text-neon-pink border-neon-pink/40"
        : "bg-neon-green/20 text-neon-green border-neon-green/40";
    badges.push({
      key: "long",
      node: (
        <Badge className={cn("font-mono text-[10px]", colorClass)}>
          <TrendingUp className="h-2.5 w-2.5 mr-0.5" />
          LONG {path}
        </Badge>
      ),
    });
  }

  if (coin.exitDecision) {
    const label = coin.exitDecision.relaxedToBearish
      ? "EXIT 약세"
      : `EXIT ${coin.exitDecision.conditionsMet}/4`;
    badges.push({
      key: "exit",
      node: (
        <Badge
          className={cn(
            "font-mono text-[10px]",
            coin.exitDecision.relaxedToBearish
              ? "bg-orange-500/20 text-orange-400 border-orange-400/40"
              : "bg-neon-yellow/20 text-neon-yellow border-neon-yellow/40"
          )}
        >
          <TrendingDown className="h-2.5 w-2.5 mr-0.5" />
          {label}
        </Badge>
      ),
    });
  }

  if (badges.length === 0) {
    return <span className="font-mono text-[10px] text-muted-foreground">—</span>;
  }

  return (
    <SignalDetailDialog coin={coin}>
      <button
        type="button"
        className="inline-flex items-center gap-1 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
      >
        {badges.map((b) => (
          <span key={b.key}>{b.node}</span>
        ))}
      </button>
    </SignalDetailDialog>
  );
}

export default function Home() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedInterval, setSelectedInterval] = useState<TimeframeValue>("4h");
  const [sortKey, setSortKey] = useState<SortKey>("symbol");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Client-side market data hook (직접 바이비트 API 호출)
  const {
    data: scanData,
    isLoading,
    refetch,
    isFetching,
    error,
  } = useMarketScan(page, pageSize, selectedInterval);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "symbol" ? "asc" : "desc");
    }
  };

  const coins = scanData?.coins ?? EMPTY_COINS;
  const totalCoins = scanData?.total ?? 0;
  const totalPages = scanData?.totalPages ?? 1;

  const filteredAndSorted = useMemo(() => {
    let list = [...coins];

    if (searchQuery) {
      list = list.filter((r) =>
        r.symbol.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    list.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "symbol":
          cmp = a.symbol.localeCompare(b.symbol);
          break;
        case "price":
          cmp = a.price - b.price;
          break;
        case "change24h":
          cmp = a.change24h - b.change24h;
          break;
        case "rsi":
          cmp = a.indicators.rsi - b.indicators.rsi;
          break;
        case "bbPos": {
          const bbA =
            a.indicators.bbUpper !== a.indicators.bbLower
              ? (a.price - a.indicators.bbLower) / (a.indicators.bbUpper - a.indicators.bbLower)
              : 0.5;
          const bbB =
            b.indicators.bbUpper !== b.indicators.bbLower
              ? (b.price - b.indicators.bbLower) / (b.indicators.bbUpper - b.indicators.bbLower)
              : 0.5;
          cmp = bbA - bbB;
          break;
        }
        case "adx":
          cmp = a.indicators.adx - b.indicators.adx;
          break;
        case "strength":
          cmp = a.signalStrength - b.signalStrength;
          break;
        case "signal":
          cmp = (a.isEntrySignal ? 2 : a.isExitSignal ? 1 : 0) - (b.isEntrySignal ? 2 : b.isExitSignal ? 1 : 0);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return list;
  }, [coins, searchQuery, sortKey, sortDir]);

  const entryCount = coins.filter((r) => r.isEntrySignal).length;
  const exitCount = coins.filter((r) => r.isExitSignal).length;
  const avgRsi = coins.length
    ? (coins.reduce((sum, r) => sum + r.indicators.rsi, 0) / coins.length).toFixed(1)
    : "—";

  const tfLabel = TIMEFRAMES.find((t) => t.value === selectedInterval)?.label ?? selectedInterval;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-wider text-neon-pink glow-pink">
            SIGNAL SCANNER
          </h1>
          <p className="font-mono text-xs text-muted-foreground mt-1">
            {tfLabel} TIMEFRAME // RSI + BB + ADX ANALYSIS // BYBIT DATA
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Timeframe Selector */}
          <div className="flex items-center gap-1.5 bg-card/50 border border-border/30 rounded-sm px-2 py-1">
            <Clock className="h-3 w-3 text-neon-cyan" />
            <div className="flex gap-0.5">
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf.value}
                  onClick={() => {
                    setSelectedInterval(tf.value as TimeframeValue);
                    setPage(1);
                  }}
                  className={cn(
                    "font-mono text-[10px] px-2 py-1 rounded-sm transition-all",
                    selectedInterval === tf.value
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
            onClick={() => refetch()}
            disabled={isFetching}
            className="border-neon-cyan/30 text-neon-cyan hover:bg-neon-cyan/10 font-mono text-xs"
          >
            {isFetching ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
            ) : (
              <RefreshCw className="h-3 w-3 mr-1" />
            )}
            RESCAN
          </Button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Total Coins" value={totalCoins} unit="tracked" />
        <StatCard
          label="Page Entry"
          value={entryCount}
          variant={entryCount > 0 ? "positive" : "default"}
        />
        <StatCard
          label="Page Exit"
          value={exitCount}
          variant={exitCount > 0 ? "negative" : "default"}
        />
        <StatCard label="Page Avg RSI" value={avgRsi} />
        <StatCard label="Timeframe" value={tfLabel} unit="candles" />
      </div>

      {/* Coins Table */}
      <HudPanel
        title="Market Overview"
        subtitle={
          coins.length > 0
            ? `Page ${page} of ${totalPages} · ${coins.length} coins · Bybit Spot`
            : "Loading market data..."
        }
        headerRight={
          <div className="relative w-48">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <Input
              placeholder="Search symbol..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-7 pl-7 text-xs font-mono bg-background/50 border-border/30"
            />
          </div>
        }
      >
        {/* Error state */}
        {error && !scanData && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <AlertCircle className="h-8 w-8 text-neon-red" />
            <p className="font-mono text-sm text-neon-red">Failed to load market data</p>
            <p className="font-mono text-xs text-muted-foreground max-w-md text-center">
              Fetching data from Bybit API. Please wait a moment and try again.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="border-neon-cyan/30 text-neon-cyan hover:bg-neon-cyan/10 font-mono text-xs mt-2"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              RETRY
            </Button>
          </div>
        )}

        {/* Loading state */}
        {isLoading && !error && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-neon-pink" />
            <div className="text-center">
              <p className="font-mono text-sm text-foreground">
                Loading {pageSize} coins on {tfLabel}...
              </p>
              <p className="font-mono text-xs text-muted-foreground mt-1">
                Fetching data directly from Bybit API
              </p>
            </div>
          </div>
        )}

        {/* Data loaded */}
        {!isLoading && scanData && (
          <>
            {isFetching && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-neon-cyan/5 border-b border-neon-cyan/20">
                <Loader2 className="h-3 w-3 animate-spin text-neon-cyan" />
                <span className="font-mono text-[10px] text-neon-cyan">Updating data...</span>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/30">
                    <SortHeader label="Symbol" sortKeyVal="symbol" className="text-left" sortKey={sortKey} onSort={handleSort} />
                    <SortHeader label="Price" sortKeyVal="price" sortKey={sortKey} onSort={handleSort} />
                    <SortHeader label="24h" sortKeyVal="change24h" className="hidden sm:table-cell" sortKey={sortKey} onSort={handleSort} />
                    <SortHeader label="RSI" sortKeyVal="rsi" sortKey={sortKey} onSort={handleSort} />
                    <SortHeader label="BB Pos" sortKeyVal="bbPos" className="hidden md:table-cell" sortKey={sortKey} onSort={handleSort} />
                    <SortHeader label="ADX" sortKeyVal="adx" sortKey={sortKey} onSort={handleSort} />
                    <th className="text-right font-mono text-[10px] text-muted-foreground uppercase tracking-wider py-2 px-2 hidden lg:table-cell">
                      Pressure
                    </th>
                    <th className="text-right font-mono text-[10px] text-muted-foreground uppercase tracking-wider py-2 px-2 hidden lg:table-cell">
                      Rev %
                    </th>
                    <th className="text-right font-mono text-[10px] text-muted-foreground uppercase tracking-wider py-2 px-2 hidden xl:table-cell">
                      Pattern
                    </th>
                    <th className="text-right font-mono text-[10px] text-muted-foreground uppercase tracking-wider py-2 px-2 hidden xl:table-cell">
                      Fib Zone
                    </th>
                    <SortHeader label="Strength" sortKeyVal="strength" className="hidden sm:table-cell" sortKey={sortKey} onSort={handleSort} />
                    <SortHeader label="Signal" sortKeyVal="signal" className="text-center" sortKey={sortKey} onSort={handleSort} />
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSorted.map((coin) => {
                    const bbPos =
                      coin.indicators.bbUpper !== coin.indicators.bbLower
                        ? ((coin.price - coin.indicators.bbLower) /
                            (coin.indicators.bbUpper - coin.indicators.bbLower)) *
                          100
                        : 50;

                    const isHighlighted = coin.isEntrySignal;

                    return (
                      <tr
                        key={coin.symbol}
                        onClick={() => setLocation(`/coin/${coin.symbol}?tf=${selectedInterval}`)}
                        className={cn(
                          "border-b border-border/10 cursor-pointer transition-colors",
                          isHighlighted
                            ? "bg-neon-green/5 hover:bg-neon-green/10 border-l-2 border-l-neon-green"
                            : coin.isExitSignal
                            ? "bg-neon-yellow/5 hover:bg-neon-yellow/10 border-l-2 border-l-neon-yellow"
                            : "hover:bg-neon-cyan/5"
                        )}
                      >
                        <td className="py-2 px-2">
                          <div className="flex items-center gap-2">
                            {coin.isEntrySignal && (
                              <div className="w-1.5 h-1.5 rounded-full bg-neon-green signal-pulse" />
                            )}
                            {coin.isExitSignal && !coin.isEntrySignal && (
                              <div className="w-1.5 h-1.5 rounded-full bg-neon-yellow" />
                            )}
                            <span className={cn(
                              "font-display text-xs font-bold",
                              isHighlighted ? "text-neon-green" : "text-foreground"
                            )}>
                              {coin.symbol.replace("USDT", "")}
                            </span>
                          </div>
                        </td>
                        <td className="text-right py-2 px-2 font-mono text-xs text-foreground">
                          ${coin.price < 1 ? coin.price.toFixed(6) : coin.price < 100 ? coin.price.toFixed(4) : coin.price.toFixed(2)}
                        </td>
                        <td
                          className={cn(
                            "text-right py-2 px-2 font-mono text-xs hidden sm:table-cell",
                            coin.change24h >= 0 ? "text-neon-green" : "text-neon-red"
                          )}
                        >
                          {coin.change24h >= 0 ? "+" : ""}
                          {coin.change24h.toFixed(2)}%
                        </td>
                        <td className="text-right py-2 px-2">
                          <span
                            className={cn(
                              "font-mono text-xs",
                              coin.indicators.rsi <= 35
                                ? "text-neon-green font-bold"
                                : coin.indicators.rsi >= 70
                                ? "text-neon-red font-bold"
                                : coin.indicators.rsi === 0
                                ? "text-muted-foreground"
                                : "text-foreground"
                            )}
                          >
                            {coin.indicators.rsi === 0 ? "..." : coin.indicators.rsi.toFixed(1)}
                          </span>
                        </td>
                        <td className="text-right py-2 px-2 hidden md:table-cell">
                          {coin.indicators.bbUpper === 0 ? (
                            <span className="font-mono text-[10px] text-muted-foreground">...</span>
                          ) : (
                            <div className="flex items-center justify-end gap-1">
                              <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div
                                  className={cn(
                                    "h-full rounded-full",
                                    bbPos <= 20
                                      ? "bg-neon-green"
                                      : bbPos >= 80
                                      ? "bg-neon-red"
                                      : "bg-neon-cyan"
                                  )}
                                  style={{
                                    width: `${Math.min(100, Math.max(0, bbPos))}%`,
                                  }}
                                />
                              </div>
                              <span className="font-mono text-[10px] text-muted-foreground w-8 text-right">
                                {bbPos.toFixed(0)}%
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="text-right py-2 px-2">
                          <span
                            className={cn(
                              "font-mono text-xs",
                              coin.indicators.adx === 0
                                ? "text-muted-foreground"
                                : coin.indicators.adx <= 30
                                ? "text-neon-yellow"
                                : "text-foreground"
                            )}
                          >
                            {coin.indicators.adx === 0 ? "..." : coin.indicators.adx.toFixed(1)}
                          </span>
                        </td>
                        {/* Pressure */}
                        <td className="text-right py-2 px-2 hidden lg:table-cell">
                          {renderPressureCell(coin.pressure ?? "NEUTRAL", coin.pressureStrong ?? false)}
                        </td>
                        {/* Rev % */}
                        <td className="text-right py-2 px-2 hidden lg:table-cell">
                          {coin.indicators.adx === 0 ? (
                            <span className="font-mono text-[10px] text-muted-foreground">…</span>
                          ) : (
                            <span
                              className={cn(
                                "font-mono text-xs",
                                (coin.reversalProb ?? 0) >= 70
                                  ? "text-neon-green"
                                  : (coin.reversalProb ?? 0) >= 50
                                  ? "text-neon-yellow"
                                  : "text-muted-foreground"
                              )}
                            >
                              {(coin.reversalProb ?? 0).toFixed(0)}%
                            </span>
                          )}
                        </td>
                        {/* Pattern count */}
                        <td className="text-right py-2 px-2 hidden xl:table-cell">
                          {renderPatternCell(coin)}
                        </td>
                        {/* Fib Zone */}
                        <td className="text-right py-2 px-2 font-mono text-[10px] text-muted-foreground hidden xl:table-cell">
                          {coin.fibSignal ? (
                            <Badge variant="outline" className={cn(
                              "font-mono text-[10px] border-none",
                              coin.fibSignal.type === "buy" ? "text-neon-green bg-neon-green/10" : "text-neon-pink bg-neon-pink/10"
                            )}>
                              FIB {coin.fibSignal.level}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-[10px] font-mono">—</span>
                          )}
                        </td>
                        <td className="text-right py-2 px-2 hidden sm:table-cell">
                          {coin.signalStrength > 0 ? (
                            <div className="flex items-center justify-end gap-1">
                              <div className="w-10 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div
                                  className={cn(
                                    "h-full rounded-full transition-all",
                                    coin.signalStrength >= 70
                                      ? "bg-neon-green"
                                      : coin.signalStrength >= 40
                                      ? "bg-neon-yellow"
                                      : "bg-neon-cyan"
                                  )}
                                  style={{ width: `${coin.signalStrength}%` }}
                                />
                              </div>
                              <span
                                className={cn(
                                  "font-mono text-[10px] w-7 text-right",
                                  coin.signalStrength >= 70
                                    ? "text-neon-green"
                                    : coin.signalStrength >= 40
                                    ? "text-neon-yellow"
                                    : "text-muted-foreground"
                                )}
                              >
                                {coin.signalStrength}%
                              </span>
                            </div>
                          ) : (
                            <span className="font-mono text-[10px] text-muted-foreground">—</span>
                          )}
                        </td>
                        {/* Signal — rich BBDX badges, click to open detail */}
                        <td
                          className="text-center py-2 px-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {renderSignalBadges(coin)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Empty search state */}
            {filteredAndSorted.length === 0 && searchQuery && (
              <div className="flex flex-col items-center justify-center py-8">
                <p className="font-mono text-sm text-muted-foreground">
                  No coins matching "{searchQuery}"
                </p>
              </div>
            )}

            {/* Pagination */}
            <div className="flex items-center justify-between px-3 py-3 border-t border-border/20">
              <span className="font-mono text-[10px] text-muted-foreground">
                Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, totalCoins)} of {totalCoins} coins
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || isFetching}
                  className="h-7 px-2 border-border/30 font-mono text-[10px]"
                >
                  <ChevronLeft className="h-3 w-3 mr-0.5" />
                  PREV
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={cn(
                        "font-mono text-[10px] w-6 h-6 rounded-sm transition-all",
                        page === p
                          ? "bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || isFetching}
                  className="h-7 px-2 border-border/30 font-mono text-[10px]"
                >
                  NEXT
                  <ChevronRight className="h-3 w-3 ml-0.5" />
                </Button>
              </div>
            </div>
          </>
        )}
      </HudPanel>
    </div>
  );
}
