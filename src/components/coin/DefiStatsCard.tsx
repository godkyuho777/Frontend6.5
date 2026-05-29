/**
 * DefiStatsCard — 코인이 DeFi 프로토콜인 경우 TVL + 카테고리 + 변화율 표시.
 *
 * 백엔드 `trpc.coin.defiStats` 라우트 (DefiLlama wrapper) 결과를 메트릭 grid +
 * AreaChart (TVL 시계열) + 체인 분포 badge 로 표시. 백엔드 라우트는 onchain
 * agent 완료 후 별도 위임 예정이므로, ExchangeTickersCard (Top 1) 와 동일한
 * `as unknown as` 우회 + graceful fallback 패턴을 사용한다.
 *
 * 동작:
 *   - NOT_DEFI (비-DeFi 코인) → 카드 자체 숨김 (null).
 *   - 백엔드 미배포 / 기타 에러 → 조용히 숨김 (null). 정보 표시만이므로
 *     NotAvailable 안내를 띄우지 않는다.
 *   - ok → HudPanel 안에 TVL 메트릭 + 차트 + 체인 분포.
 *
 * 헌장: modifier-only (정보 표시만). TVL/변화율은 BBDX 점수에 영향 없음.
 * 데이터 소스: DefiLlama API (https://api.llama.fi/ · 무료 · 키 X · 1시간 캐시).
 */

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { HudPanel } from "@/components/HudPanel";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types — 백엔드 push 후 `RouterOutputs["coin"]["defiStats"]` 로 교체 가능.
// 미러 형태는 작업 단위 명세서 따름.
// ---------------------------------------------------------------------------

interface DefiProtocol {
  name: string;
  category: string;
  tvlUsd: number;
  tvlChange1d: number;
  tvlChange7d: number;
  tvlChange30d: number;
  chains: string[];
  mcapTvlRatio: number | null;
}

interface DefiTvlPoint {
  date: string;
  tvlUsd: number;
}

interface DefiStatsOk {
  ok: true;
  symbol: string;
  protocol: DefiProtocol;
  tvlHistory: DefiTvlPoint[];
}

interface DefiStatsErr {
  ok: false;
  code: "NOT_DEFI" | "NOT_FOUND" | "RATE_LIMITED" | "INTERNAL";
  message: string;
}

type DefiStatsResponse = DefiStatsOk | DefiStatsErr;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatLargeNumber(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return n.toFixed(0);
}

function formatPct(fraction: number): string {
  if (!Number.isFinite(fraction)) return "—";
  const sign = fraction >= 0 ? "+" : "";
  return `${sign}${(fraction * 100).toFixed(2)}%`;
}

function formatChartDate(raw: string): string {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

// ---------------------------------------------------------------------------
// Metric — TVL grid 셀 (positive 시 neon-green, negative 시 neon-red).
// ---------------------------------------------------------------------------

function Metric({
  label,
  value,
  positive,
}: {
  label: string;
  value: string;
  positive?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-sm border border-border/30 bg-card/40 px-3 py-2">
      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span
        className={cn(
          "font-mono text-sm tabular-nums",
          positive === undefined
            ? "text-foreground"
            : positive
              ? "text-neon-green"
              : "text-neon-red",
        )}
      >
        {value}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface DefiStatsCardProps {
  symbol: string;
}

export function DefiStatsCard({ symbol }: DefiStatsCardProps) {
  // 백엔드 `coin.defiStats` 라우트 미존재 시 build-time error 회피. 백엔드 push
  // 후엔 `trpc.coin.defiStats.useQuery(...)` 로 교체 가능.
  const trpcAny = trpc as unknown as {
    coin?: {
      defiStats?: {
        useQuery: (
          input: { symbol: string },
          options?: { staleTime?: number; refetchOnWindowFocus?: boolean; retry?: number },
        ) => {
          data?: DefiStatsResponse;
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
    error: { message: "coin.defiStats 라우트 미존재 (backend 작업 진행 중)" },
  };

  const query =
    trpcAny.coin?.defiStats?.useQuery?.(
      { symbol },
      { staleTime: 60 * 60 * 1000, refetchOnWindowFocus: false, retry: 0 },
    ) ?? fallback;

  // --- Loading state ---------------------------------------------------------
  if (query.isLoading) {
    return (
      <HudPanel title="DeFi 프로토콜 정보" subtitle="DEFI · TVL">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
        <Skeleton className="mt-3 h-[200px] w-full" />
      </HudPanel>
    );
  }

  // --- 비-DeFi 코인 → 카드 자체 숨김 -----------------------------------------
  // (BTC, DOGE, XRP, LTC, TRX, SHIB, PEPE 등)
  if (query.data && query.data.ok === false && query.data.code === "NOT_DEFI") {
    return null;
  }

  // --- 에러 / 미배포 → 조용히 숨김 -------------------------------------------
  // 정보 표시만이므로 (모디파이어 X) NotAvailable 안내 대신 null.
  if (query.isError || !query.data || query.data.ok !== true) {
    return null;
  }

  // --- Success ---------------------------------------------------------------
  const { protocol, tvlHistory } = query.data;
  const hasChart = Array.isArray(tvlHistory) && tvlHistory.length > 1;

  return (
    <HudPanel
      title="DeFi 프로토콜 정보"
      subtitle={`${protocol.category} · ${protocol.chains.length}개 체인`}
      headerRight={
        <Badge
          variant="outline"
          className="border-neon-cyan/40 font-mono text-[10px] text-neon-cyan"
        >
          {protocol.name}
        </Badge>
      }
    >
      {/* TVL 메트릭 grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="TVL" value={`$${formatLargeNumber(protocol.tvlUsd)}`} />
        <Metric label="1d" value={formatPct(protocol.tvlChange1d)} positive={protocol.tvlChange1d >= 0} />
        <Metric label="7d" value={formatPct(protocol.tvlChange7d)} positive={protocol.tvlChange7d >= 0} />
        <Metric label="30d" value={formatPct(protocol.tvlChange30d)} positive={protocol.tvlChange30d >= 0} />
      </div>

      {/* Mcap/TVL ratio */}
      {protocol.mcapTvlRatio != null && Number.isFinite(protocol.mcapTvlRatio) && (
        <div className="mt-2 font-mono text-xs text-muted-foreground">
          Mcap/TVL:{" "}
          <span className="tabular-nums text-foreground/80">
            {protocol.mcapTvlRatio.toFixed(2)}
          </span>{" "}
          <span
            className={cn(
              protocol.mcapTvlRatio < 1 ? "text-neon-green" : "text-neon-yellow",
            )}
          >
            ({protocol.mcapTvlRatio < 1 ? "저평가 가능" : "고평가 가능"})
          </span>
        </div>
      )}

      {/* TVL 시계열 차트 */}
      {hasChart && (
        <div className="mt-3">
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={tvlHistory} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="defiTvlGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-neon-cyan)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--color-neon-cyan)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.03 260)" />
              <XAxis
                dataKey="date"
                tickFormatter={formatChartDate}
                tick={{ fontSize: 9, fontFamily: "Share Tech Mono", fill: "oklch(0.5 0.02 260)" }}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={40}
              />
              <YAxis
                tickFormatter={formatLargeNumber}
                tick={{ fontSize: 9, fontFamily: "Share Tech Mono", fill: "oklch(0.5 0.02 260)" }}
                tickLine={false}
                width={44}
                domain={["auto", "auto"]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "oklch(0.14 0.015 260)",
                  border: "1px solid oklch(0.25 0.03 260)",
                  borderRadius: "4px",
                  fontFamily: "Share Tech Mono",
                  fontSize: "11px",
                  color: "oklch(0.92 0.01 260)",
                }}
                labelFormatter={(label) => formatChartDate(String(label))}
                formatter={(v: number) => [`$${formatLargeNumber(v)}`, "TVL"]}
              />
              <Area
                type="monotone"
                dataKey="tvlUsd"
                stroke="var(--color-neon-cyan)"
                strokeWidth={1.5}
                fill="url(#defiTvlGrad)"
                dot={false}
                activeDot={{ r: 3, fill: "var(--color-neon-cyan)" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 체인 분포 */}
      {protocol.chains.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {protocol.chains.map((c) => (
            <Badge
              key={c}
              variant="outline"
              className="border-neon-cyan/30 font-mono text-[10px] text-neon-cyan/80"
            >
              {c}
            </Badge>
          ))}
        </div>
      )}

      <p className="mt-3 font-mono text-[10px] leading-relaxed text-muted-foreground">
        데이터: DefiLlama · 1시간 캐시. TVL (Total Value Locked) = 프로토콜에
        예치된 총 자산. 정보 표시용이며 BBDX 시그널 점수에는 영향이 없습니다.
      </p>
    </HudPanel>
  );
}
