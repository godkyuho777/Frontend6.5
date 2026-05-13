/**
 * EMA + ADX 정배열 추세 — 메인 리스트 페이지 (Fibonacci 스타일).
 *
 * 첫 화면: 스캔된 코인 리스트 + 통계 헤더. 코인 row 클릭 시 본 트래커의
 * 코인 상세 페이지 (`/trackers/ema-adx-trend/:symbol`, 6탭) 로 이동.
 *
 * 사용자 요청 (2026-05-11): Fibonacci & Trendline 페이지처럼 리스트 우선,
 * 코인 클릭 시 매매기준/실시간 신호/코인 정보 등의 탭이 표시되는 구조.
 */

import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { HudPanel } from "@/components/HudPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Activity,
  ChevronRight,
  Clock,
  Loader2,
  RefreshCw,
  Search,
  TrendingDown,
  TrendingUp,
  ArrowUpDown,
} from "lucide-react";

type TF = "1h" | "4h" | "1d";
const TF_OPTIONS: TF[] = ["1h", "4h", "1d"];

type SortKey =
  | "symbol"
  | "price"
  | "change24h"
  | "ema"
  | "adx"
  | "diDiff"
  | "confidence";
type SortDir = "asc" | "desc";

function SortHeader({
  label,
  sortKeyVal,
  className,
  sortKey,
  onSort,
}: {
  label: string;
  sortKeyVal: SortKey;
  className?: string;
  sortKey: SortKey;
  onSort: (key: SortKey) => void;
}) {
  return (
    <th
      className={cn(
        "text-right font-mono text-[10px] text-muted-foreground uppercase tracking-wider py-2 px-2 cursor-pointer hover:text-neon-cyan transition-colors",
        className,
      )}
      onClick={() => onSort(sortKeyVal)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortKey === sortKeyVal && <ArrowUpDown className="h-3 w-3" />}
      </span>
    </th>
  );
}

export default function EmaAdxTrendListPage() {
  const [, setLocation] = useLocation();
  const [tf, setTf] = useState<TF>("4h");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("confidence");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const { data, isLoading, isFetching, refetch } =
    trpc.emaAdxTrend.scan.useQuery(
      { tf },
      { staleTime: 60_000, refetchOnWindowFocus: false },
    );

  const results = data?.results ?? [];

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "symbol" ? "asc" : "desc");
    }
  };

  const filteredAndSorted = useMemo(() => {
    let list = [...results];
    if (searchQuery) {
      list = list.filter((r) =>
        r.symbol.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    }
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "symbol":
          cmp = a.symbol.localeCompare(b.symbol);
          break;
        case "price":
          cmp = a.prices.price - b.prices.price;
          break;
        case "change24h":
          // EMA+ADX 응답엔 24h change 가 없음. confidence 로 fallback.
          cmp = a.finalConfidence - b.finalConfidence;
          break;
        case "ema":
          cmp = a.breakdown.emaStack - b.breakdown.emaStack;
          break;
        case "adx":
          cmp = a.prices.adx - b.prices.adx;
          break;
        case "diDiff":
          cmp =
            a.prices.plusDi - a.prices.minusDi -
            (b.prices.plusDi - b.prices.minusDi);
          break;
        case "confidence":
          cmp = a.finalConfidence - b.finalConfidence;
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [results, searchQuery, sortKey, sortDir]);

  const buyCount = results.filter((r) => r.triggered && r.side === "LONG").length;
  const sellCount = results.filter((r) => r.triggered && r.side === "SHORT").length;
  const avgConfidence = results.length
    ? Math.round(
        results.reduce((s, r) => s + r.finalConfidence, 0) / results.length,
      )
    : 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-wider text-neon-pink glow-pink flex items-center gap-3">
            <TrendingUp className="h-6 w-6" />
            EMA + ADX 정배열
          </h1>
          <p className="font-mono text-xs text-muted-foreground mt-1 uppercase tracking-wider">
            {tf.toUpperCase()} TIMEFRAME // EMA 9/21/50 + ADX(14) + ±DI + SMA(50) + HH/HL // BYBIT DATA
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* TF Selector */}
          <div className="flex items-center gap-1.5 bg-card/50 border border-border/30 rounded-sm px-2 py-1">
            <Clock className="h-3 w-3 text-neon-cyan" />
            <div className="flex gap-0.5">
              {TF_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  onClick={() => setTf(opt)}
                  className={cn(
                    "font-mono text-[10px] px-2 py-1 rounded-sm transition-all uppercase",
                    tf === opt
                      ? "bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/30",
                  )}
                >
                  {opt}
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
            REFRESH
          </Button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
        <StatCard label="TOTAL COINS" value={String(results.length)} unit="tracked" color="cyan" />
        <StatCard label="BUY SIGNALS" value={String(buyCount)} color="green" />
        <StatCard label="SELL SIGNALS" value={String(sellCount)} color="red" />
        <StatCard label="AVG CONF." value={`${avgConfidence}`} unit="/ 100" color="yellow" />
        <StatCard label="TIMEFRAME" value={tf.toUpperCase()} unit="candles" color="cyan" />
      </div>

      {/* List panel */}
      <HudPanel
        title="EMA + ADX SCAN"
        subtitle={`${results.length} 코인 · Bybit Spot · final_confidence ≥ 55 시그널 발행`}
      >
        {/* Search */}
        <div className="mb-3 relative max-w-sm">
          <Search className="h-3 w-3 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search symbol..."
            className="font-mono text-xs pl-8 bg-background border-border/30"
          />
        </div>

        {isLoading && results.length === 0 && (
          <div className="flex items-center justify-center py-12 gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-neon-cyan" />
            <span className="font-mono text-xs text-muted-foreground">
              EMA · ADX · DI · SMA · HH/HL 계산 중...
            </span>
          </div>
        )}

        {!isLoading && results.length === 0 && (
          <p className="font-mono text-xs text-muted-foreground py-4 text-center">
            데이터 없음 — REFRESH 후 다시 시도
          </p>
        )}

        {results.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/30">
                  <SortHeader
                    label="Symbol"
                    sortKeyVal="symbol"
                    className="text-left"
                    sortKey={sortKey}
                    onSort={handleSort}
                  />
                  <SortHeader label="Price" sortKeyVal="price" sortKey={sortKey} onSort={handleSort} />
                  <SortHeader label="EMA Stack" sortKeyVal="ema" className="hidden sm:table-cell" sortKey={sortKey} onSort={handleSort} />
                  <SortHeader label="ADX" sortKeyVal="adx" sortKey={sortKey} onSort={handleSort} />
                  <SortHeader label="±DI" sortKeyVal="diDiff" className="hidden md:table-cell" sortKey={sortKey} onSort={handleSort} />
                  <SortHeader label="Confidence" sortKeyVal="confidence" sortKey={sortKey} onSort={handleSort} />
                  <th className="text-center font-mono text-[10px] text-muted-foreground uppercase tracking-wider py-2 px-2">Signal</th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSorted.map((r) => {
                  const emaUp = r.prices.ema9 > r.prices.ema21 && r.prices.ema21 > r.prices.ema50;
                  const emaDown = r.prices.ema9 < r.prices.ema21 && r.prices.ema21 < r.prices.ema50;
                  const diDiff = r.prices.plusDi - r.prices.minusDi;
                  return (
                    <tr
                      key={r.symbol}
                      onClick={() =>
                        setLocation(`/trackers/ema-adx-trend/${r.symbol}?tf=${tf}`)
                      }
                      className={cn(
                        "border-b border-border/10 cursor-pointer transition-colors",
                        r.triggered && r.side === "LONG"
                          ? "bg-neon-green/5 hover:bg-neon-green/10 border-l-2 border-l-neon-green"
                          : r.triggered && r.side === "SHORT"
                          ? "bg-neon-red/5 hover:bg-neon-red/10 border-l-2 border-l-neon-red"
                          : "hover:bg-neon-cyan/5",
                      )}
                    >
                      <td className="py-2 px-2">
                        <span className="font-display text-xs font-bold text-neon-cyan">
                          {r.symbol.replace("USDT", "")}
                        </span>
                      </td>
                      <td className="text-right py-2 px-2 font-mono text-xs text-foreground">
                        ${r.prices.price < 1 ? r.prices.price.toFixed(6) : r.prices.price < 100 ? r.prices.price.toFixed(4) : r.prices.price.toFixed(2)}
                      </td>
                      <td className="text-right py-2 px-2 font-mono text-xs hidden sm:table-cell">
                        <span
                          className={cn(
                            emaUp ? "text-neon-green" : emaDown ? "text-neon-red" : "text-muted-foreground",
                          )}
                        >
                          {emaUp ? "▲ 정배열" : emaDown ? "▼ 역배열" : "혼합"}
                        </span>
                      </td>
                      <td className="text-right py-2 px-2 font-mono text-xs text-foreground">
                        {r.prices.adx.toFixed(1)}
                      </td>
                      <td className="text-right py-2 px-2 font-mono text-[10px] text-muted-foreground hidden md:table-cell">
                        <span className={diDiff > 0 ? "text-neon-green" : "text-neon-red"}>
                          {diDiff >= 0 ? "+" : ""}{diDiff.toFixed(1)}
                        </span>
                      </td>
                      <td className="text-right py-2 px-2 font-mono text-xs">
                        <span
                          className={cn(
                            "font-bold",
                            r.finalConfidence >= 55
                              ? "text-neon-yellow"
                              : "text-muted-foreground",
                          )}
                        >
                          {r.finalConfidence}
                        </span>
                      </td>
                      <td className="text-center py-2 px-2">
                        {r.triggered ? (
                          <span
                            className={cn(
                              "font-mono text-[10px] px-2 py-0.5 rounded-sm border font-bold uppercase",
                              r.side === "LONG"
                                ? "text-neon-green border-neon-green/40 bg-neon-green/10"
                                : "text-neon-red border-neon-red/40 bg-neon-red/10",
                            )}
                          >
                            {r.side === "LONG" ? (
                              <TrendingUp className="inline h-3 w-3 mr-1" />
                            ) : (
                              <TrendingDown className="inline h-3 w-3 mr-1" />
                            )}
                            {r.side === "LONG" ? "BUY" : "SELL"}
                          </span>
                        ) : (
                          <span className="font-mono text-[10px] text-muted-foreground">
                            <ChevronRight className="inline h-3 w-3" />
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </HudPanel>

      {/* Footer hint */}
      <p className="font-mono text-[10px] text-muted-foreground/60 text-center">
        💡 코인 행을 클릭하면 매매기준 · 실시간 신호 · 차트 · 백테스트 · 히스토리 · 코인 정보 6 탭이 열립니다.
      </p>
    </div>
  );
}

// ─── Local StatCard (Fibonacci 스타일과 색상 일관성) ────────────────

function StatCard({
  label,
  value,
  unit,
  color,
}: {
  label: string;
  value: string;
  unit?: string;
  color: "green" | "red" | "cyan" | "yellow";
}) {
  const colorClass = {
    green: "text-neon-green",
    red: "text-neon-red",
    cyan: "text-neon-cyan",
    yellow: "text-neon-yellow",
  }[color];
  return (
    <div className="bg-card/50 border border-border/30 rounded-sm p-3">
      <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
        {label}
      </div>
      <div className="flex items-baseline gap-2">
        <span className={cn("font-display text-2xl font-bold", colorClass)}>{value}</span>
        {unit && <span className="font-mono text-[10px] text-muted-foreground">{unit}</span>}
      </div>
    </div>
  );
}
