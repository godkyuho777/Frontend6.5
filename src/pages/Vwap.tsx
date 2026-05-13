import { HudPanel, StatCard } from "@/components/HudPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  RefreshCw,
  Search,
  ArrowUpDown,
  Clock,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Activity,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { TIMEFRAMES } from "@shared/types";
import type {
  CoinScanResult,
  EmaPosition,
  TimeframeValue,
  VwapPosition,
} from "@shared/types";
import { useMarketScan } from "@/hooks/useMarketData";
import { trpc } from "@/lib/trpc";
import {
  VwapChartPanel,
  VolumeProfilePanel,
  SignalCardV2,
  AlignmentCard,
  PullbackQualityCard,
  VwapMultChip,
  type VwapDetailLite,
} from "./Vwap/VwapDetailPanels";

type SortKey = "symbol" | "price" | "change24h" | "vwap" | "ema" | "strength";
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

function renderPosition(p: VwapPosition | EmaPosition) {
  if (p === "ABOVE") {
    return (
      <span className="font-mono text-[11px] text-neon-green inline-flex items-center gap-0.5">
        <TrendingUp className="h-3 w-3" />
        ABOVE
      </span>
    );
  }
  if (p === "BELOW") {
    return (
      <span className="font-mono text-[11px] text-neon-red inline-flex items-center gap-0.5">
        <TrendingDown className="h-3 w-3" />
        BELOW
      </span>
    );
  }
  return (
    <span className="font-mono text-[11px] text-muted-foreground">AT</span>
  );
}

function positionRank(p: VwapPosition | EmaPosition): number {
  return p === "ABOVE" ? 2 : p === "AT" ? 1 : 0;
}

export default function Vwap() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedInterval, setSelectedInterval] = useState<TimeframeValue>("4h");
  const [sortKey, setSortKey] = useState<SortKey>("strength");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const [selectedSymbol, setSelectedSymbol] = useState<string>("BTCUSDT");
  const pageSize = 10;

  // VWAP detail (5-component, Volume Profile, multi-TF) — 하단 deep-dive 패널용.
  // tRPC `vwap.detail` 라우트 (백엔드 v6.5 머지 후 활성화).
  const detailTf: "1h" | "4h" | "1d" =
    selectedInterval === "1h" || selectedInterval === "4h" || selectedInterval === "1d"
      ? selectedInterval
      : "4h";
  const detailQuery = trpc.vwap.detail.useQuery(
    { symbol: selectedSymbol, tf: detailTf },
    {
      enabled: !!selectedSymbol,
      staleTime: 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    }
  );
  const detail = detailQuery.data as VwapDetailLite | undefined;

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
        case "vwap":
          cmp = positionRank(a.vwapPosition) - positionRank(b.vwapPosition);
          break;
        case "ema":
          cmp = positionRank(a.emaPosition) - positionRank(b.emaPosition);
          break;
        case "strength": {
          const aS = a.vwapSignal?.strength ?? 0;
          const bS = b.vwapSignal?.strength ?? 0;
          cmp = aS - bS;
          break;
        }
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [coins, searchQuery, sortKey, sortDir]);

  const longCount = coins.filter((c) => c.vwapSignal?.side === "LONG").length;
  const shortCount = coins.filter((c) => c.vwapSignal?.side === "SHORT").length;
  const pullbackCount = coins.filter((c) => c.pullbackDetected).length;
  const strengths = coins
    .map((c) => c.vwapSignal?.strength ?? 0)
    .filter((s) => s > 0);
  const avgStrength = strengths.length
    ? Math.round(strengths.reduce((a, b) => a + b, 0) / strengths.length)
    : 0;

  const tfLabel =
    TIMEFRAMES.find((t) => t.value === selectedInterval)?.label ?? selectedInterval;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-wider text-neon-pink glow-pink flex items-center gap-3">
            <Activity className="h-6 w-6" />
            VWAP STRATEGY
          </h1>
          <p className="font-mono text-xs text-muted-foreground mt-1">
            {tfLabel} TIMEFRAME // VWAP + EMA(9) + VOLUME PROFILE // PARKER BROOKS STYLE
          </p>
        </div>
        <div className="flex items-center gap-2">
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
          label="Long Signals"
          value={longCount}
          variant={longCount > 0 ? "positive" : "default"}
        />
        <StatCard
          label="Short Signals"
          value={shortCount}
          variant={shortCount > 0 ? "negative" : "default"}
        />
        <StatCard label="Avg Strength" value={`${avgStrength}%`} />
        <StatCard label="Pullbacks" value={pullbackCount} unit="detected" />
      </div>

      <HudPanel
        title="VWAP Analysis"
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
        {error && !scanData && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <AlertCircle className="h-8 w-8 text-neon-red" />
            <p className="font-mono text-sm text-neon-red">Failed to load market data</p>
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

        {isLoading && !error && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-neon-pink" />
            <p className="font-mono text-sm text-foreground">
              Loading {pageSize} coins on {tfLabel}...
            </p>
          </div>
        )}

        {!isLoading && scanData && (
          <>
            {isFetching && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-neon-cyan/5 border-b border-neon-cyan/20">
                <Loader2 className="h-3 w-3 animate-spin text-neon-cyan" />
                <span className="font-mono text-[10px] text-neon-cyan">
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
                    <SortHeader label="VWAP Pos" sortKeyVal="vwap" sortKey={sortKey} onSort={handleSort} />
                    <SortHeader label="EMA Pos" sortKeyVal="ema" className="hidden md:table-cell" sortKey={sortKey} onSort={handleSort} />
                    <th className="text-right font-mono text-[10px] text-muted-foreground uppercase tracking-wider py-2 px-2 hidden md:table-cell">
                      Pullback
                    </th>
                    <SortHeader label="Strength" sortKeyVal="strength" className="hidden sm:table-cell" sortKey={sortKey} onSort={handleSort} />
                    <th className="text-center font-mono text-[10px] text-muted-foreground uppercase tracking-wider py-2 px-2">
                      Signal
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSorted.map((coin) => {
                    const sig = coin.vwapSignal;
                    return (
                      <tr
                        key={coin.symbol}
                        onClick={() => {
                          setSelectedSymbol(coin.symbol);
                          // detail 패널은 하단에서 보고, 별도 deep dive 는 더블클릭 등으로 이전.
                          // 현 클릭은 하단 detail 만 갱신, 이동은 SHIFT 조합 등으로 이전.
                        }}
                        onDoubleClick={() =>
                          // 통일된 6-탭 CoinDetail 로 이동 (사용자 요청, 2026-05-13).
                          // VWAP 차트 + Volume Profile + std-dev 밴드는
                          // /coin/:symbol?tab=chart 의 ChartZone 안에서 시각화 예정.
                          // VWAP 전용 데이터는 useVwapDetail hook 이 CoinSignalTab 에서 fetch.
                          setLocation(`/coin/${coin.symbol}?tab=signal&tf=${selectedInterval}`)
                        }
                        className={cn(
                          "border-b border-border/10 cursor-pointer transition-colors",
                          coin.symbol === selectedSymbol &&
                            "ring-1 ring-neon-pink/40",
                          sig?.side === "LONG"
                            ? "bg-neon-green/5 hover:bg-neon-green/10 border-l-2 border-l-neon-green"
                            : sig?.side === "SHORT"
                            ? "bg-neon-red/5 hover:bg-neon-red/10 border-l-2 border-l-neon-red"
                            : "hover:bg-neon-cyan/5"
                        )}
                      >
                        <td className="py-2 px-2">
                          <span className="font-display text-xs font-bold text-neon-cyan">
                            {coin.symbol.replace("USDT", "")}
                          </span>
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
                          {renderPosition(coin.vwapPosition)}
                        </td>
                        <td className="text-right py-2 px-2 hidden md:table-cell">
                          {renderPosition(coin.emaPosition)}
                        </td>
                        <td className="text-right py-2 px-2 hidden md:table-cell">
                          {coin.pullbackDetected ? (
                            <span className="font-mono text-[11px] text-neon-yellow inline-flex items-center gap-0.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-neon-yellow signal-pulse" />
                              YES
                            </span>
                          ) : (
                            <span className="font-mono text-[11px] text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="text-right py-2 px-2 hidden sm:table-cell">
                          {sig && sig.strength > 0 ? (
                            <div className="flex items-center justify-end gap-1">
                              <div className="w-10 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div
                                  className={cn(
                                    "h-full rounded-full transition-all",
                                    sig.strength >= 75
                                      ? "bg-neon-green"
                                      : sig.strength >= 50
                                      ? "bg-neon-yellow"
                                      : "bg-neon-cyan"
                                  )}
                                  style={{ width: `${sig.strength}%` }}
                                />
                              </div>
                              <span className="font-mono text-[10px] text-muted-foreground w-7 text-right">
                                {sig.strength}%
                              </span>
                            </div>
                          ) : (
                            <span className="font-mono text-[10px] text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="text-center py-2 px-2">
                          {sig?.side === "LONG" ? (
                            <Badge className="bg-neon-green/20 text-neon-green border-neon-green/40 font-mono text-[10px]">
                              <TrendingUp className="h-2.5 w-2.5 mr-0.5" />
                              LONG
                            </Badge>
                          ) : sig?.side === "SHORT" ? (
                            <Badge className="bg-neon-red/20 text-neon-red border-neon-red/40 font-mono text-[10px]">
                              <TrendingDown className="h-2.5 w-2.5 mr-0.5" />
                              SHORT
                            </Badge>
                          ) : (
                            <span className="font-mono text-[10px] text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filteredAndSorted.length === 0 && searchQuery && (
              <div className="flex flex-col items-center justify-center py-8">
                <p className="font-mono text-sm text-muted-foreground">
                  No coins matching "{searchQuery}"
                </p>
              </div>
            )}

            <div className="flex items-center justify-between px-3 py-3 border-t border-border/20">
              <span className="font-mono text-[10px] text-muted-foreground">
                Showing {(page - 1) * pageSize + 1}-
                {Math.min(page * pageSize, totalCoins)} of {totalCoins} coins
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

      {/* ============================================================ */}
      {/* DEEP DIVE — vwap.detail 응답 시각화 (5-component / VP / multi-TF) */}
      {/* 사용자가 row 클릭 → selectedSymbol 갱신 → trpc.vwap.detail 자동 fetch */}
      {/* ============================================================ */}
      <HudPanel
        title={`Deep Dive — ${selectedSymbol.replace("USDT", "")}`}
        subtitle={`${detailTf.toUpperCase()} · click row above to switch · double-click to open coin page`}
        variant="highlight"
        headerRight={
          detail ? <VwapMultChip vwapMult={detail.vwapMult} /> : null
        }
      >
        {detailQuery.isLoading && (
          <div className="flex items-center gap-2 py-6 justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-neon-cyan" />
            <span className="font-mono text-xs text-muted-foreground">
              Loading VWAP detail for {selectedSymbol}...
            </span>
          </div>
        )}

        {detailQuery.isError && (
          <div className="flex flex-col items-center gap-2 py-6">
            <AlertCircle className="h-5 w-5 text-neon-red" />
            <p className="font-mono text-xs text-neon-red">
              VWAP detail 라우트 호출 실패 — 백엔드가 v6.5 머지 후 부팅되었는지
              확인하세요.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => detailQuery.refetch()}
              className="border-neon-cyan/30 text-neon-cyan hover:bg-neon-cyan/10 font-mono text-xs"
            >
              <RefreshCw className="h-3 w-3 mr-1" /> RETRY
            </Button>
          </div>
        )}

        {detail && !detailQuery.isLoading && (
          <div className="space-y-4">
            {/* 좌 70% (chart + signalV2) / 우 30% (volume profile) */}
            <div className="grid grid-cols-1 md:grid-cols-10 gap-4">
              <div className="md:col-span-7 space-y-4">
                <div className="rounded-sm border border-border/30 bg-card/40 p-3">
                  <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-2">
                    Price · VWAP · EMA(9) · ±1/2/3σ Bands
                  </div>
                  <VwapChartPanel detail={detail} />
                </div>
                <SignalCardV2 detail={detail} />
              </div>
              <div className="md:col-span-3">
                <HudPanel title="Volume Profile" subtitle="POC · HVN · LVN · VA">
                  <VolumeProfilePanel profile={detail.volumeProfile} />
                </HudPanel>
              </div>
            </div>

            {/* Multi-TF + Pullback 카드 (2열) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <AlignmentCard alignment={detail.multiTfAlignment} />
              <PullbackQualityCard pullback={detail.pullbackV2} />
            </div>
          </div>
        )}
      </HudPanel>
    </div>
  );
}
