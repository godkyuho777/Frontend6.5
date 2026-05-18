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
 */
const _filteredPositionsCache = new Map<
  string,
  { signature: string; result: LocalSimPosition[] }
>();

function buildPositionSignature(positions: LocalSimPosition[]): string {
  // 가격 / 상태 / 청산가 변화를 모두 포착하는 fingerprint.
  return positions
    .map(
      (p) =>
        `${p.id}:${p.status}:${p.currentPrice ?? 0}:${p.closedPnl ?? 0}`,
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
      if (filter === "open") {
        // getLocalPositions 자체가 캐시된 stable reference 반환.
        return getLocalPositions(userId, { includeClosed: false });
      }
      const all = getLocalPositions(userId, { includeClosed: true, limit: 200 });
      if (filter === "all") return all;

      // "closed" 분기 — .filter() 가 매번 새 array 를 만들어 #185 유발.
      // (userId|filter) 별로 signature 비교 캐시.
      const cacheKey = `${userId}|${filter}`;
      const signature = buildPositionSignature(all);
      const cached = _filteredPositionsCache.get(cacheKey);
      if (cached && cached.signature === signature) {
        return cached.result;
      }
      const filtered = all.filter((p) => p.status !== "open");
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
