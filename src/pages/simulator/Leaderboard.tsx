/**
 * /simulator/leaderboard — Investment Simulator 랭킹 (2026-05-21).
 *
 * INVESTMENT_SIMULATOR_AUDIT.md §5 Phase 2 — Backend wiring (#5).
 *
 * 데이터 소스 (우선순위):
 *   1. `trpc.simulatorLeaderboard.fetch` (실데이터) — 30초 polling, 15초 stale.
 *   2. `DB_UNAVAILABLE` 응답 → mock fallback (`MOCK_LEADERBOARD_ENTRIES` + 본인 동적 entry).
 *   3. `INTERNAL` / 네트워크 에러 → 에러 카드.
 *
 * 정렬:
 *   - Backend 가 이미 pnlPct DESC 정렬 + rank 부여한 결과를 그대로 표시.
 *   - Mock fallback 은 클라이언트 `rankLeaderboard` 로 동일하게 정렬.
 */

import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  Trophy,
  Medal,
  TrendingUp,
  TrendingDown,
  Info,
  ArrowLeft,
  Sparkles,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { trpc, type RouterOutputs } from "@/lib/trpc";
import { useSimUser } from "@/hooks/useSimUser";
import {
  useLocalAccountSync,
  useLocalEquitySync,
  useLocalPositionsSync,
} from "@/hooks/useSimLocalStore";
import { INITIAL_CASH } from "@/lib/sim-local-store";
import {
  computeSimulatorStats,
  BBDX_BASELINE,
  MIN_TRADES_FOR_COMPARISON,
} from "@/lib/sim-pnl";
import {
  LEADERBOARD_PERIODS,
  MOCK_LEADERBOARD_ENTRIES,
  adaptBackendLeaderboard,
  findYourRank,
  rankLeaderboard,
  type LeaderboardEntry,
  type LeaderboardPeriod,
} from "@/lib/sim-leaderboard";

function formatUSD(n: number): string {
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function formatUSDCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) {
    return `${n < 0 ? "-" : ""}$${(abs / 1_000_000).toFixed(2)}M`;
  }
  if (abs >= 10_000) {
    return `${n < 0 ? "-" : ""}$${(abs / 1_000).toFixed(1)}k`;
  }
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function formatSignedUSD(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${formatUSDCompact(n)}`;
}

function formatPct(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

function formatWinRate(n: number): string {
  return `${(n * 100).toFixed(0)}%`;
}

function rankIcon(rank: number): string {
  if (rank === 1) return "1st";
  if (rank === 2) return "2nd";
  if (rank === 3) return "3rd";
  return `#${rank}`;
}

function rankBadgeClass(rank: number): string {
  if (rank === 1) return "text-neon-yellow font-bold";
  if (rank === 2) return "text-neon-cyan font-bold";
  if (rank === 3) return "text-neon-pink font-bold";
  return "text-muted-foreground";
}

export default function LeaderboardPage() {
  const [, setLocation] = useLocation();
  const { simUser } = useSimUser();
  const [period, setPeriod] = useState<LeaderboardPeriod>("all");

  // ── 본인 stats — local store + closed positions 기반 ──────
  // (Mock fallback 본인 entry 와 BBDX baseline comparison 에 사용)
  const localAccount = useLocalAccountSync(simUser?.id);
  const localEquity = useLocalEquitySync(simUser?.id);
  const closedPositions = useLocalPositionsSync(simUser?.id, "closed");

  const userStats = useMemo(
    () => computeSimulatorStats(closedPositions, INITIAL_CASH),
    [closedPositions],
  );

  // ── tRPC fetch — 30s auto-refresh ──────────────────────────
  // clientToken 제공 시 backend 가 본인 row 의 isYou 를 true 로 마킹.
  // refetchInterval: 30_000 = 다른 사용자 sync 결과를 30초마다 반영.
  // staleTime: 15_000 = 페이지 재방문 시 캐시 활용.
  const leaderboardQuery = trpc.simulatorLeaderboard.fetch.useQuery(
    {
      clientToken: simUser?.id,
      period,
      limit: 50,
    },
    {
      refetchInterval: 30_000,
      staleTime: 15_000,
      retry: 1,
    },
  );

  // ── Mock fallback 본인 entry 생성 ──────────────────────────
  // `DB_UNAVAILABLE` 응답 시 backend 가 비어있어 본인 stats 를 동적으로 끼워 넣음.
  const equity = localEquity.equity || (localAccount?.cash ?? INITIAL_CASH);
  const totalPnl = equity - INITIAL_CASH;
  const pnlPct = (totalPnl / INITIAL_CASH) * 100;
  const fallbackYouEntry: LeaderboardEntry | null = useMemo(() => {
    if (!simUser) return null;
    return {
      rank: 0,
      userId: simUser.id,
      displayName: simUser.nickname,
      initialCapital: INITIAL_CASH,
      currentCapital: equity,
      totalPnl,
      pnlPct,
      totalTrades: userStats.totalTrades,
      winRate: userStats.winRate,
      isYou: true,
    };
  }, [simUser, equity, totalPnl, pnlPct, userStats]);

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Back to simulator"
            onClick={() => setLocation("/simulator")}
            className="shrink-0"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
              <Trophy className="size-6 text-neon-yellow" />
              Leaderboard
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Investment Simulator — 전체 트레이더 랭킹
            </p>
          </div>
        </div>
        {simUser && (
          <Badge
            variant="outline"
            className="self-start border-neon-cyan/40 bg-neon-cyan/10 text-neon-cyan sm:self-auto"
          >
            <Sparkles className="mr-1 size-3" />
            {simUser.nickname}
          </Badge>
        )}
      </div>

      {/* Period Tabs */}
      <PeriodTabs current={period} onChange={setPeriod} />

      {/* Body — loading / error / mock fallback / live */}
      <LeaderboardBody
        isLoading={leaderboardQuery.isLoading}
        isError={leaderboardQuery.isError}
        data={leaderboardQuery.data}
        fallbackYouEntry={fallbackYouEntry}
        userStats={userStats}
        onRetry={() => leaderboardQuery.refetch()}
      />
    </div>
  );
}

// ─── Body Selector ─────────────────────────────────────────

type LeaderboardFetchResult =
  RouterOutputs["simulatorLeaderboard"]["fetch"];

function LeaderboardBody({
  isLoading,
  isError,
  data,
  fallbackYouEntry,
  userStats,
  onRetry,
}: {
  isLoading: boolean;
  isError: boolean;
  data: LeaderboardFetchResult | undefined;
  fallbackYouEntry: LeaderboardEntry | null;
  userStats: ReturnType<typeof computeSimulatorStats>;
  onRetry: () => void;
}) {
  if (isLoading) {
    return <LeaderboardSkeleton />;
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">
              네트워크 오류 — 랭킹을 불러올 수 없습니다
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              백엔드 연결을 확인하거나 잠시 후 다시 시도해주세요.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="mt-3"
              onClick={onRetry}
            >
              <RefreshCw className="mr-1 size-3.5" />
              재시도
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // data 가 없는 경우 (드물지만 방어적)
  if (!data) {
    return <LeaderboardSkeleton />;
  }

  // ── Live data 정상 응답 ───────────────────────────────────
  if (data.ok) {
    const adapted = adaptBackendLeaderboard(
      data.entries,
      data.yourRank,
      data.totalUsers,
    );
    const youEntry = adapted.entries.find((e) => e.isYou) ?? null;

    return (
      <>
        <YourRankCard
          youEntry={youEntry}
          rank={adapted.yourRank}
          total={adapted.totalUsers}
          topPct={
            adapted.yourRank != null && adapted.totalUsers > 0
              ? (adapted.yourRank / adapted.totalUsers) * 100
              : null
          }
          userStats={userStats}
        />
        <LeaderboardTable entries={adapted.entries} />
        <LeaderboardMobileList entries={adapted.entries} />
        <LiveDataNotice totalUsers={adapted.totalUsers} />
      </>
    );
  }

  // ── DB_UNAVAILABLE → mock fallback ────────────────────────
  if (data.code === "DB_UNAVAILABLE") {
    const mockAll = fallbackYouEntry
      ? [...MOCK_LEADERBOARD_ENTRIES, fallbackYouEntry]
      : [...MOCK_LEADERBOARD_ENTRIES];
    const ranked = rankLeaderboard(mockAll);
    const youRank = findYourRank(ranked);
    return (
      <>
        <DbUnavailableBanner />
        <YourRankCard
          youEntry={fallbackYouEntry}
          rank={youRank.rank}
          total={youRank.total}
          topPct={youRank.topPct}
          userStats={userStats}
        />
        <LeaderboardTable entries={ranked} />
        <LeaderboardMobileList entries={ranked} />
      </>
    );
  }

  // ── INTERNAL 등 ─────────────────────────────────────────
  return (
    <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">
            랭킹 조회 실패 — {data.code}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{data.message}</p>
          <Button
            size="sm"
            variant="outline"
            className="mt-3"
            onClick={onRetry}
          >
            <RefreshCw className="mr-1 size-3.5" />
            재시도
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Loading Skeleton ────────────────────────────────────

function LeaderboardSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-24 w-full rounded-lg" />
      <div className="hidden sm:block">
        <Skeleton className="h-[400px] w-full rounded-lg" />
      </div>
      <div className="flex flex-col gap-2 sm:hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

// ─── DB Unavailable Banner ───────────────────────────────

function DbUnavailableBanner() {
  return (
    <Alert className="border-neon-yellow/40 bg-neon-yellow/5">
      <Info className="size-4 text-neon-yellow" />
      <AlertTitle className="text-foreground">데모 랭킹 표시 중</AlertTitle>
      <AlertDescription>
        Backend DB Migration 미적용 — 현재 mock 트레이더 10명 + 본인 stats 로
        표시합니다. 관리자가 Supabase Migration 0008 을 적용하면 실시간 사용자
        데이터로 자동 전환됩니다.
      </AlertDescription>
    </Alert>
  );
}

// ─── Live Data Notice ────────────────────────────────────

function LiveDataNotice({ totalUsers }: { totalUsers: number }) {
  return (
    <div className="rounded-lg border border-border/40 bg-muted/30 p-4 text-xs text-muted-foreground">
      <div className="flex items-start gap-2">
        <Info className="mt-0.5 size-4 shrink-0 text-neon-cyan" />
        <div className="space-y-1">
          <p className="font-medium text-foreground">
            실시간 랭킹 — 전체 {totalUsers}명
          </p>
          <p>
            opt-in 한 사용자만 표시됩니다. 30초마다 자동 갱신. 식별자는 sha256
            hash 로 익명화되어 표시 — clientToken 은 절대 노출되지 않습니다.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Period Tabs ─────────────────────────────────────────

function PeriodTabs({
  current,
  onChange,
}: {
  current: LeaderboardPeriod;
  onChange: (p: LeaderboardPeriod) => void;
}) {
  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {LEADERBOARD_PERIODS.map((p) => {
        const active = current === p.value;
        return (
          <button
            key={p.value}
            type="button"
            disabled={!p.enabled}
            onClick={() => p.enabled && onChange(p.value)}
            className={cn(
              "shrink-0 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
              active && p.enabled
                ? "border-neon-cyan bg-neon-cyan/10 text-neon-cyan"
                : "border-border/40 text-muted-foreground",
              p.enabled
                ? "hover:border-neon-cyan/40 hover:text-foreground"
                : "cursor-not-allowed opacity-50",
            )}
            aria-pressed={active}
            title={p.enabled ? p.label : `${p.label} — 곧 활성화`}
          >
            {p.label}
            {!p.enabled && (
              <span className="ml-1 text-[10px] text-muted-foreground/70">
                (곧)
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Your Rank Card ──────────────────────────────────────

function YourRankCard({
  youEntry,
  rank,
  total,
  topPct,
  userStats,
}: {
  youEntry: LeaderboardEntry | null;
  rank: number | null;
  total: number;
  topPct: number | null;
  userStats: ReturnType<typeof computeSimulatorStats>;
}) {
  if (!youEntry) {
    return (
      <div className="rounded-lg border border-border/40 bg-card p-4">
        <div className="flex items-center gap-3">
          <Info className="size-5 shrink-0 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium text-foreground">
              아직 시뮬레이터에 등록되지 않았어요.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              본인 랭킹을 보려면 먼저 시뮬레이터에서 닉네임을 등록하고 거래를
              시작해 보세요.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const pnlPositive = youEntry.totalPnl >= 0;
  const canCompare = userStats.totalTrades >= MIN_TRADES_FOR_COMPARISON;
  const winRateDiffPp = canCompare
    ? userStats.winRate * 100 - BBDX_BASELINE.winRate * 100
    : null;

  return (
    <div className="rounded-lg border border-neon-cyan/40 bg-gradient-to-br from-neon-cyan/10 to-transparent p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Trophy className="size-4 text-neon-cyan" />
            <span className="text-xs font-bold tracking-[0.06em] text-neon-cyan">
              MY RANK
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold tabular-nums text-foreground">
              #{rank ?? "—"}
            </span>
            <span className="text-sm text-muted-foreground">/ {total}명</span>
            {topPct != null && (
              <span className="ml-2 text-xs text-muted-foreground">
                상위 {topPct.toFixed(0)}%
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <MetricCell
            label="Total PnL"
            value={formatSignedUSD(youEntry.totalPnl)}
            sub={formatPct(youEntry.pnlPct)}
            tone={pnlPositive ? "positive" : "negative"}
          />
          <MetricCell
            label="Trades"
            value={String(youEntry.totalTrades)}
            sub={
              youEntry.totalTrades > 0
                ? `Win ${formatWinRate(youEntry.winRate)}`
                : "—"
            }
            tone="default"
          />
          <MetricCell
            label="Equity"
            value={formatUSDCompact(youEntry.currentCapital)}
            sub={`from ${formatUSDCompact(youEntry.initialCapital)}`}
            tone="default"
            className="col-span-2 sm:col-span-1"
          />
        </div>
      </div>

      {/* BBDX baseline comparison hint */}
      {canCompare && winRateDiffPp != null ? (
        <div className="mt-4 flex items-center gap-2 border-t border-neon-cyan/20 pt-3 text-xs">
          {winRateDiffPp >= 0 ? (
            <TrendingUp className="size-4 text-neon-green" />
          ) : (
            <TrendingDown className="size-4 text-neon-red" />
          )}
          <span className="text-muted-foreground">
            BBDX 백테스트 승률 (
            <span className="font-mono text-foreground">
              {(BBDX_BASELINE.winRate * 100).toFixed(1)}%
            </span>
            ) 대비{" "}
            <span
              className={cn(
                "font-bold",
                winRateDiffPp >= 0 ? "text-neon-green" : "text-neon-red",
              )}
            >
              {winRateDiffPp >= 0 ? "+" : ""}
              {winRateDiffPp.toFixed(1)}%p
            </span>
          </span>
        </div>
      ) : (
        <div className="mt-4 flex items-center gap-2 border-t border-neon-cyan/20 pt-3 text-xs text-muted-foreground">
          <Info className="size-3.5" />
          <span>
            {MIN_TRADES_FOR_COMPARISON} 거래 이상 누적되면 BBDX 백테스트와
            비교가 표시됩니다.
          </span>
        </div>
      )}
    </div>
  );
}

function MetricCell({
  label,
  value,
  sub,
  tone,
  className,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: "default" | "positive" | "negative";
  className?: string;
}) {
  return (
    <div className={cn("rounded-md bg-card/60 px-3 py-2", className)}>
      <div className="text-[10px] font-bold tracking-[0.06em] text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "mt-0.5 text-base font-bold tabular-nums",
          tone === "positive" && "text-neon-green",
          tone === "negative" && "text-neon-red",
          tone === "default" && "text-foreground",
        )}
      >
        {value}
      </div>
      {sub && (
        <div
          className={cn(
            "text-[10px] font-medium",
            tone === "positive" && "text-neon-green/80",
            tone === "negative" && "text-neon-red/80",
            tone === "default" && "text-muted-foreground",
          )}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

// ─── Leaderboard Table (desktop) ─────────────────────────

function LeaderboardTable({ entries }: { entries: LeaderboardEntry[] }) {
  return (
    <div className="hidden overflow-hidden rounded-lg border border-border/40 bg-card sm:block">
      <table className="w-full text-sm">
        <thead className="bg-muted/40">
          <tr className="text-xs font-bold tracking-[0.04em] text-muted-foreground">
            <th className="px-4 py-3 text-left">Rank</th>
            <th className="px-4 py-3 text-left">Trader</th>
            <th className="px-4 py-3 text-right">Equity</th>
            <th className="px-4 py-3 text-right">PnL</th>
            <th className="px-4 py-3 text-right">%</th>
            <th className="px-4 py-3 text-right">Trades</th>
            <th className="px-4 py-3 text-right">Win Rate</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <LeaderboardRow key={e.userId} entry={e} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LeaderboardRow({ entry }: { entry: LeaderboardEntry }) {
  const positive = entry.totalPnl >= 0;
  return (
    <tr
      className={cn(
        "border-t border-border/30 transition-colors",
        entry.isYou
          ? "border-neon-cyan/40 bg-neon-cyan/10 hover:bg-neon-cyan/15"
          : "hover:bg-muted/30",
      )}
    >
      <td className="px-4 py-3">
        <span
          className={cn(
            "tabular-nums",
            rankBadgeClass(entry.rank),
            entry.isYou && "text-neon-cyan",
          )}
        >
          {entry.rank <= 3 ? (
            <span className="inline-flex items-center gap-1">
              {entry.rank === 1 && (
                <Trophy className="size-3.5 text-neon-yellow" />
              )}
              {entry.rank === 2 && (
                <Medal className="size-3.5 text-neon-cyan" />
              )}
              {entry.rank === 3 && (
                <Medal className="size-3.5 text-neon-pink" />
              )}
              {rankIcon(entry.rank)}
            </span>
          ) : (
            rankIcon(entry.rank)
          )}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "font-medium",
              entry.isYou ? "font-bold text-neon-cyan" : "text-foreground",
            )}
          >
            {entry.displayName}
          </span>
          {entry.isYou && (
            <Badge
              variant="outline"
              className="border-neon-cyan/60 bg-neon-cyan/10 text-[10px] text-neon-cyan"
            >
              YOU
            </Badge>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-foreground">
        {formatUSD(entry.currentCapital)}
      </td>
      <td
        className={cn(
          "px-4 py-3 text-right tabular-nums font-medium",
          positive ? "text-neon-green" : "text-neon-red",
        )}
      >
        {formatSignedUSD(entry.totalPnl)}
      </td>
      <td
        className={cn(
          "px-4 py-3 text-right tabular-nums font-bold",
          positive ? "text-neon-green" : "text-neon-red",
        )}
      >
        {formatPct(entry.pnlPct)}
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
        {entry.totalTrades}
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
        {entry.totalTrades > 0 ? formatWinRate(entry.winRate) : "—"}
      </td>
    </tr>
  );
}

// ─── Mobile List ────────────────────────────────────────

function LeaderboardMobileList({ entries }: { entries: LeaderboardEntry[] }) {
  return (
    <div className="flex flex-col gap-2 sm:hidden">
      {entries.map((e) => (
        <LeaderboardMobileCard key={e.userId} entry={e} />
      ))}
    </div>
  );
}

function LeaderboardMobileCard({ entry }: { entry: LeaderboardEntry }) {
  const positive = entry.totalPnl >= 0;
  return (
    <div
      className={cn(
        "rounded-lg border p-3 transition-colors",
        entry.isYou
          ? "border-neon-cyan/40 bg-neon-cyan/10"
          : "border-border/40 bg-card",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              "shrink-0 tabular-nums text-sm",
              rankBadgeClass(entry.rank),
              entry.isYou && "text-neon-cyan",
            )}
          >
            {entry.rank === 1 && (
              <Trophy className="mr-1 inline size-3.5 text-neon-yellow" />
            )}
            {entry.rank === 2 && (
              <Medal className="mr-1 inline size-3.5 text-neon-cyan" />
            )}
            {entry.rank === 3 && (
              <Medal className="mr-1 inline size-3.5 text-neon-pink" />
            )}
            {rankIcon(entry.rank)}
          </span>
          <span
            className={cn(
              "truncate text-sm font-medium",
              entry.isYou ? "font-bold text-neon-cyan" : "text-foreground",
            )}
          >
            {entry.displayName}
          </span>
          {entry.isYou && (
            <Badge
              variant="outline"
              className="shrink-0 border-neon-cyan/60 bg-neon-cyan/10 text-[10px] text-neon-cyan"
            >
              YOU
            </Badge>
          )}
        </div>
        <div
          className={cn(
            "shrink-0 text-right text-sm font-bold tabular-nums",
            positive ? "text-neon-green" : "text-neon-red",
          )}
        >
          {formatPct(entry.pnlPct)}
        </div>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2 text-[10px]">
        <div>
          <div className="text-muted-foreground">Equity</div>
          <div className="tabular-nums text-foreground">
            {formatUSDCompact(entry.currentCapital)}
          </div>
        </div>
        <div>
          <div className="text-muted-foreground">PnL</div>
          <div
            className={cn(
              "tabular-nums",
              positive ? "text-neon-green" : "text-neon-red",
            )}
          >
            {formatSignedUSD(entry.totalPnl)}
          </div>
        </div>
        <div>
          <div className="text-muted-foreground">Win</div>
          <div className="tabular-nums text-foreground">
            {entry.totalTrades > 0 ? formatWinRate(entry.winRate) : "—"}{" "}
            <span className="text-muted-foreground">({entry.totalTrades})</span>
          </div>
        </div>
      </div>
    </div>
  );
}
