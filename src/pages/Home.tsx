import { HudPanel, StatCard } from "@/components/HudPanel";
import { SearchField } from "@/components/SearchField";
import { SignalDetailDialog } from "@/components/SignalDetailDialog";
import { TimeRangeSegmented } from "@/components/TimeRangeSegmented";
import { RefreshIconButton } from "@/components/RefreshIconButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  ArrowUpDown,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  ArrowDownRight,
  ArrowUpRight,
  Minus,
} from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { TIMEFRAMES } from "@shared/types";
import type {
  Candle,
  CoinScanResult,
  PressureLabel,
  TimeframeValue,
} from "@shared/types";
import { fetchKlines } from "@/lib/bybit-client";
import { useFullMarketScan, useMarketScan } from "@/hooks/useMarketData";
import { useBbdxV66Flags } from "@/hooks/useBbdxV66Flags";
import { DualSignalBadge } from "@/components/strategies/DualSignalBadge";

type SortKey =
  | "symbol"
  | "price"
  | "change24h"
  | "rsi"
  | "bbPos"
  | "adx"
  | "strength"
  | "signal";
type SortDir = "asc" | "desc";
type SignalFilter = "entry" | "exit" | "neutral";

const EMPTY_COINS: CoinScanResult[] = [];

type HeroChartPoint = {
  time: string;
  price: number;
  volume: number;
};

type SortHeaderProps = {
  label: string;
  sortKeyVal: SortKey;
  className?: string;
  sortKey: SortKey;
  onSort: (key: SortKey) => void;
};

function SortHeader({
  label,
  sortKeyVal,
  className,
  sortKey,
  onSort,
}: SortHeaderProps) {
  return (
    <th
      className={cn(
        "group cursor-pointer select-none whitespace-nowrap px-4 py-3 text-left font-sans text-[11px] tracking-wider text-muted-foreground transition-colors hover:text-primary",
        className
      )}
      onClick={() => onSort(sortKeyVal)}
    >
      <div className="flex items-center justify-start gap-1.5">
        {label}
        {sortKey === sortKeyVal && (
          <ArrowUpDown className="size-4 text-muted-foreground transition-colors group-hover:text-primary" />
        )}
      </div>
    </th>
  );
}

function renderPressureCell(pressure: PressureLabel, strong: boolean) {
  if (pressure === "NEUTRAL") {
    return (
      <span className="inline-flex items-center gap-1 font-sans text-xs text-muted-foreground">
        <Minus className="size-2.5" />
        Neutral
      </span>
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
  const Icon = isBull ? ArrowUpRight : ArrowDownRight;
  const label = isBull ? (strong ? "Bull" : "Bull") : strong ? "Bear" : "Bear";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-sans text-xs",
        colorClass
      )}
    >
      <Icon className="size-2.5" />
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
      return (
        <span className="font-sans text-[10px] text-muted-foreground">—</span>
      );
    }
    return (
      <span
        className="inline-flex items-center gap-1.5 font-sans text-xs"
        title={`강세 ${bullScore} (${conf.bullishCount}개) / 약세 ${bearScore} (${conf.bearishCount}개)`}
      >
        {conf.bullishCount > 0 && (
          <span className="text-neon-green inline-flex items-center gap-0.5">
            <span className="font-bold">{bullScore}</span>
            {conf.bullishCount > 1 && (
              <span className="text-[8px] opacity-70">
                +{conf.bullishCount - 1}
              </span>
            )}
            <ArrowUpRight className="size-2.5" />
          </span>
        )}
        {conf.bearishCount > 0 && (
          <span className="text-neon-red inline-flex items-center gap-0.5">
            <span className="font-bold">{bearScore}</span>
            {conf.bearishCount > 1 && (
              <span className="text-[8px] opacity-70">
                +{conf.bearishCount - 1}
              </span>
            )}
            <ArrowDownRight className="size-2.5" />
          </span>
        )}
      </span>
    );
  }
  const patterns = coin.candlePatterns ?? [];
  const bullCount = patterns.filter(p => p.bias === "bullish").length;
  const bearCount = patterns.filter(p => p.bias === "bearish").length;
  if (bullCount === 0 && bearCount === 0) {
    return (
      <span className="font-sans text-[10px] text-muted-foreground">—</span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 font-sans text-xs">
      {bullCount > 0 && (
        <span className="inline-flex items-center gap-0.5 text-neon-green">
          {bullCount}
          <ArrowUpRight className="size-2.5" />
        </span>
      )}
      {bearCount > 0 && (
        <span className="inline-flex items-center gap-0.5 text-neon-red">
          {bearCount}
          <ArrowDownRight className="size-2.5" />
        </span>
      )}
    </span>
  );
}

function renderSignalBadges(
  coin: CoinScanResult,
  v66Enabled: boolean,
  tf: string
) {
  const badges: { key: string; node: React.ReactNode }[] = [];

  if (coin.isStopLossHit ?? false) {
    badges.push({
      key: "stop",
      node: (
        <Badge className="bg-neon-red/20 text-neon-red border-neon-red/40 font-sans text-[10px]">
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
        <Badge className={cn("font-sans text-[10px]", colorClass)}>
          <TrendingUp className="h-2.5 w-2.5 mr-0.5" />
          LONG {path}
        </Badge>
      ),
    });
  }

  if (coin.shortDecision) {
    const signalStrength = coin.shortSignalStrength ?? 0;
    const path = coin.shortDecision.path;
    const isStrong = signalStrength >= 70;
    const colorClass = isStrong
      ? "bg-neon-red/20 text-neon-red border-neon-red/40"
      : path === "NUM"
        ? "bg-neon-orange/20 text-neon-orange border-neon-orange/40"
        : path === "PTN"
          ? "bg-orange-500/20 text-orange-400 border-orange-500/40"
          : "bg-neon-red/20 text-neon-red border-neon-red/40";

    badges.push({
      key: "short",
      node: (
        <span className="inline-flex items-center gap-1">
          <Badge className={cn("font-sans text-[10px]", colorClass)}>
            <TrendingDown className="h-2.5 w-2.5 mr-0.5" />
            SHORT {path}
          </Badge>
          <span
            title="SHORT algorithm alpha is still being validated"
            className="rounded-sm border border-neon-yellow/40 bg-neon-yellow/10 px-1 py-0.5 font-sans text-[9px] uppercase tracking-wider text-neon-yellow"
          >
            검증중
          </span>
        </span>
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
            "font-sans text-[10px]",
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

  const v66Badge = v66Enabled ? (
    <DualSignalBadge
      key="v66"
      symbol={coin.symbol}
      tf={tf}
      enabled={v66Enabled}
    />
  ) : null;

  if (badges.length === 0 && !v66Enabled) {
    return (
      <span className="font-sans text-[10px] text-muted-foreground">—</span>
    );
  }

  return (
    <SignalDetailDialog coin={coin}>
      <button
        type="button"
        className="inline-flex cursor-pointer flex-wrap items-center justify-end gap-1 rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {badges.map(b => (
          <span key={b.key}>{b.node}</span>
        ))}
        {v66Badge}
      </button>
    </SignalDetailDialog>
  );
}

function matchesSignalFilter(
  coin: CoinScanResult,
  filter: SignalFilter | null
) {
  if (filter === "entry") return coin.isEntrySignal;
  if (filter === "exit") return coin.isExitSignal;
  if (filter === "neutral") return !coin.isEntrySignal && !coin.isExitSignal;
  return true;
}

function signalFilterLabel(filter: SignalFilter) {
  if (filter === "entry") return "Entry candidates";
  if (filter === "exit") return "Exit candidates";
  return "Neutral watch";
}

export default function Home() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedInterval, setSelectedInterval] =
    useState<TimeframeValue>("4h");
  const { isV66 } = useBbdxV66Flags();
  const [sortKey, setSortKey] = useState<SortKey>("symbol");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(1);
  const [signalFilter, setSignalFilter] = useState<SignalFilter | null>(null);
  const pageSize = 10;

  // Client-side market data hook (직접 바이비트 API 호출)
  const {
    data: scanData,
    isLoading,
    refetch,
    isFetching,
    error,
  } = useMarketScan(page, pageSize, selectedInterval);
  const {
    data: fullScanData,
    isLoading: isFullScanLoading,
    refetch: refetchFullScan,
    isFetching: isFullScanFetching,
  } = useFullMarketScan(selectedInterval);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "symbol" ? "asc" : "desc");
    }
  };

  const coins = scanData?.coins ?? EMPTY_COINS;
  const totalCoins = scanData?.total ?? 0;
  const totalPages = scanData?.totalPages ?? 1;
  const pulseCoins = fullScanData?.coins ?? EMPTY_COINS;
  // 검색이 활성일 때는 전체 코인 풀(fullScan)에서 찾아야 페이지 밖 코인도 매치됨.
  // signalFilter 가 활성일 때도 fullScan 사용 (기존 동작 유지).
  // fullScan 데이터가 아직 안 왔으면 페이지된 데이터로 fallback.
  const trimmedQuery = searchQuery.trim();
  const isSearching = trimmedQuery.length > 0;
  const watchlistCoins = signalFilter
    ? pulseCoins.filter(coin => matchesSignalFilter(coin, signalFilter))
    : isSearching
      ? pulseCoins.length > 0
        ? pulseCoins
        : coins
      : coins;

  const filteredAndSorted = useMemo(() => {
    let list = [...watchlistCoins];

    if (isSearching) {
      const q = trimmedQuery.toUpperCase();
      list = list.filter(r => r.symbol.toUpperCase().includes(q));
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
              ? (a.price - a.indicators.bbLower) /
                (a.indicators.bbUpper - a.indicators.bbLower)
              : 0.5;
          const bbB =
            b.indicators.bbUpper !== b.indicators.bbLower
              ? (b.price - b.indicators.bbLower) /
                (b.indicators.bbUpper - b.indicators.bbLower)
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
          cmp =
            (a.isEntrySignal ? 2 : a.isExitSignal ? 1 : 0) -
            (b.isEntrySignal ? 2 : b.isExitSignal ? 1 : 0);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return list;
  }, [watchlistCoins, isSearching, trimmedQuery, sortKey, sortDir]);

  const entryCount = pulseCoins.filter(r => r.isEntrySignal).length;
  const exitCount = pulseCoins.filter(r => r.isExitSignal).length;
  const neutralCount = pulseCoins.filter(
    r => !r.isEntrySignal && !r.isExitSignal
  ).length;
  const avgRsi = pulseCoins.length
    ? (
        pulseCoins.reduce((sum, r) => sum + r.indicators.rsi, 0) /
        pulseCoins.length
      ).toFixed(1)
    : "—";
  const pulseCountValue = (value: number) =>
    fullScanData ? String(value) : "...";
  const handleRefetch = () => {
    refetch();
    refetchFullScan();
  };
  const handleStrategyView = (filter: SignalFilter) => {
    setSignalFilter(filter);
    setSearchQuery("");
    if (filter === "neutral") {
      setSortKey("symbol");
      setSortDir("asc");
    } else {
      setSortKey("strength");
      setSortDir("desc");
    }
  };

  // 검색이 활성일 때는 결과 전체를 클라이언트 사이드로 페이지네이션.
  // 검색 안 할 때는 백엔드 페이지네이션 그대로 (filteredAndSorted = 단일 페이지).
  const displayList = isSearching
    ? filteredAndSorted.slice((page - 1) * pageSize, page * pageSize)
    : filteredAndSorted;
  const displayTotalPages = isSearching
    ? Math.max(1, Math.ceil(filteredAndSorted.length / pageSize))
    : totalPages;

  const tfLabel =
    TIMEFRAMES.find(t => t.value === selectedInterval)?.label ??
    selectedInterval;
  const featuredCoin = displayList[0] ?? coins[0];
  const featuredChange = featuredCoin?.change24h ?? 0;
  const featuredPrice = featuredCoin?.price ?? 0;
  const featuredSymbol = featuredCoin?.symbol ?? "BTCUSDT";
  const { data: heroChartData, isLoading: isHeroChartLoading } =
    useHeroChartData(featuredSymbol, selectedInterval);
  const timeframeOptions = TIMEFRAMES.map(tf => ({
    label: tf.label,
    value: tf.value as TimeframeValue,
  }));
  const handleTimeframeChange = (value: TimeframeValue) => {
    setSelectedInterval(value);
    setPage(1);
    setSignalFilter(null);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_320px] xl:items-stretch">
        <div className="flex min-w-0 flex-col gap-5">
          <div className="flex w-full items-center gap-2 md:hidden">
            <TimeRangeSegmented
              options={timeframeOptions}
              value={selectedInterval}
              onChange={handleTimeframeChange}
              className="flex flex-1"
              itemClassName="flex-1 px-2"
            />
            <RefreshIconButton
              onClick={handleRefetch}
              disabled={isFetching || isFullScanFetching}
              label="Rescan market"
              isLoading={isFetching || isFullScanFetching}
              className="h-9 w-9 shrink-0"
            />
          </div>
          <section className="flex flex-col rounded-lg bg-foreground p-5 text-background shadow-sm md:p-6 xl:h-full">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="mb-2 flex items-center gap-3">
                  <AssetIcon symbol={featuredSymbol} inverse />
                  <div>
                    <div className="text-sm font-bold leading-none">
                      {featuredSymbol}
                    </div>
                    <div className="mt-1 font-sans text-[11px] text-background/60">
                      Top Scanner Result · {tfLabel}
                    </div>
                  </div>
                </div>
                <div className="tl-market-number text-5xl leading-none md:text-6xl">
                  $
                  {featuredPrice
                    ? featuredPrice.toLocaleString(undefined, {
                        maximumFractionDigits: featuredPrice < 1 ? 6 : 2,
                      })
                    : "0.00"}
                </div>
                <div
                  className={cn(
                    "mt-2 inline-flex items-center gap-1.5 font-sans text-sm font-bold",
                    featuredChange >= 0 ? "text-neon-green" : "text-neon-red"
                  )}
                >
                  {featuredChange >= 0 ? (
                    <ArrowUpRight className="size-4" />
                  ) : (
                    <ArrowDownRight className="size-4" />
                  )}
                  {featuredChange >= 0 ? "+" : ""}
                  {featuredChange.toFixed(2)}%
                  <span className="ml-1 text-background/45">Past 24h</span>
                </div>
              </div>
              <div className="hidden items-center gap-2 md:flex">
                <TimeRangeSegmented
                  options={timeframeOptions}
                  value={selectedInterval}
                  onChange={handleTimeframeChange}
                  inverse
                />
                <RefreshIconButton
                  onClick={handleRefetch}
                  disabled={isFetching || isFullScanFetching}
                  label="Rescan market"
                  isLoading={isFetching || isFullScanFetching}
                  inverse
                />
              </div>
            </div>
            <HeroPriceChart
              data={heroChartData}
              isLoading={isHeroChartLoading}
              positive={featuredChange >= 0}
            />
            <div className="mt-4 grid grid-cols-2 gap-4 border-t border-background/10 pt-4 md:grid-cols-4">
              <HeroMetric label="Entries" value={pulseCountValue(entryCount)} />
              <HeroMetric label="Exits" value={pulseCountValue(exitCount)} />
              <HeroMetric label="Avg RSI" value={String(avgRsi)} />
              <HeroMetric label="Tracked" value={String(totalCoins)} />
            </div>
          </section>
        </div>

        <aside className="flex flex-col">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-1">
            <StatCard label="Total coins" value={totalCoins} unit="tracked" />
            <StatCard
              label="All entry"
              value={pulseCountValue(entryCount)}
              variant={entryCount > 0 ? "positive" : "default"}
            />
            <StatCard
              label="All exit"
              value={pulseCountValue(exitCount)}
              variant={exitCount > 0 ? "negative" : "default"}
            />
            <StatCard label="All avg RSI" value={avgRsi} />
          </div>
        </aside>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <HudPanel
            title="Watchlist"
            subtitle={
              signalFilter
                ? `${signalFilterLabel(signalFilter)} · ${watchlistCoins.length} of ${fullScanData?.total ?? totalCoins} coins · ${tfLabel}`
                : isSearching
                  ? `Searching "${trimmedQuery}" · ${filteredAndSorted.length} match${filteredAndSorted.length === 1 ? "" : "es"} · ${tfLabel}`
                  : coins.length > 0
                    ? `Page ${page} of ${displayTotalPages} · ${coins.length} coins · Bybit spot`
                    : "Loading market data..."
            }
            headerRight={
              <div className="flex items-center gap-2">
                {signalFilter && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSignalFilter(null)}
                    className="h-8 px-2 font-sans text-xs"
                  >
                    All
                  </Button>
                )}
                <SearchField
                  wrapperClassName="w-52"
                  placeholder="Search symbol..."
                  value={searchQuery}
                  onChange={e => {
                    setSearchQuery(e.target.value);
                    // 검색 시 page=1 로 reset — 검색 결과가 다른 페이지에 있어도
                    // 첫 페이지부터 보이도록.
                    setPage(1);
                  }}
                />
              </div>
            }
          >
            {/* Error state */}
            {error && !scanData && (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <AlertCircle className="size-8 text-neon-red" />
                <p className="font-sans text-sm text-neon-red">
                  Failed to load market data
                </p>
                <p className="font-sans text-xs text-muted-foreground max-w-md text-center">
                  Fetching data from Bybit API. Please wait a moment and try
                  again.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefetch}
                  className="mt-2 font-sans text-xs"
                >
                  <RefreshCw className="mr-1 size-3" />
                  Retry
                </Button>
              </div>
            )}

            {/* Loading state */}
            {isLoading && !error && (
              <div className="flex flex-col items-center justify-center py-12 gap-4">
                <Loader2 className="size-8 animate-spin text-primary" />
                <div className="text-center">
                  <p className="font-sans text-sm text-foreground">
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
                  <div className="flex items-center gap-2 border-b border-border bg-muted px-3 py-1.5">
                    <Loader2 className="size-3 animate-spin text-primary" />
                    <span className="font-sans text-[10px] text-primary">
                      Updating data...
                    </span>
                  </div>
                )}
                <div className="relative">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1440px] table-fixed border-separate border-spacing-0">
                      <colgroup>
                        <col className="w-[205px]" />
                        <col className="w-[135px]" />
                        <col className="w-[105px]" />
                        <col className="w-[110px]" />
                        <col className="w-[150px]" />
                        <col className="w-[110px]" />
                        <col className="w-[150px]" />
                        <col className="w-[120px]" />
                        <col className="w-[150px]" />
                        <col className="w-[140px]" />
                        <col className="w-[150px]" />
                        <col className="w-[140px]" />
                      </colgroup>
                      <thead>
                        <tr className="border-b border-border/30">
                          <SortHeader
                            label="Pair"
                            sortKeyVal="symbol"
                            className="sticky left-0 z-30 bg-card"
                            sortKey={sortKey}
                            onSort={handleSort}
                          />
                          <SortHeader
                            label="Price"
                            sortKeyVal="price"
                            className="sticky left-[205px] z-30 bg-card"
                            sortKey={sortKey}
                            onSort={handleSort}
                          />
                          <SortHeader
                            label="24h"
                            sortKeyVal="change24h"
                            className="sticky left-[340px] z-30 hidden bg-card sm:table-cell"
                            sortKey={sortKey}
                            onSort={handleSort}
                          />
                          <SortHeader
                            label="RSI"
                            sortKeyVal="rsi"
                            className="min-w-[96px]"
                            sortKey={sortKey}
                            onSort={handleSort}
                          />
                          <SortHeader
                            label="BB Pos"
                            sortKeyVal="bbPos"
                            className="hidden min-w-[132px] md:table-cell"
                            sortKey={sortKey}
                            onSort={handleSort}
                          />
                          <SortHeader
                            label="ADX"
                            sortKeyVal="adx"
                            className="min-w-[96px]"
                            sortKey={sortKey}
                            onSort={handleSort}
                          />
                          <th className="hidden min-w-[120px] px-4 py-3 text-left font-sans text-[11px] tracking-wider text-muted-foreground lg:table-cell">
                            Pressure
                          </th>
                          <th className="hidden min-w-[104px] px-4 py-3 text-left font-sans text-[11px] tracking-wider text-muted-foreground lg:table-cell">
                            Rev %
                          </th>
                          <th className="hidden min-w-[130px] px-4 py-3 text-left font-sans text-[11px] tracking-wider text-muted-foreground xl:table-cell">
                            Pattern
                          </th>
                          <th className="hidden min-w-[120px] px-4 py-3 text-left font-sans text-[11px] tracking-wider text-muted-foreground xl:table-cell">
                            Fib Zone
                          </th>
                          <SortHeader
                            label="Strength"
                            sortKeyVal="strength"
                            className="hidden min-w-[128px] sm:table-cell"
                            sortKey={sortKey}
                            onSort={handleSort}
                          />
                          <SortHeader
                            label="Signal"
                            sortKeyVal="signal"
                            className="min-w-[132px]"
                            sortKey={sortKey}
                            onSort={handleSort}
                          />
                        </tr>
                      </thead>
                      <tbody>
                        {displayList.map(coin => {
                          const bbPos =
                            coin.indicators.bbUpper !== coin.indicators.bbLower
                              ? ((coin.price - coin.indicators.bbLower) /
                                  (coin.indicators.bbUpper -
                                    coin.indicators.bbLower)) *
                                100
                              : 50;

                          const isHighlighted = coin.isEntrySignal;
                          const rowBgClass = isHighlighted
                            ? "bg-[#f1faf1] group-hover:bg-[#e7f4e7]"
                            : coin.isExitSignal
                              ? "bg-[#fff9e8] group-hover:bg-[#fff2c7]"
                              : "bg-card group-hover:bg-muted";

                          return (
                            <tr
                              key={coin.symbol}
                              onClick={() =>
                                setLocation(
                                  `/coin/${coin.symbol}?tf=${selectedInterval}`
                                )
                              }
                              className={cn(
                                "group cursor-pointer border-b border-border/40 transition-colors",
                                isHighlighted
                                  ? "bg-neon-green/5 hover:bg-neon-green/10"
                                  : coin.isExitSignal
                                    ? "bg-neon-yellow/5 hover:bg-neon-yellow/10"
                                    : "hover:bg-muted"
                              )}
                            >
                              <td
                                className={cn(
                                  "sticky left-0 z-20 px-2.5 py-4 transition-colors",
                                  rowBgClass
                                )}
                              >
                                <div className="flex items-center gap-3">
                                  <AssetIcon symbol={coin.symbol} />
                                  <div>
                                    <span className="block text-sm font-bold leading-none text-foreground">
                                      {coin.symbol.replace("USDT", "/USDT")}
                                    </span>
                                  </div>
                                </div>
                              </td>
                              <td
                                className={cn(
                                  "sticky left-[205px] z-20 whitespace-nowrap px-2.5 py-4 text-left font-sans text-sm text-foreground transition-colors",
                                  rowBgClass
                                )}
                              >
                                $
                                {coin.price < 1
                                  ? coin.price.toFixed(6)
                                  : coin.price < 100
                                    ? coin.price.toFixed(4)
                                    : coin.price.toFixed(2)}
                              </td>
                              <td
                                className={cn(
                                  "sticky left-[340px] z-20 hidden whitespace-nowrap px-2.5 py-4 text-left font-sans text-sm transition-colors sm:table-cell",
                                  rowBgClass,
                                  coin.change24h >= 0
                                    ? "text-neon-green"
                                    : "text-neon-red"
                                )}
                              >
                                {coin.change24h >= 0 ? "+" : ""}
                                {coin.change24h.toFixed(2)}%
                              </td>
                              <td
                                className={cn(
                                  "whitespace-nowrap px-4 py-4 text-left transition-colors",
                                  rowBgClass
                                )}
                              >
                                <span
                                  className={cn(
                                    "font-sans text-sm",
                                    coin.indicators.rsi <= 35
                                      ? "text-neon-green font-bold"
                                      : coin.indicators.rsi >= 70
                                        ? "text-neon-red font-bold"
                                        : coin.indicators.rsi === 0
                                          ? "text-muted-foreground"
                                          : "text-foreground"
                                  )}
                                >
                                  {coin.indicators.rsi === 0
                                    ? "..."
                                    : coin.indicators.rsi.toFixed(1)}
                                </span>
                              </td>
                              <td
                                className={cn(
                                  "hidden whitespace-nowrap px-4 py-4 text-left transition-colors md:table-cell",
                                  rowBgClass
                                )}
                              >
                                {coin.indicators.bbUpper === 0 ? (
                                  <span className="font-sans text-xs text-muted-foreground">
                                    ...
                                  </span>
                                ) : (
                                  <div className="flex items-center justify-start gap-2">
                                    <div className="h-1.5 w-12 overflow-hidden rounded-full bg-muted">
                                      <div
                                        className={cn(
                                          "h-full rounded-full",
                                          bbPos <= 20
                                            ? "bg-neon-green"
                                            : bbPos >= 80
                                              ? "bg-neon-red"
                                              : "bg-primary"
                                        )}
                                        style={{
                                          width: `${Math.min(100, Math.max(0, bbPos))}%`,
                                        }}
                                      />
                                    </div>
                                    <span className="w-8 text-left font-sans text-xs text-muted-foreground">
                                      {bbPos.toFixed(0)}%
                                    </span>
                                  </div>
                                )}
                              </td>
                              <td
                                className={cn(
                                  "whitespace-nowrap px-4 py-4 text-left transition-colors",
                                  rowBgClass
                                )}
                              >
                                <span
                                  className={cn(
                                    "font-sans text-sm",
                                    coin.indicators.adx === 0
                                      ? "text-muted-foreground"
                                      : coin.indicators.adx <= 30
                                        ? "text-neon-yellow"
                                        : "text-foreground"
                                  )}
                                >
                                  {coin.indicators.adx === 0
                                    ? "..."
                                    : coin.indicators.adx.toFixed(1)}
                                </span>
                              </td>
                              <td
                                className={cn(
                                  "hidden whitespace-nowrap px-4 py-4 text-left transition-colors lg:table-cell",
                                  rowBgClass
                                )}
                              >
                                {renderPressureCell(
                                  coin.pressure ?? "NEUTRAL",
                                  coin.pressureStrong ?? false
                                )}
                              </td>
                              <td
                                className={cn(
                                  "hidden whitespace-nowrap px-4 py-4 text-left transition-colors lg:table-cell",
                                  rowBgClass
                                )}
                              >
                                {coin.indicators.adx === 0 ? (
                                  <span className="font-sans text-xs text-muted-foreground">
                                    ...
                                  </span>
                                ) : (
                                  <span
                                    className={cn(
                                      "font-sans text-sm",
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
                              <td
                                className={cn(
                                  "hidden whitespace-nowrap px-4 py-4 text-left transition-colors xl:table-cell",
                                  rowBgClass
                                )}
                              >
                                {renderPatternCell(coin)}
                              </td>
                              <td
                                className={cn(
                                  "hidden whitespace-nowrap px-4 py-4 text-left font-sans text-xs text-muted-foreground transition-colors xl:table-cell",
                                  rowBgClass
                                )}
                              >
                                {coin.fibSignal ? (
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "border-none font-sans text-xs",
                                      coin.fibSignal.type === "buy"
                                        ? "text-neon-green bg-neon-green/10"
                                        : "text-primary bg-primary/10"
                                    )}
                                  >
                                    FIB {coin.fibSignal.level}
                                  </Badge>
                                ) : (
                                  <span className="font-sans text-xs text-muted-foreground">
                                    —
                                  </span>
                                )}
                              </td>
                              <td
                                className={cn(
                                  "hidden whitespace-nowrap px-4 py-4 text-left transition-colors sm:table-cell",
                                  rowBgClass
                                )}
                              >
                                {coin.signalStrength > 0 ? (
                                  <div className="flex items-center justify-start gap-2">
                                    <div className="h-1.5 w-10 overflow-hidden rounded-full bg-muted">
                                      <div
                                        className={cn(
                                          "h-full rounded-full transition-all",
                                          coin.signalStrength >= 70
                                            ? "bg-neon-green"
                                            : coin.signalStrength >= 40
                                              ? "bg-neon-yellow"
                                              : "bg-primary"
                                        )}
                                        style={{
                                          width: `${coin.signalStrength}%`,
                                        }}
                                      />
                                    </div>
                                    <span
                                      className={cn(
                                        "w-8 text-left font-sans text-xs",
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
                                  <span className="font-sans text-xs text-muted-foreground">
                                    —
                                  </span>
                                )}
                              </td>
                              <td
                                className={cn(
                                  "whitespace-nowrap px-4 py-4 text-left transition-colors",
                                  rowBgClass
                                )}
                                onClick={e => e.stopPropagation()}
                              >
                                {renderSignalBadges(
                                  coin,
                                  isV66,
                                  selectedInterval
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {filteredAndSorted.length === 0 && isSearching && (
                  <div className="flex flex-col items-center justify-center py-8">
                    <p className="font-sans text-sm text-muted-foreground">
                      No coins matching "{trimmedQuery}"
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-between border-t border-border px-3 py-3">
                  <span className="font-sans text-[10px] text-muted-foreground">
                    {signalFilter
                      ? `Showing ${filteredAndSorted.length} ${signalFilterLabel(signalFilter).toLowerCase()}`
                      : isSearching
                        ? filteredAndSorted.length > 0
                          ? `Showing ${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, filteredAndSorted.length)} of ${filteredAndSorted.length} matches`
                          : `0 matches for "${trimmedQuery}"`
                        : `Showing ${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, totalCoins)} of ${totalCoins} coins`}
                  </span>
                  {!signalFilter && displayTotalPages > 1 && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page <= 1 || isFetching}
                        className="h-7 px-2 font-sans text-[10px]"
                      >
                        <ChevronLeft className="mr-0.5 size-3" />
                        Prev
                      </Button>
                      <div className="flex items-center gap-1">
                        {Array.from(
                          { length: displayTotalPages },
                          (_, i) => i + 1
                        ).map(p => (
                          <button
                            key={p}
                            onClick={() => setPage(p)}
                            className={cn(
                              "size-6 rounded-sm font-sans text-[10px] transition-all",
                              page === p
                                ? "border border-foreground bg-foreground text-background"
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
                        onClick={() =>
                          setPage(p => Math.min(displayTotalPages, p + 1))
                        }
                        disabled={page >= displayTotalPages || isFetching}
                        className="h-7 px-2 font-sans text-[10px]"
                      >
                        Next
                        <ChevronRight className="ml-0.5 size-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </>
            )}
          </HudPanel>
        </div>

        <aside className="min-w-0">
          <HudPanel
            title="Strategy pulse"
            subtitle={
              isFullScanLoading
                ? "scanning all pages"
                : "all-page scanner summary"
            }
          >
            <div className="flex flex-col gap-3">
              <StrategyRow
                name="Entry candidates"
                meta="oversold + confirmation"
                value={entryCount}
                tone="up"
                active={signalFilter === "entry"}
                disabled={!fullScanData}
                onView={() => handleStrategyView("entry")}
              />
              <StrategyRow
                name="Exit candidates"
                meta="overextended / reversal"
                value={exitCount}
                tone="down"
                active={signalFilter === "exit"}
                disabled={!fullScanData}
                onView={() => handleStrategyView("exit")}
              />
              <StrategyRow
                name="Neutral watch"
                meta="waiting for confluence"
                value={neutralCount}
                active={signalFilter === "neutral"}
                disabled={!fullScanData}
                onView={() => handleStrategyView("neutral")}
              />
            </div>
          </HudPanel>
        </aside>
      </div>
    </div>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-bold tracking-[0.06em] text-background/55">
        {label}
      </div>
      <div className="mt-1 font-sans text-sm text-background/90">{value}</div>
    </div>
  );
}

function AssetIcon({
  symbol,
  inverse = false,
}: {
  symbol: string;
  inverse?: boolean;
}) {
  const [hasError, setHasError] = useState(false);
  const base = symbol.replace("USDT", "").toLowerCase();
  const fallback = symbol.slice(0, 1);

  return (
    <div
      className={cn(
        "flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-bold",
        inverse
          ? "bg-background/12 text-background"
          : "bg-muted text-foreground"
      )}
    >
      {hasError ? (
        <span>{fallback}</span>
      ) : (
        <img
          src={`https://assets.coincap.io/assets/icons/${base}@2x.png`}
          alt=""
          className="size-full object-cover"
          loading="lazy"
          onError={() => setHasError(true)}
        />
      )}
    </div>
  );
}

function useHeroChartData(symbol: string, interval: TimeframeValue) {
  const [data, setData] = useState<HeroChartPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadChartData() {
      setIsLoading(true);
      const candles = await fetchKlines(symbol, interval, 80);
      if (cancelled) return;
      setData(candles.map(toHeroChartPoint));
      setIsLoading(false);
    }

    loadChartData();

    return () => {
      cancelled = true;
    };
  }, [symbol, interval]);

  return { data, isLoading };
}

function toHeroChartPoint(candle: Candle): HeroChartPoint {
  return {
    time: new Date(candle.openTime).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    }),
    price: candle.close,
    volume: candle.volume,
  };
}

function HeroPriceChart({
  data,
  isLoading,
  positive,
}: {
  data: HeroChartPoint[];
  isLoading: boolean;
  positive: boolean;
}) {
  const stroke = positive ? "var(--tl-up)" : "var(--tl-down)";
  const fill = positive ? "rgb(85 172 87 / 0.18)" : "rgb(211 60 60 / 0.18)";

  return (
    <div className="mt-8 h-32 overflow-hidden xl:mt-5 xl:h-auto xl:min-h-0 xl:flex-1">
      {isLoading ? (
        <div className="flex h-full items-center justify-center border-y border-background/10 text-xs font-bold text-background/45">
          Loading live chart...
        </div>
      ) : data.length > 1 ? (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 6, right: 0, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient
                id="heroPriceGradient"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor={fill} />
                <stop offset="100%" stopColor="rgb(255 255 255 / 0)" />
              </linearGradient>
            </defs>
            <XAxis dataKey="time" hide />
            <YAxis
              dataKey="price"
              hide
              domain={["dataMin", "dataMax"]}
              type="number"
            />
            <Tooltip
              cursor={{ stroke: "rgb(255 255 255 / 0.22)", strokeWidth: 1 }}
              contentStyle={{
                background: "var(--tl-white)",
                border: "1px solid var(--border-1)",
                borderRadius: 8,
                color: "var(--tl-black)",
                fontFamily: "var(--font-sans)",
                fontSize: 12,
              }}
              formatter={value => [
                `$${Number(value).toLocaleString(undefined, {
                  maximumFractionDigits: Number(value) < 1 ? 6 : 2,
                })}`,
                "Price",
              ]}
            />
            <Area
              type="monotone"
              dataKey="price"
              stroke={stroke}
              strokeWidth={2.5}
              fill="url(#heroPriceGradient)"
              dot={false}
              activeDot={{
                r: 3,
                stroke,
                strokeWidth: 2,
                fill: "var(--tl-white)",
              }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex h-full items-center justify-center border-y border-background/10 text-xs font-bold text-background/45">
          Chart unavailable
        </div>
      )}
    </div>
  );
}

function StrategyRow({
  name,
  meta,
  value,
  tone = "default",
  active = false,
  disabled = false,
  onView,
}: {
  name: string;
  meta: string;
  value: number;
  tone?: "default" | "up" | "down";
  active?: boolean;
  disabled?: boolean;
  onView?: () => void;
}) {
  return (
    <div className="grid grid-cols-[28px_1fr_auto] items-center gap-3 border-b border-muted pb-3 last:border-b-0 last:pb-0">
      <div
        className={cn(
          "flex size-7 items-center justify-center rounded text-xs font-bold text-white",
          tone === "up"
            ? "bg-neon-green"
            : tone === "down"
              ? "bg-neon-red"
              : "bg-foreground"
        )}
      >
        {value}
      </div>
      <div>
        <div className="text-sm font-bold tracking-tight">{name}</div>
        <div className="font-sans text-[11px] text-muted-foreground">
          {meta}
        </div>
      </div>
      <Button
        variant={active ? "default" : value > 0 ? "outline" : "ghost"}
        size="sm"
        className="h-7 px-2 text-xs"
        disabled={disabled || value === 0}
        onClick={onView}
      >
        {value > 0 ? (active ? "Showing" : "view") : "idle"}
      </Button>
    </div>
  );
}
