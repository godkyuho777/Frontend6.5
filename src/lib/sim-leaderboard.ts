/**
 * Investment Simulator — Leaderboard types + fallback mock (2026-05-21).
 *
 * INVESTMENT_SIMULATOR_AUDIT.md §5 (Leaderboard) Phase 2 — Backend wiring.
 *
 * 전략 (Phase 2 시점):
 *   - 메인 경로: `trpc.simulatorLeaderboard.fetch.useQuery` 가 실 데이터를 제공.
 *   - Fallback 경로: backend 응답이 `DB_UNAVAILABLE` / `INTERNAL` 일 때
 *     `MOCK_LEADERBOARD_ENTRIES` 10명 + 본인 동적 entry 로 표시 (graceful
 *     degradation — UI 가 깨지지 않음).
 *   - 본 모듈은 fallback path 에 필요한 helper (`rankLeaderboard`,
 *     `findYourRank`, `adaptBackendLeaderboard`) 와 mock entries 를 export.
 *
 * 정렬 기준:
 *   - 기본 정렬: `pnlPct` 내림차순 (수익률).  Cash equity 차이가 큰 경우에도
 *     공정한 비교가 가능.
 *   - Backend live 경로는 backend 가 동일 기준으로 정렬 후 rank 부여한 결과를
 *     그대로 표시 (재정렬 X).
 *   - Mock fallback 의 entries 는 의도적으로 다양한 pnlPct 분포 (음수 포함) 로
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
 * Period filter — Phase 2 backend 는 모든 period 입력을 받지만 현재 "all"
 * 만 실제 필터링이 적용됨 (snapshot join 미구현). UI 는 "all" 만 활성화하고
 * 나머지는 disabled tab 으로 표시 — 백엔드가 snapshot 필터를 구현하면
 * `enabled: true` 로 풀면 된다.
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

/**
 * Backend `LeaderboardEntryDto` 의 shape (수동 mirror — backend 가 미설치 환경에서도
 * TS check 가 깨지지 않도록).
 *
 * 실 backend 응답 (`simulatorLeaderboard.fetch`) 의 `entries[i]` 는 본 interface 와
 * 일치 — `id` 는 익명 hash (`anon_<8-hex>`), `nickname` 은 클라이언트 입력값,
 * `rank` 는 1-based, `isYou` 는 viewer 의 clientToken 과 일치할 때 true.
 */
export interface BackendLeaderboardEntry {
  id: string;
  nickname: string;
  currentCapital: number;
  initialCapital: number;
  totalPnl: number;
  pnlPct: number;
  totalTrades: number;
  winRate: number;
  rank: number;
  isYou: boolean;
}

/**
 * Backend response → frontend display 형식 변환.
 *
 * Backend 는 이미 정렬 + rank + isYou 처리한 응답을 반환하므로 본 함수는 단순한
 * shape adaptation 만 수행 (재정렬 / 재 ranking X). `userId` 는 backend 의
 * 익명 `id` 를 그대로 사용 — UI 에서 React key 로 안전.
 *
 * displayName 매핑은 우선순위:
 *   1. backend entry.nickname (저장된 닉네임)
 *   2. fallback "Trader_<id 앞4자>" (방어적 — backend 가 빈 nickname 반환 시)
 */
export function adaptBackendLeaderboard(
  backendEntries: BackendLeaderboardEntry[],
  yourRank: number | null,
  totalUsers: number,
): { entries: LeaderboardEntry[]; yourRank: number | null; totalUsers: number } {
  const entries: LeaderboardEntry[] = backendEntries.map((e) => ({
    rank: e.rank,
    userId: e.id,
    displayName:
      e.nickname && e.nickname.trim().length > 0
        ? e.nickname
        : `Trader_${e.id.slice(-4)}`,
    initialCapital: e.initialCapital,
    currentCapital: e.currentCapital,
    totalPnl: e.totalPnl,
    pnlPct: e.pnlPct,
    totalTrades: e.totalTrades,
    winRate: e.winRate,
    isYou: e.isYou,
  }));
  return { entries, yourRank, totalUsers };
}

// ── Opt-in 상태 LocalStorage helper ─────────────────────────
//
// Auto-sync hook (`useSimulatorLeaderboardSync`) 가 backend fetch 응답을 기다리지
// 않고 즉시 opt-in 여부를 알 수 있도록 클라이언트 측 캐시를 둔다.
//
// 정합성:
//   - opt-in mutation 성공 시 setLeaderboardOptedIn(true)
//   - opt-out mutation 성공 시 setLeaderboardOptedIn(false)
//   - backend fetch 의 entries 중 isYou=true 확인 시 자동 동기화 (페이지 refresh)
//   - mismatch 발생 (예: 다른 기기에서 opt-out) 시 다음 fetch 가 시정.

const LEADERBOARD_OPTIN_KEY = "tradelab.sim.leaderboard.optedIn";

/** 현재 LocalStorage 의 opt-in flag. `null` = unknown (SSR / 미초기화). */
export function readLeaderboardOptIn(): boolean | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LEADERBOARD_OPTIN_KEY);
    if (raw === "true") return true;
    if (raw === "false") return false;
    return null;
  } catch {
    return null;
  }
}

export function writeLeaderboardOptIn(optedIn: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      LEADERBOARD_OPTIN_KEY,
      optedIn ? "true" : "false",
    );
  } catch {
    // private mode — ignore
  }
}

export function clearLeaderboardOptIn(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(LEADERBOARD_OPTIN_KEY);
  } catch {
    // ignore
  }
}
