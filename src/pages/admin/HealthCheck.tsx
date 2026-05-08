import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";

/**
 * /admin/health — 영구 시스템 헬스 체크 페이지.
 *
 * (구 V65MergeStatus 가 v6.5 머지 검증 페이지였으나, 영구 디버그 페이지로 승격됨.)
 *
 * 8개 검증 카드:
 *  1. /api/health           — 백엔드 부팅 + 브랜치 정보
 *  2. trpc.signals.scan     — BBDX 시그널 로직 작동
 *  3. trpc.onchain.score    — 7-modifier 작동
 *  4. trpc.backtest.list    — 백테스트 라우터 작동
 *  5. trpc.coin.meta        — CoinGecko Free 메타 (시총/거래량/도미넌스/SSR)
 *  6. trpc.events.list      — 코인 이벤트 캘린더
 *  7. trpc.winRate.rolling  — rolling 30/90/365d 승률 + Wilson CI
 *  8. trpc.lite.translateCoin — Lite 한국어 라벨 번역
 *
 * TODO: v6.5 머지 후 decideEntry / validateAgainstCharter 카드 추가 예정.
 */
export default function HealthCheck() {
  const [health, setHealth] = useState<
    | { status: "loading" }
    | { status: "ok"; branch: string; timestamp: number }
    | { status: "error"; detail: string }
  >({ status: "loading" });

  useEffect(() => {
    fetch("/api/health", { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((j) =>
        setHealth({
          status: "ok",
          branch: j.branch ?? "unknown",
          timestamp: j.timestamp ?? Date.now(),
        })
      )
      .catch((err) =>
        setHealth({
          status: "error",
          detail: err instanceof Error ? err.message : String(err),
        })
      );
  }, []);

  // ─── 기존 4개 카드 ──────────────────────────────────────────
  // BBDX 시그널 — 1 페이지만 호출하여 라우터/스캐너가 살아있는지 확인
  const signalsQuery = trpc.signals.scan.useQuery(
    { interval: "4h", page: 1, pageSize: 3 },
    { staleTime: 60_000, retry: 0 }
  );

  // 온체인
  const onchainQuery = trpc.onchain.score.useQuery(
    { symbol: "BTCUSDT" },
    { staleTime: 60_000, retry: 0 }
  );

  // 백테스트 라우터
  const backtestQuery = trpc.backtest.list.useQuery(undefined, {
    staleTime: 60_000,
    retry: 0,
  });

  // ─── 신규 4개 카드 (CoinDetail Workstation 라우트) ──────────
  const coinMetaQuery = trpc.coin.meta.useQuery(
    { symbol: "BTCUSDT" },
    { staleTime: 60_000, retry: 0 }
  );

  const eventsQuery = trpc.events.list.useQuery(
    { symbol: "BTCUSDT", days: 30 },
    { staleTime: 60_000, retry: 0 }
  );

  const winRateQuery = trpc.winRate.rolling.useQuery(
    { symbol: "BTCUSDT", tf: "4H", windows: [30, 90, 365] },
    { staleTime: 5 * 60_000, retry: 0 }
  );

  const liteQuery = trpc.lite.translateCoin.useQuery(
    { symbol: "BTCUSDT", tf: "4H" },
    { staleTime: 60_000, retry: 0 }
  );

  function previewJson(value: unknown, max = 100): string {
    try {
      const s = JSON.stringify(value);
      if (!s) return "(empty)";
      return s.length > max ? `${s.slice(0, max)}…` : s;
    } catch {
      return String(value);
    }
  }

  type Card = {
    title: string;
    source: string;
    ok: boolean;
    loading: boolean;
    summary: string;
  };

  const cards: Card[] = [
    {
      title: "1. /api/health",
      source: "Express health endpoint",
      ok: health.status === "ok",
      loading: health.status === "loading",
      summary:
        health.status === "ok"
          ? `branch=${health.branch}`
          : health.status === "error"
            ? health.detail
            : "checking…",
    },
    {
      title: "2. trpc.signals.scan",
      source:
        "BBDX 시그널 (decideEntry, detectAllCandlePatterns, detectBBStructure, isFallingKnife)",
      ok: signalsQuery.isSuccess,
      loading: signalsQuery.isLoading,
      summary: signalsQuery.isSuccess
        ? `${signalsQuery.data?.coins?.length ?? 0}개 코인 / 총 ${signalsQuery.data?.total ?? 0}`
        : (signalsQuery.error?.message ?? "loading…"),
    },
    {
      title: "3. trpc.onchain.score",
      source: "7-modifier (computeOnchainScore)",
      ok: onchainQuery.isSuccess,
      loading: onchainQuery.isLoading,
      summary: onchainQuery.isSuccess
        ? `regime=${onchainQuery.data?.regime}, score=${onchainQuery.data?.score?.toFixed(3) ?? "n/a"}`
        : (onchainQuery.error?.message ?? "loading…"),
    },
    {
      title: "4. trpc.backtest.list",
      source: "backtest router (runBacktest, getBacktestRuns)",
      ok: backtestQuery.isSuccess,
      loading: backtestQuery.isLoading,
      summary: backtestQuery.isSuccess
        ? `${backtestQuery.data?.length ?? 0}개 과거 run`
        : (backtestQuery.error?.message ?? "loading…"),
    },
    {
      title: "5. trpc.coin.meta (BTCUSDT)",
      source: "CoinGecko Free — mcap / volume / dominance / SSR",
      ok: coinMetaQuery.isSuccess,
      loading: coinMetaQuery.isLoading,
      summary: coinMetaQuery.isSuccess
        ? `status=${coinMetaQuery.data?.status} ${previewJson(coinMetaQuery.data, 80)}`
        : (coinMetaQuery.error?.message ?? "loading…"),
    },
    {
      title: "6. trpc.events.list (BTCUSDT, 30d)",
      source: "코인 이벤트 캘린더 (token unlock, mainnet upgrade 등)",
      ok: eventsQuery.isSuccess,
      loading: eventsQuery.isLoading,
      summary: eventsQuery.isSuccess
        ? `count=${eventsQuery.data?.count ?? 0}, horizon=${eventsQuery.data?.horizonDays ?? 0}d`
        : (eventsQuery.error?.message ?? "loading…"),
    },
    {
      title: "7. trpc.winRate.rolling (BTCUSDT, 4H)",
      source: "rolling 30/90/365d 승률 + Wilson 95% CI",
      ok: winRateQuery.isSuccess,
      loading: winRateQuery.isLoading,
      summary: winRateQuery.isSuccess
        ? `status=${winRateQuery.data?.status}, ${previewJson(winRateQuery.data?.windows, 80)}`
        : (winRateQuery.error?.message ?? "loading…"),
    },
    {
      title: "8. trpc.lite.translateCoin (BTCUSDT, 4H)",
      source: "Lite 한국어 라벨 번역 (Recommendation + Risk + Reasons)",
      ok: liteQuery.isSuccess,
      loading: liteQuery.isLoading,
      summary: liteQuery.isSuccess
        ? liteQuery.data
          ? `rec=${liteQuery.data.recommendation}, risk=${liteQuery.data.riskLevel}`
          : "null (no signal)"
        : (liteQuery.error?.message ?? "loading…"),
    },
  ];

  const allOk = cards.every((c) => c.ok);
  const anyError = cards.some((c) => !c.ok && !c.loading);

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-display font-bold text-neon-cyan mb-2">
          🩺 System Health
        </h1>
        <p className="text-sm font-mono text-muted-foreground">
          Admin / Internal — 백엔드 라우트 동작 확인용. v6.5 머지 후{" "}
          <code className="text-neon-pink">decideEntry</code> /{" "}
          <code className="text-neon-pink">validateAgainstCharter</code> 카드
          추가 예정.
        </p>
      </div>

      <div
        className={`p-4 rounded-sm border ${
          allOk
            ? "border-emerald-400/40 bg-emerald-500/5"
            : anyError
              ? "border-red-500/40 bg-red-500/5"
              : "border-neon-cyan/30 bg-neon-cyan/5"
        }`}
      >
        <p className="font-mono text-sm">
          {allOk ? (
            <span className="text-emerald-400">
              ✓ 시스템 정상 — 8개 영역 모두 응답
            </span>
          ) : anyError ? (
            <span className="text-red-400">
              ✗ 일부 영역 실패 — 아래 카드 확인
            </span>
          ) : (
            <span className="text-neon-cyan">⏳ 검증 중…</span>
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {cards.map((c) => (
          <div
            key={c.title}
            className={`p-4 rounded-sm border ${
              c.ok
                ? "border-emerald-400/40 bg-emerald-500/5"
                : c.loading
                  ? "border-neon-cyan/30 bg-neon-cyan/5"
                  : "border-red-500/40 bg-red-500/5"
            }`}
          >
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-display font-bold text-sm text-foreground">
                {c.title}
              </h3>
              <span
                className={`text-lg font-mono ${
                  c.ok
                    ? "text-emerald-400"
                    : c.loading
                      ? "text-neon-cyan"
                      : "text-red-400"
                }`}
              >
                {c.ok ? "✓" : c.loading ? "…" : "✗"}
              </span>
            </div>
            <p className="text-[10px] font-mono text-muted-foreground mb-2 leading-relaxed">
              {c.source}
            </p>
            <p className="text-xs font-mono text-foreground break-all">
              {c.summary}
            </p>
          </div>
        ))}
      </div>

      {/* TODO: v6.5 머지 후 charter.validate, decideEntry 카드 추가 */}

      <div className="text-[10px] font-mono text-muted-foreground border-t border-border/30 pt-3">
        영구 시스템 헬스 페이지 · 푸시 후 Vercel/Railway 부팅 검증, modifier 키
        설정 확인, tRPC 라우터 회귀 검증에 사용.
      </div>
    </div>
  );
}
