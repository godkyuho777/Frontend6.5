import { HudPanel, StatCard } from "@/components/HudPanel";
import { RefreshIconButton } from "@/components/RefreshIconButton";
import { SearchField } from "@/components/SearchField";
import { TimeRangeSegmented } from "@/components/TimeRangeSegmented";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  RefreshCw,
  ArrowUpDown,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { TIMEFRAMES } from "@shared/types";
import type { CoinScanResult, TimeframeValue } from "@shared/types";
import { useFullMarketScan, useMarketScan } from "@/hooks/useMarketData";

type SortKey = "symbol" | "price" | "change24h" | "fib" | "trendlines" | "strength";
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

type Trend = "up" | "down" | "sideways";

/**
 * Derive trend direction from the available indicator data:
 *   - +DI > -DI by ≥5 and ADX ≥ 20 → up
 *   - -DI > +DI by ≥5 and ADX ≥ 20 → down
 *   - otherwise → sideways
 */
function deriveTrend(coin: CoinScanResult): Trend {
  const { plusDi, minusDi, adx } = coin.indicators;
  if (adx < 20) return "sideways";
  if (plusDi - minusDi >= 5) return "up";
  if (minusDi - plusDi >= 5) return "down";
  return "sideways";
}

/**
 * Describe the price's position within the fib range. We use the backend's
 * `fibSignal` as the primary signal source; if absent, we synthesize a
 * description from the cached fibLevels list.
 */
function describeFibZone(coin: CoinScanResult): { label: string; isGolden: boolean } {
  if (coin.fibSignal) {
    const lvl = coin.fibSignal.level;
    const isGolden = lvl === 0.382 || lvl === 0.618;
    return {
      label: `Fib ${(lvl * 100).toFixed(1)}%${isGolden ? " (Golden)" : ""}`,
      isGolden,
    };
  }
  // Fallback: position relative to BB middle as a rough zone hint
  const fibLevels = coin.indicators.fibLevels ?? [];
  if (fibLevels.length === 0) return { label: "—", isGolden: false };
  const price = coin.price;
  // Find bracketing levels
  const sorted = [...fibLevels].sort((a, b) => a.level - b.level);
  for (let i = 0; i < sorted.length - 1; i++) {
    const lo = sorted[i];
    const hi = sorted[i + 1];
    if (price >= Math.min(lo.price, hi.price) && price <= Math.max(lo.price, hi.price)) {
      const isGolden = (lo.level >= 0.382 && hi.level <= 0.618);
      return {
        label: `${(lo.level * 100).toFixed(1)}–${(hi.level * 100).toFixed(1)}%`,
        isGolden,
      };
    }
  }
  return { label: "Out of range", isGolden: false };
}

/**
 * Fibonacci-specific signal: BUY when price is in the golden zone with active
 * trendline support; SELL when price is at extension levels (≥1.272) or has
 * broken trend; otherwise null.
 */
function deriveFibSignal(coin: CoinScanResult): "BUY" | "SELL" | null {
  const zone = describeFibZone(coin);
  const trendlineCount = coin.indicators.trendlines?.filter((t) => t.isActive).length ?? 0;

  if (coin.fibSignal) {
    return coin.fibSignal.type === "buy" ? "BUY" : "SELL";
  }
  // Fallback: no fibSignal → null (need explicit signal)
  if (zone.isGolden && trendlineCount >= 1) return "BUY";
  return null;
}

export default function Fibonacci() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedInterval, setSelectedInterval] = useState<TimeframeValue>("4h");
  const [sortKey, setSortKey] = useState<SortKey>("strength");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const {
    data: scanData,
    isLoading,
    refetch,
    isFetching,
    error,
  } = useMarketScan(page, pageSize, selectedInterval);

  // 검색 시 사용할 전체 코인 풀. lazy 하지만 page 변경과 무관하게 1회 fetch.
  const { data: fullScanData } = useFullMarketScan(selectedInterval);

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
  const fullCoins = fullScanData?.coins ?? EMPTY_COINS;

  // 검색이 활성일 때는 전체 코인 풀에서 매치되도록 전체 fullScan 데이터 사용.
  // fullScan 이 아직 안 왔으면 현재 페이지 데이터로 fallback.
  const trimmedQuery = searchQuery.trim();
  const isSearching = trimmedQuery.length > 0;
  const sourceList =
    isSearching && fullCoins.length > 0 ? fullCoins : coins;

  const filteredAndSorted = useMemo(() => {
    let list = [...sourceList];
    if (isSearching) {
      const q = trimmedQuery.toUpperCase();
      list = list.filter((r) => r.symbol.toUpperCase().includes(q));
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
        case "fib":
          // Order: golden > non-golden > none
          cmp = (a.fibSignal ? 2 : 0) - (b.fibSignal ? 2 : 0);
          break;
        case "trendlines": {
          const aCount = a.indicators.trendlines?.filter((t) => t.isActive).length ?? 0;
          const bCount = b.indicators.trendlines?.filter((t) => t.isActive).length ?? 0;
          cmp = aCount - bCount;
          break;
        }
        case "strength":
          cmp = a.signalStrength - b.signalStrength;
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [sourceList, isSearching, trimmedQuery, sortKey, sortDir]);

  // 검색이 활성일 때는 결과 전체를 클라이언트 사이드로 페이지네이션.
  const displayList = isSearching
    ? filteredAndSorted.slice((page - 1) * pageSize, page * pageSize)
    : filteredAndSorted;
  const displayTotalPages = isSearching
    ? Math.max(1, Math.ceil(filteredAndSorted.length / pageSize))
    : totalPages;

  const buyCount = coins.filter((c) => deriveFibSignal(c) === "BUY").length;
  const sellCount = coins.filter((c) => deriveFibSignal(c) === "SELL").length;
  const avgStrength = coins.length
    ? Math.round(coins.reduce((sum, c) => sum + c.signalStrength, 0) / coins.length)
    : 0;
  const tfLabel =
    TIMEFRAMES.find((t) => t.value === selectedInterval)?.label ?? selectedInterval;
  const timeframeOptions = TIMEFRAMES.map((tf) => ({
    label: tf.label,
    value: tf.value as TimeframeValue,
  }));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
            Fibonacci &amp; trendline
          </h1>
          <p className="font-mono text-xs text-muted-foreground mt-1">
            {tfLabel} timeframe / Fibonacci retracement + trendline analysis / Bybit data
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TimeRangeSegmented
            options={timeframeOptions}
            value={selectedInterval}
            onChange={(value) => {
              setSelectedInterval(value);
              setPage(1);
            }}
          />
          <RefreshIconButton
            onClick={() => refetch()}
            label="Rescan Fibonacci scanner"
            isLoading={isFetching}
          />
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Total coins" value={totalCoins} unit="tracked" />
        <StatCard
          label="Buy signals"
          value={buyCount}
          variant={buyCount > 0 ? "positive" : "default"}
        />
        <StatCard
          label="Sell signals"
          value={sellCount}
          variant={sellCount > 0 ? "negative" : "default"}
        />
        <StatCard label="Avg strength" value={`${avgStrength}%`} />
        <StatCard label="Timeframe" value={tfLabel} unit="candles" />
      </div>

      <HudPanel
        title="Fibonacci analysis"
        subtitle={
          isSearching
            ? `Searching "${trimmedQuery}" · ${filteredAndSorted.length} match${filteredAndSorted.length === 1 ? "" : "es"} · ${tfLabel}`
            : coins.length > 0
              ? `Page ${page} of ${totalPages} · ${coins.length} coins · Bybit Spot`
              : "Loading market data..."
        }
        headerRight={
          <SearchField
            wrapperClassName="w-48"
              placeholder="Search symbol..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                // 검색 시 page=1 reset — 결과가 다른 페이지에 있어도 첫 페이지부터 보이도록.
                setPage(1);
              }}
          />
        }
      >
        {error && !scanData && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <AlertCircle className="h-8 w-8 text-neon-red" />
            <p className="font-sans text-sm text-neon-red">Failed to load market data</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="border-neon-cyan/30 text-neon-cyan hover:bg-neon-cyan/10 font-sans text-xs mt-2"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Retry
            </Button>
          </div>
        )}

        {isLoading && !error && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-neon-pink" />
            <p className="font-sans text-sm text-foreground">
              Loading {pageSize} coins on {tfLabel}...
            </p>
          </div>
        )}

        {!isLoading && scanData && (
          <>
            {isFetching && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-neon-cyan/5 border-b border-neon-cyan/20">
                <Loader2 className="h-3 w-3 animate-spin text-neon-cyan" />
                <span className="font-sans text-[10px] text-neon-cyan">
                  Updating data...
                </span>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/30">
                    <SortHeader label="Symbol" sortKeyVal="symbol" className="text-left" sortKey={sortKey} onSort={handleSort} />
                    <SortHeader label="Price" sortKeyVal="price" sortKey={sortKey} onSort={handleSort} />
                    <SortHeader label="24h" sortKeyVal="change24h" className="hidden sm:table-cell" sortKey={sortKey} onSort={handleSort} />
                    <SortHeader label="Fib Zone" sortKeyVal="fib" sortKey={sortKey} onSort={handleSort} />
                    <th className="hidden whitespace-nowrap px-4 py-3 text-left font-sans text-[11px] tracking-wider text-muted-foreground md:table-cell">
                      Trend
                    </th>
                    <SortHeader label="Trendlines" sortKeyVal="trendlines" className="hidden md:table-cell" sortKey={sortKey} onSort={handleSort} />
                    <SortHeader label="Strength" sortKeyVal="strength" className="hidden sm:table-cell" sortKey={sortKey} onSort={handleSort} />
                    <th className="whitespace-nowrap px-4 py-3 text-left font-sans text-[11px] tracking-wider text-muted-foreground">
                      Signal
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {displayList.map((coin) => {
                    const zone = describeFibZone(coin);
                    const trend = deriveTrend(coin);
                    const trendlineCount =
                      coin.indicators.trendlines?.filter((t) => t.isActive).length ?? 0;
                    const sig = deriveFibSignal(coin);
                    const rowBgClass =
                      sig === "BUY"
                        ? "bg-[#f1faf1] group-hover:bg-[#e7f4e7]"
                        : sig === "SELL"
                        ? "bg-[#fff9e8] group-hover:bg-[#fff2c7]"
                        : "bg-card group-hover:bg-muted";

                    return (
                      <tr
                        key={coin.symbol}
                        onClick={() =>
                          // 통일된 6-탭 CoinDetail 로 이동.
                          // tracker=fibonacci 로 CoinDetail 의 매매기준/신호/차트/백테스트가
                          // Fibonacci 룰 기반으로 렌더링됨.
                          setLocation(`/coin/${coin.symbol}?tab=signal&tracker=fibonacci&tf=${selectedInterval}`)
                        }
                        className={cn(
                          "group cursor-pointer border-b border-border/40 transition-colors",
                          sig === "BUY"
                            ? "bg-neon-green/5 hover:bg-neon-green/10"
                            : sig === "SELL"
                            ? "bg-neon-red/5 hover:bg-neon-red/10"
                            : "hover:bg-muted"
                        )}
                      >
                        <td className={cn("whitespace-nowrap px-4 py-4 text-left transition-colors", rowBgClass)}>
                          <span className="font-sans text-sm font-bold leading-none text-foreground">
                            {coin.symbol.replace("USDT", "")}
                          </span>
                        </td>
                        <td className={cn("whitespace-nowrap px-4 py-4 text-left font-sans text-sm text-foreground transition-colors", rowBgClass)}>
                          ${coin.price < 1 ? coin.price.toFixed(6) : coin.price < 100 ? coin.price.toFixed(4) : coin.price.toFixed(2)}
                        </td>
                        <td
                          className={cn(
                            "hidden whitespace-nowrap px-4 py-4 text-left font-sans text-sm transition-colors sm:table-cell",
                            rowBgClass,
                            coin.change24h >= 0 ? "text-neon-green" : "text-neon-red"
                          )}
                        >
                          {coin.change24h >= 0 ? "+" : ""}
                          {coin.change24h.toFixed(2)}%
                        </td>
                        <td className={cn("whitespace-nowrap px-4 py-4 text-left transition-colors", rowBgClass)}>
                          <Badge
                            variant="outline"
                            className={cn(
                              "border-none font-sans text-xs",
                              zone.isGolden
                                ? "bg-neon-yellow/15 text-neon-yellow"
                                : zone.label === "—"
                                ? "bg-muted/30 text-muted-foreground"
                                : "bg-neon-cyan/10 text-neon-cyan"
                            )}
                          >
                            {zone.label}
                          </Badge>
                        </td>
                        <td className={cn("hidden whitespace-nowrap px-4 py-4 text-left transition-colors md:table-cell", rowBgClass)}>
                          {trend === "up" ? (
                            <span className="inline-flex items-center gap-1 font-sans text-sm text-neon-green">
                              <TrendingUp className="h-3 w-3" />
                              Up
                            </span>
                          ) : trend === "down" ? (
                            <span className="inline-flex items-center gap-1 font-sans text-sm text-neon-red">
                              <TrendingDown className="h-3 w-3" />
                              Down
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 font-sans text-sm text-muted-foreground">
                              <Minus className="h-3 w-3" />
                              Side
                            </span>
                          )}
                        </td>
                        <td className={cn("hidden whitespace-nowrap px-4 py-4 text-left font-sans text-sm text-foreground transition-colors md:table-cell", rowBgClass)}>
                          {trendlineCount > 0 ? (
                            <span className="text-neon-cyan">{trendlineCount} active</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className={cn("hidden whitespace-nowrap px-4 py-4 text-left transition-colors sm:table-cell", rowBgClass)}>
                          {coin.signalStrength > 0 ? (
                            <div className="flex items-center justify-start gap-2">
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
                              <span className="w-8 text-left font-sans text-xs text-muted-foreground">
                                {coin.signalStrength}%
                              </span>
                            </div>
                          ) : (
                            <span className="font-sans text-[10px] text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className={cn("whitespace-nowrap px-4 py-4 text-left transition-colors", rowBgClass)}>
                          {sig === "BUY" ? (
                            <Badge className="bg-neon-green/20 text-neon-green border-neon-green/40 font-sans text-[10px]">
                              <TrendingUp className="h-2.5 w-2.5 mr-0.5" />
                              Buy
                            </Badge>
                          ) : sig === "SELL" ? (
                            <Badge className="bg-neon-red/20 text-neon-red border-neon-red/40 font-sans text-[10px]">
                              <TrendingDown className="h-2.5 w-2.5 mr-0.5" />
                              Sell
                            </Badge>
                          ) : (
                            <span className="font-sans text-[10px] text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filteredAndSorted.length === 0 && isSearching && (
              <div className="flex flex-col items-center justify-center py-8">
                <p className="font-sans text-sm text-muted-foreground">
                  No coins matching "{trimmedQuery}"
                </p>
              </div>
            )}

            <div className="flex items-center justify-between px-3 py-3 border-t border-border/20">
              <span className="font-sans text-[10px] text-muted-foreground">
                {isSearching
                  ? filteredAndSorted.length > 0
                    ? `Showing ${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, filteredAndSorted.length)} of ${filteredAndSorted.length} matches`
                    : `0 matches for "${trimmedQuery}"`
                  : `Showing ${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, totalCoins)} of ${totalCoins} coins`}
              </span>
              {displayTotalPages > 1 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1 || isFetching}
                    className="h-7 px-2 border-border/30 font-sans text-[10px]"
                  >
                    <ChevronLeft className="h-3 w-3 mr-0.5" />
                    PREV
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: displayTotalPages }, (_, i) => i + 1).map((p) => (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={cn(
                          "font-sans text-[10px] w-6 h-6 rounded-sm transition-all",
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
                    onClick={() => setPage((p) => Math.min(displayTotalPages, p + 1))}
                    disabled={page >= displayTotalPages || isFetching}
                    className="h-7 px-2 border-border/30 font-sans text-[10px]"
                  >
                    NEXT
                    <ChevronRight className="h-3 w-3 ml-0.5" />
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </HudPanel>
    </div>
  );
}
