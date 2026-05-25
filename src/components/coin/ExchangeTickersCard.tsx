/**
 * ExchangeTickersCard — 코인이 상장된 거래소 목록.
 *
 * 백엔드 `trpc.coin.tickers` 라우트 (CoinGecko tickers wrapper) 결과를
 * 표 (data) + 카드 (모바일) 두 형태로 표시. 백엔드 라우트 미존재 시
 * `as any` 우회 + graceful fallback 카드.
 *
 * 헌장: modifier-only (정보 표시만). 신뢰도 (trust score) 는 거래소의
 * CoinGecko quality flag (green/yellow/red) 그대로 노출 → 사용자가 결정.
 *
 * 데이터 정렬: 백엔드가 이미 trust score 우선 + 거래량 정렬해서 반환.
 * 클라이언트는 단순 표시만.
 */

import { HudPanel } from "@/components/HudPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { AlertCircle, ExternalLink, Loader2 } from "lucide-react";

// ---------------------------------------------------------------------------
// Types — 백엔드 push 후 `RouterOutputs["coin"]["tickers"]` 로 교체 가능.
// ---------------------------------------------------------------------------

interface ExchangeTicker {
  base: string;
  target: string;
  exchange: {
    name: string;
    identifier: string;
    trustScore: "green" | "yellow" | "red" | "unknown";
  };
  price: number;
  volume24hUsd: number;
  bidAskSpreadPct: number | null;
  tradeUrl: string | null;
  isStale: boolean;
  lastTradedAt: string;
}

interface TickersOk {
  ok: true;
  symbol: string;
  coinGeckoId: string;
  tickers: ExchangeTicker[];
  totalCount: number;
}

interface TickersErr {
  ok: false;
  code: "NOT_FOUND" | "STUB" | "RATE_LIMITED" | "INTERNAL";
  message: string;
}

type TickersResponse = TickersOk | TickersErr;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatVolume(usd: number): string {
  if (!Number.isFinite(usd) || usd <= 0) return "—";
  if (usd >= 1_000_000_000) return `${(usd / 1_000_000_000).toFixed(2)}B`;
  if (usd >= 1_000_000) return `${(usd / 1_000_000).toFixed(1)}M`;
  if (usd >= 1_000) return `${(usd / 1_000).toFixed(0)}K`;
  return usd.toFixed(0);
}

function formatPrice(usd: number): string {
  if (!Number.isFinite(usd)) return "—";
  if (usd >= 1) return usd.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return usd.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

function formatSpread(pct: number | null): string {
  if (pct == null || !Number.isFinite(pct)) return "—";
  return `${pct.toFixed(3)}%`;
}

// ---------------------------------------------------------------------------
// Trust score badge
// ---------------------------------------------------------------------------

function TrustScoreBadge({
  score,
}: {
  score: "green" | "yellow" | "red" | "unknown";
}) {
  if (score === "green") {
    return (
      <Badge
        variant="outline"
        className="border-neon-green/40 bg-neon-green/10 text-neon-green font-mono text-[10px]"
      >
        신뢰
      </Badge>
    );
  }
  if (score === "yellow") {
    return (
      <Badge
        variant="outline"
        className="border-neon-yellow/40 bg-neon-yellow/10 text-neon-yellow font-mono text-[10px]"
      >
        주의
      </Badge>
    );
  }
  if (score === "red") {
    return (
      <Badge
        variant="outline"
        className="border-neon-red/40 bg-neon-red/10 text-neon-red font-mono text-[10px]"
      >
        위험
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground">
      —
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ExchangeTickersCardProps {
  symbol: string;
}

export function ExchangeTickersCard({ symbol }: ExchangeTickersCardProps) {
  // 백엔드 `coin.tickers` 라우트 미존재 시 build-time error 회피. 백엔드 push
  // 후엔 `trpc.coin.tickers.useQuery(...)` 로 교체 가능.
  const trpcAny = trpc as unknown as {
    coin?: {
      tickers?: {
        useQuery: (
          input: { symbol: string; limit: number },
          options?: { staleTime?: number; refetchOnWindowFocus?: boolean; retry?: number },
        ) => {
          data?: TickersResponse;
          isLoading: boolean;
          isError: boolean;
          error?: { message: string };
        };
      };
    };
  };

  const fallback = {
    data: undefined,
    isLoading: false,
    isError: true,
    error: { message: "coin.tickers 라우트 미존재 (backend 작업 진행 중)" },
  };

  const query =
    trpcAny.coin?.tickers?.useQuery?.(
      { symbol, limit: 10 },
      { staleTime: 60 * 60 * 1000, refetchOnWindowFocus: false, retry: 0 },
    ) ?? fallback;

  // --- Loading state ---------------------------------------------------------
  if (query.isLoading) {
    return (
      <HudPanel title="거래 가능한 거래소" subtitle="EXCHANGE LISTINGS">
        <div className="flex items-center justify-center gap-2 py-6">
          <Loader2 className="h-4 w-4 animate-spin text-neon-cyan" />
          <span className="font-mono text-xs text-muted-foreground">
            거래소 정보 로딩 중...
          </span>
        </div>
        <div className="space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      </HudPanel>
    );
  }

  // --- Error / not available -------------------------------------------------
  if (query.isError || !query.data || query.data.ok !== true) {
    const reason =
      (query.data && query.data.ok === false ? query.data.message : null) ??
      query.error?.message ??
      "거래소 정보를 불러올 수 없음";
    return <NotAvailableCard reason={reason} />;
  }

  // --- Success ---------------------------------------------------------------
  const { tickers, totalCount } = query.data;

  if (tickers.length === 0) {
    return <NotAvailableCard reason="이 코인에 등록된 거래소가 없습니다." />;
  }

  return (
    <HudPanel
      title="거래 가능한 거래소"
      subtitle={`상위 ${tickers.length}개 / 전체 ${totalCount}개`}
    >
      {/* Desktop / tablet — table view */}
      <div className="hidden sm:block">
        <Table>
          <TableHeader>
            <TableRow className="border-border/40">
              <TableHead className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                거래소
              </TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                쌍
              </TableHead>
              <TableHead className="text-right font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                가격 (USD)
              </TableHead>
              <TableHead className="text-right font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                24h 거래량
              </TableHead>
              <TableHead className="text-right font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                스프레드
              </TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                신뢰도
              </TableHead>
              <TableHead className="w-8" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {tickers.map((t, i) => (
              <TableRow
                key={`${t.exchange.identifier}-${t.target}-${i}`}
                className="border-border/20"
              >
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-foreground">
                      {t.exchange.name}
                    </span>
                    {t.isStale && (
                      <Badge
                        variant="outline"
                        className="border-muted-foreground/30 font-mono text-[9px] text-muted-foreground"
                      >
                        stale
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {t.base}/{t.target}
                </TableCell>
                <TableCell className="text-right font-mono text-sm tabular-nums text-foreground">
                  ${formatPrice(t.price)}
                </TableCell>
                <TableCell className="text-right font-mono text-xs tabular-nums text-foreground/80">
                  ${formatVolume(t.volume24hUsd)}
                </TableCell>
                <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                  {formatSpread(t.bidAskSpreadPct)}
                </TableCell>
                <TableCell>
                  <TrustScoreBadge score={t.exchange.trustScore} />
                </TableCell>
                <TableCell>
                  {t.tradeUrl ? (
                    <a
                      href={t.tradeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        "inline-flex h-7 w-7 items-center justify-center rounded-sm",
                        "border border-neon-cyan/30 bg-neon-cyan/5 text-neon-cyan",
                        "hover:bg-neon-cyan/15 hover:border-neon-cyan/50 transition-colors",
                      )}
                      aria-label={`${t.exchange.name} 거래 페이지로 이동`}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : (
                    <span className="text-muted-foreground/40">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile — card view */}
      <div className="sm:hidden space-y-2">
        {tickers.map((t, i) => (
          <Card
            key={`${t.exchange.identifier}-${t.target}-${i}`}
            className="gap-2 bg-card/60 px-3 py-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-medium text-foreground">
                    {t.exchange.name}
                  </span>
                  {t.isStale && (
                    <Badge
                      variant="outline"
                      className="border-muted-foreground/30 font-mono text-[9px] text-muted-foreground"
                    >
                      stale
                    </Badge>
                  )}
                </div>
                <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                  {t.base}/{t.target}
                </div>
              </div>
              <TrustScoreBadge score={t.exchange.trustScore} />
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex flex-col gap-0.5">
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  가격
                </span>
                <span className="font-mono tabular-nums text-foreground">
                  ${formatPrice(t.price)}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  24h 거래량
                </span>
                <span className="font-mono tabular-nums text-foreground/80">
                  ${formatVolume(t.volume24hUsd)}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  스프레드
                </span>
                <span className="font-mono tabular-nums text-muted-foreground">
                  {formatSpread(t.bidAskSpreadPct)}
                </span>
              </div>
            </div>
            {t.tradeUrl && (
              <Button
                variant="outline"
                size="sm"
                asChild
                className="mt-1 h-7 border-neon-cyan/30 bg-neon-cyan/5 text-neon-cyan hover:bg-neon-cyan/15"
              >
                <a href={t.tradeUrl} target="_blank" rel="noopener noreferrer">
                  거래소 가기
                  <ExternalLink className="ml-1 h-3 w-3" />
                </a>
              </Button>
            )}
          </Card>
        ))}
      </div>

      <p className="mt-3 font-mono text-[10px] leading-relaxed text-muted-foreground">
        데이터: CoinGecko · 1시간 캐시 · trust score 우선 + 거래량 정렬.
        한국 거래소 (Upbit / Bithumb) 도 자동 포함.
      </p>
    </HudPanel>
  );
}

// ---------------------------------------------------------------------------
// Fallback — backend route 미배포 / NOT_FOUND / STUB / RATE_LIMITED / INTERNAL
// ---------------------------------------------------------------------------

function NotAvailableCard({ reason }: { reason: string }) {
  return (
    <HudPanel title="거래 가능한 거래소" subtitle="EXCHANGE LISTINGS · 데이터 미연결">
      <div className="flex items-start gap-2 rounded-sm border border-yellow-500/20 bg-yellow-500/5 px-3 py-2">
        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-yellow-400" />
        <div className="space-y-1">
          <p className="font-mono text-xs text-foreground/90">{reason}</p>
          <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">
            23-coin 화이트리스트 외 코인이거나, CoinGecko rate limit 또는
            백엔드 라우트 미배포 상태일 수 있습니다. 잠시 후 자동 재시도됩니다.
          </p>
        </div>
      </div>
    </HudPanel>
  );
}
