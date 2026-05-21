/**
 * useSimLocalStore — React 18 useSyncExternalStore hooks for the
 * local-mode simulator store (2026-05-17).
 *
 * 기존 `localRev / bumpLocal()` 패턴은 ticker 갱신과 mutation 사이의 race
 * condition 으로 인해 Position 카드 깜빡거림을 유발했다. 대신 모든 mutation
 * 이 `emitSimChange()` 를 호출하고, 본 hook 들이 동기적으로 새 snapshot 을
 * 읽어 강제 re-render 한다.
 *
 * 핵심:
 *   - `subscribeSimChange(listener)` 로 같은 탭 emit + 다른 탭 storage
 *     이벤트를 모두 수신.
 *   - getter 들은 storage raw JSON 문자열을 캐시 key 로 referential
 *     stability 를 보장 (snapshot 비교 시 false 항상 발생 → 무한 루프 방지).
 *   - userId 가 null/undefined 면 빈 결과를 반환 — onboarding flow 시 안전.
 */

import { useSyncExternalStore } from "react";
import {
  subscribeSimChange,
  getLocalAccount,
  getLocalPositions,
  getLocalTransactions,
  getLocalOrders,
  computeLocalEquity,
  type LocalSimAccount,
  type LocalSimPosition,
  type LocalSimTransaction,
  type SimOrder,
} from "@/lib/sim-local-store";

// ─── Stable empty references ───────────────────────────────
// userId 가 없을 때 매번 새 [] 를 반환하지 않도록 frozen empty 사용.

const EMPTY_POSITIONS: readonly LocalSimPosition[] = Object.freeze([]);
const EMPTY_TXS: readonly LocalSimTransaction[] = Object.freeze([]);
const EMPTY_ORDERS: readonly SimOrder[] = Object.freeze([]);
const EMPTY_EQUITY = Object.freeze({
  unrealizedPnl: 0,
  equity: 0,
  openCount: 0,
});

// ─── Hooks ─────────────────────────────────────────────────

/**
 * Local-mode account snapshot. Null when no userId.
 *
 * 백엔드 활성/비활성 무관하게 동기적으로 localStorage 의 값을 반환한다.
 * 호출 자체는 비활성 모드에서도 안전 (별도 비용 거의 없음 — 단순 read).
 */
export function useLocalAccountSync(
  userId: string | null | undefined,
): LocalSimAccount | null {
  return useSyncExternalStore(
    subscribeSimChange,
    () => (userId ? getLocalAccount(userId) : null),
    () => null,
  );
}

/**
 * Open / closed / all positions.
 *
 * `filter`:
 *   - "open": status === "open" 만
 *   - "closed": status !== "open" 만 (closed + liquidated 포함)
 *   - "all": 전부
 *
 * 🚨 React #185 fix (2026-05-19): 본 hook 의 getSnapshot 은 반드시 stable
 * reference 를 반환해야 한다 (useSyncExternalStore 가 동일 render 내에서
 * 여러 번 호출하며 Object.is 비교로 안정성 검증).
 *
 * 과거: `filter === "closed"` 에서 `all.filter(...)` 를 매 호출마다 새
 * Array 로 만들어 → unstable snapshot → React 가 무한 loop 감지 → 프로덕션
 * minified build 에서 #185 (Maximum update depth) 발생.
 *
 * 수정: filter 가 "all" 이 아니면 결과 array 의 (id, status, currentPrice)
 * tuple 을 key 로 캐싱. 같은 raw 데이터에 대해 같은 array 를 반환.
 *
 * 🚨 깜빡거림 fix (2026-05-22 추가):
 *   "open" 분기는 `getLocalPositions` 의 raw-JSON 캐시에 의존했지만, mark-to-market
 *   이 currentPrice 만 변경해도 raw JSON 이 달라져 캐시 miss → 새 array reference.
 *   따라서 ticker tick 마다 PositionsTable 이 새 positions prop 을 받아 전체
 *   PositionRow 가 React.memo 비교를 거치게 됨. 추가로 (mode flip 등) 일시적으로
 *   length 가 0 으로 보이는 race 가 있을 경우 카드가 "사라졌다 떴다" 깜빡임.
 *
 *   본 fix: open 분기도 별도 signature 기반 캐시 적용. 단, signature 는 id + status
 *   + entryPrice + liqPrice + margin + currentPrice 까지 포함해 PositionRow 의 표시
 *   필드가 변하면 새 array, 그 외 (단순 메타데이터) 변경에는 같은 reference 유지.
 *   currentPrice 가 정말 변했을 때는 새 reference 가 필요 — PositionRow 의 PnL 셀이
 *   재계산되어야 하므로.
 */
const _filteredPositionsCache = new Map<
  string,
  { signature: string; result: LocalSimPosition[] }
>();

function buildPositionSignature(positions: LocalSimPosition[]): string {
  // 가격 / 상태 / 청산가 변화를 모두 포착하는 fingerprint.
  // currentPrice 도 포함 — 진짜 가격이 변하면 새 array reference 가 필요 (PnL 재계산).
  return positions
    .map(
      (p) =>
        `${p.id}:${p.status}:${p.entryPrice}:${p.liqPrice ?? 0}:${p.margin}:${p.currentPrice ?? 0}:${p.closedPnl ?? 0}`,
    )
    .join("|");
}

export function useLocalPositionsSync(
  userId: string | null | undefined,
  filter: "open" | "closed" | "all" = "open",
): LocalSimPosition[] {
  return useSyncExternalStore(
    subscribeSimChange,
    () => {
      if (!userId) return EMPTY_POSITIONS as LocalSimPosition[];
      if (filter === "all") {
        // "all" 은 getLocalPositions 의 raw-key 캐시에 위임 (변경 시점 동일).
        return getLocalPositions(userId, { includeClosed: true, limit: 200 });
      }

      // "open" 또는 "closed" — signature 기반 캐시로 같은 의미값이면 같은 reference 보장.
      // 같은 가격이 반복 fetch 되어도 signature 동일 → PositionsTable 이 같은 array 를
      // 받아 .length === 0 검사 등의 race 가 사라지고 row memo 도 정확하게 hit.
      const source =
        filter === "open"
          ? getLocalPositions(userId, { includeClosed: false })
          : getLocalPositions(userId, { includeClosed: true, limit: 200 });
      const cacheKey = `${userId}|${filter}`;
      const signature = buildPositionSignature(source);
      const cached = _filteredPositionsCache.get(cacheKey);
      if (cached && cached.signature === signature) {
        return cached.result;
      }
      const filtered =
        filter === "open" ? source : source.filter((p) => p.status !== "open");
      _filteredPositionsCache.set(cacheKey, { signature, result: filtered });
      return filtered;
    },
    () => EMPTY_POSITIONS as LocalSimPosition[],
  );
}

/**
 * Transactions (최신순, limit 적용 후).
 */
export function useLocalTransactionsSync(
  userId: string | null | undefined,
  limit = 100,
): LocalSimTransaction[] {
  return useSyncExternalStore(
    subscribeSimChange,
    () =>
      userId
        ? getLocalTransactions(userId, limit)
        : (EMPTY_TXS as LocalSimTransaction[]),
    () => EMPTY_TXS as LocalSimTransaction[],
  );
}

/**
 * Orders.  filter 미지정 시 전체 (pending + filled + cancelled).
 */
export function useLocalOrdersSync(
  userId: string | null | undefined,
  filter?: "pending" | "filled" | "cancelled",
): SimOrder[] {
  return useSyncExternalStore(
    subscribeSimChange,
    () =>
      userId ? getLocalOrders(userId, filter) : (EMPTY_ORDERS as SimOrder[]),
    () => EMPTY_ORDERS as SimOrder[],
  );
}

/**
 * Equity / unrealizedPnl / openCount — account + open positions 결합.
 *
 * 캐시 key 가 cash + (id, currentPrice) 조합이므로 mark-to-market 이 가격을
 * 갱신할 때마다 자연스럽게 새 snapshot 을 반환한다.
 */
export function useLocalEquitySync(
  userId: string | null | undefined,
): { unrealizedPnl: number; equity: number; openCount: number } {
  return useSyncExternalStore(
    subscribeSimChange,
    () =>
      userId
        ? computeLocalEquity(userId)
        : (EMPTY_EQUITY as {
            unrealizedPnl: number;
            equity: number;
            openCount: number;
          }),
    () =>
      EMPTY_EQUITY as {
        unrealizedPnl: number;
        equity: number;
        openCount: number;
      },
  );
}
