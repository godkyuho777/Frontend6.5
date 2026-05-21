/**
 * Investment Simulator — Leaderboard auto-sync hook (2026-05-21).
 *
 * INVESTMENT_SIMULATOR_AUDIT.md §5 Phase 2 — Backend wiring.
 *
 * 책임:
 *   - opt-in 한 사용자의 stats (cash, PnL, win rate, drawdown) 를 backend 에
 *     5분에 1회 자동 sync (`trpc.simulatorLeaderboard.sync`).
 *   - opt-in 안 됐거나 simUser 없으면 noop.
 *   - localStorage `tradelab.sim.leaderboard.optedIn` flag 로 즉시 판별 +
 *     `RATE_LIMITED` / `USER_NOT_FOUND` / `OPTED_OUT` 응답 처리.
 *
 * 호출 위치:
 *   - `Simulator.tsx` 의 메인 trading 화면 (사용자가 거래할 때마다 stats 변동).
 *   - Leaderboard 페이지에서 opt-in 직후 즉시 sync (`useLastSyncedAt` 갱신용).
 *
 * 정책:
 *   - SYNC_INTERVAL = 5분 (backend `SYNC_RATE_LIMIT_MS` 와 일치).
 *   - 같은 input 으로 중복 호출 방지 — lastSyncRef 로 throttle.
 *   - 에러는 silent (toast 미출력) — UX 노이즈 최소화. console.warn 만.
 *   - Stats 가 거의 안 변해도 5분마다 sync — backend snapshot 시계열 유지.
 */
import { useCallback, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { readLeaderboardOptIn, writeLeaderboardOptIn } from "@/lib/sim-leaderboard";
import type { SimulatorStats } from "@/lib/sim-pnl";

/** 5분 — backend rate limit 과 동일 */
export const SYNC_INTERVAL_MS = 5 * 60 * 1000;

export interface SimulatorLeaderboardSyncInput {
  /** 시뮬레이터 사용자 UUID (= backend clientToken). null 이면 sync skip. */
  simUserId: string | null | undefined;
  /** 현재 equity (cash + unrealized). null 이면 sync skip. */
  equity: number | null | undefined;
  /** Realized + unrealized 합산 PnL. */
  totalPnl: number;
  /** totalPnl / INITIAL_CASH × 100. */
  pnlPct: number;
  /** Closed-trade 집계. null 이면 sync skip (집계 미완료). */
  stats: SimulatorStats | null | undefined;
}

export interface SimulatorLeaderboardSyncResult {
  /** 즉시 sync 호출 (수동 trigger). opt-in 검증은 hook 내부에서. */
  syncNow: () => void;
  /** 마지막 sync 시각 (ms). 0 = 한 번도 안 함. */
  lastSyncedAt: number;
  /** 마지막 sync 가 성공했는지 (false = 에러 또는 미호출). */
  lastSyncOk: boolean;
}

/**
 * Auto-sync simulator stats to leaderboard backend.
 *
 * @param input  stats + simUserId + equity. 변경 시마다 5분 throttle 적용 후 sync.
 * @returns syncNow / lastSyncedAt — 외부 (e.g. opt-in 직후) 에서 강제 sync 가능.
 */
export function useSimulatorLeaderboardSync(
  input: SimulatorLeaderboardSyncInput,
): SimulatorLeaderboardSyncResult {
  const { simUserId, equity, totalPnl, pnlPct, stats } = input;
  const lastSyncRef = useRef(0);
  const lastSyncOkRef = useRef(false);
  const syncMutation = trpc.simulatorLeaderboard.sync.useMutation();

  // 🚨 깜빡거림 fix (2026-05-22):
  //   기존 `performSync` 의 useCallback deps 가 `[simUserId, equity, totalPnl,
  //   pnlPct, stats, syncMutation]` 였음. ticker tick 마다 equity 가 primitive
  //   number 로 변경되므로 performSync reference 가 매번 새로 만들어졌고, 그를
  //   dep 으로 두는 useEffect 가 clearInterval + setInterval 을 반복 호출 →
  //   사이드 이펙트 누적 + React 의 timer 정리 오버헤드 + 다른 effect chain 의
  //   timing 을 흩뜨림.
  //
  //   Fix: input 전체를 ref 로 저장하고 performSync 는 deps 비어있는 stable
  //   reference 로 유지. ref 갱신은 매 render 마다 (mutation X) — 동기적이고
  //   안전. mutation 시점에서 ref.current 의 최신 값을 읽어 sync.
  const inputRef = useRef(input);
  inputRef.current = input;

  /** 핵심 sync 함수 — opt-in 체크 + rate-limit + mutation. Stable reference. */
  const performSync = useCallback(
    (force: boolean) => {
      const {
        simUserId: uid,
        equity: eq,
        totalPnl: tp,
        pnlPct: pp,
        stats: st,
      } = inputRef.current;
      if (!uid) return;
      if (eq == null || st == null) return;

      // opt-in 안 됐으면 skip (localStorage 즉시 판별)
      const optedIn = readLeaderboardOptIn();
      if (optedIn !== true) return;

      // Rate-limit (force=true 면 무시 — opt-in 직후 호출 등)
      const now = Date.now();
      if (!force && now - lastSyncRef.current < SYNC_INTERVAL_MS) return;

      // pnlPct 가 NaN / Infinity 면 backend 거부 — 방어적 clamp
      const safePnlPct = Number.isFinite(pp) ? pp : 0;
      const safeMaxDdPct = Number.isFinite(st.maxDrawdownPct)
        ? st.maxDrawdownPct * 100
        : 0;

      lastSyncRef.current = now;
      syncMutation.mutate(
        {
          clientToken: uid,
          currentCapital: eq,
          totalPnl: tp,
          pnlPct: safePnlPct,
          totalTrades: st.totalTrades,
          wins: st.wins,
          losses: st.losses,
          winRate: st.winRate,
          maxDrawdownPct: safeMaxDdPct,
        },
        {
          onSuccess: (res) => {
            if (res.ok) {
              lastSyncOkRef.current = true;
              return;
            }
            lastSyncOkRef.current = false;
            // 정상적인 비즈니스 에러 (rate-limit, opt-out, user-not-found):
            //   - RATE_LIMITED: 정상 — 다음 5분 후 자동 재시도.
            //   - OPTED_OUT: 로컬 flag 가 stale. 정정.
            //   - USER_NOT_FOUND: 다른 기기에서 opt-out 후 본인 row 삭제.
            if (res.code === "OPTED_OUT" || res.code === "USER_NOT_FOUND") {
              writeLeaderboardOptIn(false);
            }
            if (res.code !== "RATE_LIMITED") {
              console.warn(
                `[Leaderboard sync] ${res.code}: ${res.message}`,
              );
            }
          },
          onError: (err) => {
            lastSyncOkRef.current = false;
            console.warn("[Leaderboard sync] network error:", err.message);
          },
        },
      );
    },
    // syncMutation reference 는 tRPC 가 안정 보장 (React Query 의 mutation cache).
    // inputRef 는 ref 라 deps 에 안 들어감 — performSync 는 마운트 후 stable reference.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  /**
   * Auto-sync trigger.
   *   - 마운트 직후 (opt-in 사용자만): 즉시 1회 sync
   *   - 그 후: 5분 throttle 로 자동 재 sync (stats 변경 시마다 evaluate)
   *
   * stats 가 변하지 않아도 5분 단위로 sync 가 발화하도록 interval 도 함께 설치.
   *
   * 🚨 deps 비어있어 마운트 1회만 install. unmount 시 clearInterval. performSync
   * 는 stable reference 라 stale closure 위험 X — 내부에서 ref.current 로 최신 input 사용.
   */
  useEffect(() => {
    performSync(false);
    const id = window.setInterval(() => {
      performSync(false);
    }, SYNC_INTERVAL_MS);
    return () => {
      window.clearInterval(id);
    };
    // performSync 는 stable reference (deps 비어있음). 1회 install 후 unmount 시 정리.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const syncNow = useCallback(() => {
    performSync(true);
  }, [performSync]);

  return {
    syncNow,
    lastSyncedAt: lastSyncRef.current,
    lastSyncOk: lastSyncOkRef.current,
  };
}
