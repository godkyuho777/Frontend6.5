/**
 * Investment Simulator — Leaderboard mock data + types (2026-05-21).
 *
 * INVESTMENT_SIMULATOR_AUDIT.md §5 (Leaderboard) Phase 1 — Frontend-only
 * implementation.
 *
 * 전략:
 *   - Backend DB + tRPC route 는 별도 큰 PR (DB migration + 보안 + opt-in).
 *   - 본 모듈은 mock entries 10명 + 본인 simulator stats 를 동적 entry 로
 *     끼워 넣어 leaderboard UI 를 즉시 제공.
 *   - Backend 통합 시 동일 `LeaderboardEntry` interface 로 즉시 교체 가능
 *     (예: `trpc.simulator.leaderboard.useQuery` 결과를 같은 shape 로 매핑).
 *
 * 정렬 기준:
 *   - 기본 정렬: `pnlPct` 내림차순 (수익률).  Cash equity 차이가 큰 경우에도
 *     공정한 비교가 가능.
 *   - 본 mock 의 entries 는 의도적으로 다양한 pnlPct 분포 (음수 포함) 로
 *     본인 entry 가 어느 위치에 끼더라도 자연스럽게 보이도록 구성.
 */

/**
 * Leaderboard 한 행 (mock + 본인 모두 동일 shape).
 *
 * Backend 통합 시:
 *   - `userId` 는 익명화된 hash (예: `sha256(simUserId)[:8]`).
 *   - `displayName` 은 사용자 닉네임 또는 익명화 (예: "Trader_a3f2").
 *   - `isYou` 는 본인 row 식별용 — backend 에서는 viewer 의 simUserId 와
 *     비교해 1 row 만 true.
 */
export interface LeaderboardEntry {
  /** 정렬 후 1-based rank (combined list 에서 부여) */
  rank: number;
  /** mock UUID 또는 익명화된 식별자 */
  userId: string;
  /** 익명화된 표시명 (예: "Trader_a3f2") — 본인은 nickname 그대로 */
  displayName: string;
  /** 시작 자본 — 모든 시뮬레이터 사용자 $200,000 동일 */
  initialCapital: number;
  /** 현재 총자산 (cash + unrealized) */
  currentCapital: number;
  /** Total PnL (currentCapital - initialCapital) */
  totalPnl: number;
  /** Total PnL 비율 (%, 양수/음수 모두 가능). 예: 143.6 = +143.6%. */
  pnlPct: number;
  /** 전체 closed trades 수 */
  totalTrades: number;
  /** 0~1 범위의 승률. 예: 0.71 = 71%. */
  winRate: number;
  /** 본인 entry 표시 — UI highlight 용 */
  isYou?: boolean;
}

/**
 * Mock leaderboard 10명 — 의도적으로 다양한 분포로 구성.
 *
 *   - Top 3: 큰 양수 수익률 (143%, 98%, 67%)
 *   - 중위권: 적당한 양수 수익률 (15~45%)
 *   - 하위권: 음수 수익률 (손실 사용자 — 본인이 비교적 잘했을 때 위로가 되도록)
 *
 * 닉네임 패턴: `<Trader-type>_<hex4>` — 익명화 + 개성 표시.
 * userId 는 mock UUID v4 (실제 backend 에서는 hash 처리).
 *
 * Initial capital = $200,000 (모든 시뮬레이터 사용자 동일 = INITIAL_CASH).
 */
export const MOCK_LEADERBOARD_ENTRIES: LeaderboardEntry[] = [
  {
    rank: 0,
    userId: "mock-8a1f-cryptoking",
    displayName: "CryptoKing_8a1f",
    initialCapital: 200_000,
    currentCapital: 487_234,
    totalPnl: 287_234,
    pnlPct: 143.6,
    totalTrades: 89,
    winRate: 0.71,
  },
  {
    rank: 0,
    userId: "mock-7b2c-moonshot",
    displayName: "MoonShot_7b2c",
    initialCapital: 200_000,
    currentCapital: 397_400,
    totalPnl: 197_400,
    pnlPct: 98.7,
    totalTrades: 142,
    winRate: 0.63,
  },
  {
    rank: 0,
    userId: "mock-3d4e-whalebot",
    displayName: "WhaleBot_3d4e",
    initialCapital: 200_000,
    currentCapital: 335_600,
    totalPnl: 135_600,
    pnlPct: 67.8,
    totalTrades: 53,
    winRate: 0.68,
  },
  {
    rank: 0,
    userId: "mock-9f1a-prudenthodler",
    displayName: "PrudentHodler_9f1a",
    initialCapital: 200_000,
    currentCapital: 289_800,
    totalPnl: 89_800,
    pnlPct: 44.9,
    totalTrades: 27,
    winRate: 0.74,
  },
  {
    rank: 0,
    userId: "mock-2e5b-quantleo",
    displayName: "QuantLeo_2e5b",
    initialCapital: 200_000,
    currentCapital: 268_400,
    totalPnl: 68_400,
    pnlPct: 34.2,
    totalTrades: 178,
    winRate: 0.58,
  },
  {
    rank: 0,
    userId: "mock-6c7d-altchaser",
    displayName: "AltChaser_6c7d",
    initialCapital: 200_000,
    currentCapital: 245_200,
    totalPnl: 45_200,
    pnlPct: 22.6,
    totalTrades: 104,
    winRate: 0.51,
  },
  {
    rank: 0,
    userId: "mock-5a8b-scalpro",
    displayName: "ScalPro_5a8b",
    initialCapital: 200_000,
    currentCapital: 230_600,
    totalPnl: 30_600,
    pnlPct: 15.3,
    totalTrades: 312,
    winRate: 0.55,
  },
  {
    rank: 0,
    userId: "mock-4d9e-newbieflex",
    displayName: "NewbieFlex_4d9e",
    initialCapital: 200_000,
    currentCapital: 207_200,
    totalPnl: 7_200,
    pnlPct: 3.6,
    totalTrades: 18,
    winRate: 0.5,
  },
  {
    rank: 0,
    userId: "mock-1b3f-leveragefan",
    displayName: "LeverageFan_1b3f",
    initialCapital: 200_000,
    currentCapital: 178_400,
    totalPnl: -21_600,
    pnlPct: -10.8,
    totalTrades: 67,
    winRate: 0.42,
  },
  {
    rank: 0,
    userId: "mock-0f2c-fomotrader",
    displayName: "FomoTrader_0f2c",
    initialCapital: 200_000,
    currentCapital: 139_800,
    totalPnl: -60_200,
    pnlPct: -30.1,
    totalTrades: 95,
    winRate: 0.31,
  },
];

/**
 * Leaderboard 정렬 + rank 재계산.
 *
 * @param entries  mock + 본인 entry 가 섞인 raw list
 * @returns pnlPct 내림차순으로 정렬되고 rank 가 1..N 으로 재부여된 list
 */
export function rankLeaderboard(
  entries: LeaderboardEntry[],
): LeaderboardEntry[] {
  const sorted = [...entries].sort((a, b) => b.pnlPct - a.pnlPct);
  return sorted.map((e, i) => ({ ...e, rank: i + 1 }));
}

/**
 * 본인 rank + 상위 % 산출 helper.
 *
 *   - rank: 1-based 본인 순위.  본인이 없으면 null.
 *   - total: 전체 entries 수.
 *   - topPct: 상위 % (1 ~ 100, 작을수록 좋음).  예: rank 5/11 → 45.5%.
 */
export function findYourRank(
  ranked: LeaderboardEntry[],
): { rank: number | null; total: number; topPct: number | null } {
  const total = ranked.length;
  const youIdx = ranked.findIndex((e) => e.isYou);
  if (youIdx < 0) {
    return { rank: null, total, topPct: null };
  }
  const rank = youIdx + 1;
  const topPct = total > 0 ? (rank / total) * 100 : null;
  return { rank, total, topPct };
}

/**
 * Period filter — 본 frontend-only 구현은 "all" 만 활성.
 *
 *   - all: 전체 기간 (현재 mock + 본인 stats)
 *   - 30d / 7d / 24h: backend 통합 후 활성화 — 본 UI 는 disabled tab 으로 표시
 */
export type LeaderboardPeriod = "all" | "30d" | "7d" | "24h";

export const LEADERBOARD_PERIODS: Array<{
  value: LeaderboardPeriod;
  label: string;
  enabled: boolean;
}> = [
  { value: "all", label: "All-time", enabled: true },
  { value: "30d", label: "30일", enabled: false },
  { value: "7d", label: "7일", enabled: false },
  { value: "24h", label: "24시간", enabled: false },
];
