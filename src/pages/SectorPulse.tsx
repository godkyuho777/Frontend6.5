/**
 * Sector Pulse (섹터 펄스) — 암호화폐 섹터 24h 변동률 디스커버리 (2026-05-17).
 *
 * UX:
 *   1. 12 sector 카드 그리드 — 각 카드는 sector 평균 24h % + top performer + coin count
 *   2. 카드 클릭 → drill-down: 해당 sector 의 모든 코인을 24h% desc 정렬해 표시
 *   3. 코인 클릭 → /coin/:symbol (기존 CoinDetail 페이지)
 *
 * 정렬 모드:
 *   - Performance — 변동률 desc (default, 상승 섹터 먼저)
 *   - Volatility — |변동률| desc (강세/약세 무관 큰 움직임 먼저)
 *   - Default — SECTORS 배열 순서 (Layer 1 → ZK 까지 메타 정렬)
 *
 * 데이터:
 *   - Bybit `fetchAll24hTickers()` 1회 호출 (60s refetch)
 *   - 바이비트 전체 USDT 스팟 코인 (레버리지 토큰 제외)
 *   - 분류된 코인은 해당 섹터로, 미분류 코인은 "기타" 버킷으로 집계
 *
 * 헌장: Sector Pulse 는 *디스커버리* 도구. BBDX 시그널 시스템과 무관 (헌장
 * R3 영향 X). 단독 매매 시그널 발행 X.
 */

import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { HudPanel } from "@/components/HudPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshIconButton } from "@/components/RefreshIconButton";
import { cn } from "@/lib/utils";
import { fetchAll24hTickers } from "@/lib/bybit-client";
import {
  aggregateBySector,
  sortByPerformance,
  sortByVolatility,
  type SectorRow,
  type SectorTicker,
} from "@/lib/sector-aggregator";
import { isExcludedSymbol } from "@/lib/coin-universe";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  ChevronRight,
  X,
  Loader2,
  Sparkles,
} from "lucide-react";

type SortMode = "performance" | "volatility" | "default";

export default function SectorPulse() {
  const [, setLocation] = useLocation();
  const [tickers, setTickers] = useState<Map<string, SectorTicker>>(new Map());
  const [loading, setLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSectorId, setSelectedSectorId] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("performance");

  // ── Fetch 24h tickers (60s refetch) ───────────────────────
  const loadTickers = async () => {
    setIsFetching(true);
    setError(null);
    try {
      const map = await fetchAll24hTickers();
      // 바이비트 전체 USDT 스팟 코인 (레버리지 토큰 제외). 미분류 코인은
      // aggregateBySector 의 "기타" 버킷으로 자동 집계된다.
      const result = new Map<string, SectorTicker>();
      for (const [sym, t] of map) {
        if (isExcludedSymbol(sym)) continue;
        result.set(sym, {
          symbol: sym,
          price: t.price,
          change24h: t.change24h,
          volume24h: t.volume24h,
        });
      }
      setTickers(result);
    } catch (e) {
      setError((e as Error)?.message ?? "Failed to load tickers");
    } finally {
      setLoading(false);
      setIsFetching(false);
    }
  };

  useEffect(() => {
    loadTickers();
    const id = setInterval(loadTickers, 60_000);
    return () => clearInterval(id);
  }, []);

  // ── 집계 ──────────────────────────────────────────────────
  const rows = useMemo(() => aggregateBySector(tickers), [tickers]);
  const sortedRows = useMemo(() => {
    switch (sortMode) {
      case "performance":
        return sortByPerformance(rows);
      case "volatility":
        return sortByVolatility(rows);
      default:
        return rows;
    }
  }, [rows, sortMode]);

  const selectedRow = useMemo(
    () => rows.find((r) => r.sector.id === selectedSectorId) ?? null,
    [rows, selectedSectorId],
  );

  // 시장 전체 평균 (overall pulse)
  const marketAvg = useMemo(() => {
    const values = Array.from(tickers.values()).map((t) => t.change24h);
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }, [tickers]);

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-neon-cyan" />
            섹터 동향
          </h1>
          <p className="font-mono text-xs text-muted-foreground mt-1">
            섹터별 24시간 등락과 자금 흐름을 한눈에 봅니다
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end">
            <span className="font-mono text-[10px] uppercase text-muted-foreground">
              시장 평균
            </span>
            <span
              className={cn(
                "font-display font-bold text-base",
                marketAvg >= 0 ? "text-neon-green" : "text-neon-red",
              )}
            >
              {marketAvg >= 0 ? "+" : ""}
              {marketAvg.toFixed(2)}%
            </span>
          </div>
          <RefreshIconButton
            onClick={loadTickers}
            label="Refresh sector pulse"
            isLoading={isFetching}
          />
        </div>
      </div>

      {/* Sort tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono text-[10px] uppercase text-muted-foreground">
          정렬:
        </span>
        {(
          [
            { id: "performance", label: "등락률 ▼" },
            { id: "volatility", label: "변동성" },
            { id: "default", label: "기본" },
          ] as { id: SortMode; label: string }[]
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSortMode(tab.id)}
            className={cn(
              "px-3 py-1 rounded-sm border text-[11px] font-mono uppercase transition-colors",
              sortMode === tab.id
                ? "border-neon-cyan text-neon-cyan bg-neon-cyan/10"
                : "border-border/30 text-muted-foreground hover:border-neon-cyan/40",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-md border border-neon-red/40 bg-neon-red/10 px-3 py-2 font-mono text-xs text-neon-red">
          섹터 데이터를 불러오지 못했습니다 — {error}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="py-20 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-neon-cyan opacity-60" />
        </div>
      )}

      {/* Sector grid */}
      {!loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {sortedRows.map((row) => (
            <SectorCard
              key={row.sector.id}
              row={row}
              isSelected={row.sector.id === selectedSectorId}
              onClick={() =>
                setSelectedSectorId((curr) =>
                  curr === row.sector.id ? null : row.sector.id,
                )
              }
            />
          ))}
        </div>
      )}

      {/* Drill-down panel */}
      {selectedRow && (
        <SectorDrillDown
          row={selectedRow}
          onClose={() => setSelectedSectorId(null)}
          onCoinClick={(symbol) => setLocation(`/coin/${symbol}`)}
        />
      )}

      {/* Footer note */}
      <div className="font-mono text-[10px] text-muted-foreground border-t border-border/20 pt-3">
        · 데이터: Bybit V5 (60s 자동 갱신) · {tickers.size.toLocaleString()}개 코인 ·{" "}
        {rows.length}개 섹터 (바이비트 전체 USDT 스팟)
        <br />
        · Sector 평균: 산술평균 (시총 가중치 X) · top performer 는 sector
        내 24h% 1위
        <br />
        · 본 페이지는 디스커버리 도구이며 단독 매매 시그널을 발행하지 않습니다
        (헌장 R3).
      </div>
    </div>
  );
}

// ─── SectorCard ─────────────────────────────────────────────

function SectorCard({
  row,
  isSelected,
  onClick,
}: {
  row: SectorRow;
  isSelected: boolean;
  onClick: () => void;
}) {
  const { sector, avgChange24h, coinCount, topPerformer, totalVolume24h } = row;
  const Icon = sector.icon;
  const isPositive = avgChange24h >= 0;
  const isFlat = Math.abs(avgChange24h) < 0.01;

  return (
    <button
      onClick={onClick}
      className={cn(
        "relative text-left rounded-md border px-3 py-3 transition-all",
        "hover:border-neon-cyan/60 hover:shadow-[0_0_15px_-5px_rgba(0,229,255,0.4)]",
        isSelected
          ? "border-neon-cyan bg-neon-cyan/10 shadow-[0_0_20px_-5px_rgba(0,229,255,0.5)]"
          : `${sector.accent} border-border/30`,
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className={cn("h-4 w-4 flex-shrink-0", sector.color)} />
          <span className="font-display font-bold text-sm text-foreground truncate">
            {sector.name}
          </span>
        </div>
        <Badge
          variant="outline"
          className="font-mono text-[9px] uppercase border-border/30 text-muted-foreground"
        >
          {coinCount}개
        </Badge>
      </div>

      {/* Avg % */}
      <div
        className={cn(
          "font-display font-bold text-2xl",
          isFlat
            ? "text-muted-foreground"
            : isPositive
              ? "text-neon-green"
              : "text-neon-red",
        )}
      >
        {isPositive && !isFlat && "+"}
        {avgChange24h.toFixed(2)}%
      </div>

      {/* Top performer */}
      {topPerformer && (
        <div className="mt-1 flex items-center justify-between gap-2">
          <span className="font-mono text-[10px] text-foreground truncate">
            {topPerformer.symbol.replace("USDT", "")}
          </span>
          <span
            className={cn(
              "font-mono text-[10px] font-semibold",
              topPerformer.change24h >= 0 ? "text-neon-green" : "text-neon-red",
            )}
          >
            {topPerformer.change24h >= 0 ? "+" : ""}
            {topPerformer.change24h.toFixed(2)}%
          </span>
        </div>
      )}

      {/* Volume (subtle) */}
      <div className="mt-1 font-mono text-[9px] text-muted-foreground">
        24h 거래대금 ${(totalVolume24h / 1e6).toFixed(1)}M
      </div>

      {/* Trend icon (absolute, top-right) */}
      <div className="absolute top-2 right-12">
        {isFlat ? (
          <Activity className="h-3 w-3 text-muted-foreground" />
        ) : isPositive ? (
          <TrendingUp className="h-3 w-3 text-neon-green" />
        ) : (
          <TrendingDown className="h-3 w-3 text-neon-red" />
        )}
      </div>
    </button>
  );
}

// ─── SectorDrillDown ────────────────────────────────────────

function SectorDrillDown({
  row,
  onClose,
  onCoinClick,
}: {
  row: SectorRow;
  onClose: () => void;
  onCoinClick: (symbol: string) => void;
}) {
  const Icon = row.sector.icon;
  return (
    <HudPanel
      title={`${row.sector.name} · ${row.coinCount}개 코인`}
      subtitle={row.sector.description}
      headerRight={
        <div className="flex items-center gap-2">
          <Icon className={cn("h-5 w-5", row.sector.color)} />
          <Button
            size="sm"
            variant="outline"
            onClick={onClose}
            className="h-7 px-2 font-mono text-[10px]"
          >
            <X className="h-3 w-3 mr-1" />
            닫기
          </Button>
        </div>
      }
    >
      {row.coins.length === 0 ? (
        <p className="font-mono text-xs text-muted-foreground text-center py-6">
          섹터 내 코인 데이터 없음
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/20 font-mono text-[10px] text-muted-foreground uppercase">
                <th className="text-left px-2 py-1.5">#</th>
                <th className="text-left px-2 py-1.5">심볼</th>
                <th className="text-right px-2 py-1.5">가격</th>
                <th className="text-right px-2 py-1.5">24h %</th>
                <th className="text-right px-2 py-1.5">24h 거래대금</th>
                <th className="px-2 py-1.5"></th>
              </tr>
            </thead>
            <tbody>
              {row.coins.map((coin, i) => (
                <CoinRow
                  key={coin.symbol}
                  rank={i + 1}
                  coin={coin}
                  onClick={() => onCoinClick(coin.symbol)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Sector summary footer */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-3 border-t border-border/20">
        <SummaryStat
          label="평균 24h"
          value={`${row.avgChange24h >= 0 ? "+" : ""}${row.avgChange24h.toFixed(2)}%`}
          color={row.avgChange24h >= 0 ? "text-neon-green" : "text-neon-red"}
        />
        <SummaryStat
          label="최고"
          value={row.topPerformer ? row.topPerformer.symbol.replace("USDT", "") : "—"}
          sub={
            row.topPerformer
              ? `${row.topPerformer.change24h >= 0 ? "+" : ""}${row.topPerformer.change24h.toFixed(2)}%`
              : undefined
          }
          color="text-neon-green"
        />
        <SummaryStat
          label="최저"
          value={
            row.bottomPerformer ? row.bottomPerformer.symbol.replace("USDT", "") : "—"
          }
          sub={
            row.bottomPerformer
              ? `${row.bottomPerformer.change24h >= 0 ? "+" : ""}${row.bottomPerformer.change24h.toFixed(2)}%`
              : undefined
          }
          color="text-neon-red"
        />
        <SummaryStat
          label="총 거래대금"
          value={`$${(row.totalVolume24h / 1e6).toFixed(1)}M`}
          color="text-neon-cyan"
        />
      </div>
    </HudPanel>
  );
}

function CoinRow({
  rank,
  coin,
  onClick,
}: {
  rank: number;
  coin: SectorTicker;
  onClick: () => void;
}) {
  const isUp = coin.change24h >= 0;
  return (
    <tr
      onClick={onClick}
      className="border-b border-border/10 font-mono text-[11px] hover:bg-muted/10 cursor-pointer transition-colors"
    >
      <td className="px-2 py-1.5 text-muted-foreground">{rank}</td>
      <td className="px-2 py-1.5 text-foreground font-semibold">
        {coin.symbol.replace("USDT", "")}
      </td>
      <td className="px-2 py-1.5 text-right text-foreground">
        ${formatPrice(coin.price)}
      </td>
      <td
        className={cn(
          "px-2 py-1.5 text-right font-bold",
          isUp ? "text-neon-green" : "text-neon-red",
        )}
      >
        {isUp ? "+" : ""}
        {coin.change24h.toFixed(2)}%
      </td>
      <td className="px-2 py-1.5 text-right text-muted-foreground">
        ${(coin.volume24h / 1e6).toFixed(2)}M
      </td>
      <td className="px-2 py-1.5 text-right text-muted-foreground">
        <ChevronRight className="h-3 w-3 inline" />
      </td>
    </tr>
  );
}

function SummaryStat({
  label,
  value,
  sub,
  color = "text-foreground",
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="flex flex-col">
      <span className="font-mono text-[9px] uppercase text-muted-foreground">
        {label}
      </span>
      <span className={cn("font-display font-bold text-sm", color)}>{value}</span>
      {sub && (
        <span className={cn("font-mono text-[10px]", color, "opacity-70")}>
          {sub}
        </span>
      )}
    </div>
  );
}

function formatPrice(p: number): string {
  if (!p || p === 0) return "—";
  if (p < 0.01) return p.toFixed(8);
  if (p < 1) return p.toFixed(6);
  if (p < 100) return p.toFixed(4);
  return p.toLocaleString("en-US", { maximumFractionDigits: 2 });
}
