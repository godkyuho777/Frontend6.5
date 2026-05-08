import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";

/**
 * /admin/health — 영구 시스템 헬스 체크 페이지.
 *
 * (구 V65MergeStatus 가 v6.5 머지 검증 페이지였으나, 영구 디버그 페이지로 승격됨.)
 *
 * 4개 검증 카드:
 *  1. /api/health — 백엔드 부팅 + 브랜치 정보
 *  2. trpc.signals.scan — BBDX 시그널 로직 작동
 *  3. trpc.onchain.score — 7-modifier 작동
 *  4. trpc.backtest.list — 백테스트 라우터 작동
 *
 * TODO: add charter.validate, decideEntry cards when v6.5 merges
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

  const cards = [
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
      source: "BBDX 시그널 (decideEntry, detectAllCandlePatterns, detectBBStructure, isFallingKnife)",
      ok: signalsQuery.isSuccess,
      loading: signalsQuery.isLoading,
      summary: signalsQuery.isSuccess
        ? `${signalsQuery.data?.coins?.length ?? 0}개 코인 / 총 ${signalsQuery.data?.total ?? 0}`
        : signalsQuery.error?.message ?? "loading…",
    },
    {
      title: "3. trpc.onchain.score",
      source: "7-modifier (computeOnchainScore)",
      ok: onchainQuery.isSuccess,
      loading: onchainQuery.isLoading,
      summary: onchainQuery.isSuccess
        ? `regime=${onchainQuery.data?.regime}, score=${onchainQuery.data?.score?.toFixed(3) ?? "n/a"}`
        : onchainQuery.error?.message ?? "loading…",
    },
    {
      title: "4. trpc.backtest.list",
      source: "backtest router (runBacktest, getBacktestRuns)",
      ok: backtestQuery.isSuccess,
      loading: backtestQuery.isLoading,
      summary: backtestQuery.isSuccess
        ? `${backtestQuery.data?.length ?? 0}개 과거 run`
        : backtestQuery.error?.message ?? "loading…",
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
          백엔드 + tRPC 라우터 4개 영역의 헬스 체크. 배포/디버깅 시 가장 먼저
          확인할 페이지입니다.
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
            <span className="text-emerald-400">✓ 시스템 정상 — 4개 영역 모두 응답</span>
          ) : anyError ? (
            <span className="text-red-400">✗ 일부 영역 실패 — 아래 카드 확인</span>
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
            <p className="text-xs font-mono text-foreground break-all">{c.summary}</p>
          </div>
        ))}
      </div>

      {/* TODO: add charter.validate, decideEntry cards when v6.5 merges */}

      <div className="text-[10px] font-mono text-muted-foreground border-t border-border/30 pt-3">
        영구 시스템 헬스 페이지 · 푸시 후 Vercel/Railway 부팅 검증, modifier
        키 설정 확인, tRPC 라우터 회귀 검증에 사용.
      </div>
    </div>
  );
}
