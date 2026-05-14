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
import { HudPanel, StatCard } from "@/components/HudPanel";
import { RefreshIconButton } from "@/components/RefreshIconButton";
import { SearchField } from "@/components/SearchField";
import { TimeRangeSegmented } from "@/components/TimeRangeSegmented";
import { cn } from "@/lib/utils";
import {
  ChevronRight,
  Loader2,
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
        "group cursor-pointer select-none whitespace-nowrap px-4 py-3 text-left font-sans text-[11px] tracking-wider text-muted-foreground transition-colors hover:text-primary",
        className
      )}
      onClick={() => onSort(sortKeyVal)}
    >
      <span className="inline-flex items-center gap-1.5">
        {label}
        {sortKey === sortKeyVal && (
          <ArrowUpDown className="size-4 text-muted-foreground transition-colors group-hover:text-primary" />
        )}
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
      { staleTime: 60_000, refetchOnWindowFocus: false }
    );

  const results = data?.results ?? [];

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "symbol" ? "asc" : "desc");
    }
  };

  const filteredAndSorted = useMemo(() => {
    let list = [...results];
    if (searchQuery) {
      list = list.filter(r =>
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
            a.prices.plusDi -
            a.prices.minusDi -
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

  const buyCount = results.filter(r => r.triggered && r.side === "LONG").length;
  const sellCount = results.filter(
    r => r.triggered && r.side === "SHORT"
  ).length;
  const avgConfidence = results.length
    ? Math.round(
        results.reduce((s, r) => s + r.finalConfidence, 0) / results.length
      )
    : 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
            EMA + ADX 정배열
          </h1>
          <p className="font-mono text-xs text-muted-foreground mt-1">
            {tf.toUpperCase()} timeframe / EMA 9/21/50 + ADX(14) + ±DI + SMA(50)
            + HH/HL / Bybit data
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TimeRangeSegmented
            options={TF_OPTIONS.map(value => ({
              value,
              label: value.toUpperCase(),
            }))}
            value={tf}
            onChange={setTf}
          />
          <RefreshIconButton
            onClick={() => refetch()}
            label="Refresh EMA ADX scanner"
            isLoading={isFetching}
          />
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
        <StatCard
          label="Total coins"
          value={String(results.length)}
          unit="tracked"
        />
        <StatCard
          label="Buy signals"
          value={String(buyCount)}
          variant={buyCount > 0 ? "positive" : "default"}
        />
        <StatCard
          label="Sell signals"
          value={String(sellCount)}
          variant={sellCount > 0 ? "negative" : "default"}
        />
        <StatCard
          label="Avg confidence"
          value={`${avgConfidence}`}
          unit="/ 100"
        />
        <StatCard label="Timeframe" value={tf.toUpperCase()} unit="candles" />
      </div>

      {/* List panel */}
      <HudPanel
        title="EMA + ADX SCAN"
        subtitle={`${results.length} 코인 · Bybit Spot · final_confidence ≥ 55 시그널 발행`}
        headerRight={
          <SearchField
            wrapperClassName="w-48"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search symbol..."
          />
        }
      >
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
                  <SortHeader
                    label="Price"
                    sortKeyVal="price"
                    sortKey={sortKey}
                    onSort={handleSort}
                  />
                  <SortHeader
                    label="EMA Stack"
                    sortKeyVal="ema"
                    className="hidden sm:table-cell"
                    sortKey={sortKey}
                    onSort={handleSort}
                  />
                  <SortHeader
                    label="ADX"
                    sortKeyVal="adx"
                    sortKey={sortKey}
                    onSort={handleSort}
                  />
                  <SortHeader
                    label="±DI"
                    sortKeyVal="diDiff"
                    className="hidden md:table-cell"
                    sortKey={sortKey}
                    onSort={handleSort}
                  />
                  <SortHeader
                    label="Confidence"
                    sortKeyVal="confidence"
                    sortKey={sortKey}
                    onSort={handleSort}
                  />
                  <th className="px-4 py-3 text-center font-sans text-[11px] tracking-wider text-muted-foreground">
                    Signal
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSorted.map(r => {
                  const emaUp =
                    r.prices.ema9 > r.prices.ema21 &&
                    r.prices.ema21 > r.prices.ema50;
                  const emaDown =
                    r.prices.ema9 < r.prices.ema21 &&
                    r.prices.ema21 < r.prices.ema50;
                  const diDiff = r.prices.plusDi - r.prices.minusDi;
                  return (
                    <tr
                      key={r.symbol}
                      onClick={() =>
                        setLocation(
                          `/trackers/ema-adx-trend/${r.symbol}?tf=${tf}`
                        )
                      }
                      className={cn(
                        "border-b border-border/10 cursor-pointer transition-colors",
                        r.triggered && r.side === "LONG"
                          ? "bg-neon-green/5 hover:bg-neon-green/10"
                          : r.triggered && r.side === "SHORT"
                            ? "bg-neon-red/5 hover:bg-neon-red/10"
                            : "hover:bg-muted/60"
                      )}
                    >
                      <td className="px-4 py-3">
                        <span className="font-display text-sm font-bold text-foreground">
                          {r.symbol.replace("USDT", "")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-foreground">
                        $
                        {r.prices.price < 1
                          ? r.prices.price.toFixed(6)
                          : r.prices.price < 100
                            ? r.prices.price.toFixed(4)
                            : r.prices.price.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs hidden sm:table-cell">
                        <span
                          className={cn(
                            emaUp
                              ? "text-neon-green"
                              : emaDown
                                ? "text-neon-red"
                                : "text-muted-foreground"
                          )}
                        >
                          {emaUp ? "정배열" : emaDown ? "역배열" : "혼합"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-foreground">
                        {r.prices.adx.toFixed(1)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-[10px] text-muted-foreground hidden md:table-cell">
                        <span
                          className={
                            diDiff > 0 ? "text-neon-green" : "text-neon-red"
                          }
                        >
                          {diDiff >= 0 ? "+" : ""}
                          {diDiff.toFixed(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs">
                        <span
                          className={cn(
                            "font-bold",
                            r.finalConfidence >= 55
                              ? "text-neon-yellow"
                              : "text-muted-foreground"
                          )}
                        >
                          {r.finalConfidence}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {r.triggered ? (
                          <span
                            className={cn(
                              "font-mono text-[10px] px-2 py-0.5 rounded-md border font-bold",
                              r.side === "LONG"
                                ? "text-neon-green border-neon-green/40 bg-neon-green/10"
                                : "text-neon-red border-neon-red/40 bg-neon-red/10"
                            )}
                          >
                            {r.side === "LONG" ? (
                              <TrendingUp className="inline h-3 w-3 mr-1" />
                            ) : (
                              <TrendingDown className="inline h-3 w-3 mr-1" />
                            )}
                            {r.side === "LONG" ? "Buy" : "Sell"}
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
        코인 행을 클릭하면 매매기준 · 실시간 신호 · 차트 · 백테스트 · 히스토리 ·
        코인 정보 6 탭이 열립니다.
      </p>
    </div>
  );
}
