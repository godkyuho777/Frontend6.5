/**
 * Investment Simulator — localStorage-based fallback store (2026-05-16).
 *
 * 백엔드 DB 가 비활성 (Supabase 미설정 / Railway 배포 미완료) 상태에서도
 * 사용자가 모의투자를 시도해볼 수 있도록 클라이언트 사이드에 account /
 * positions / transactions 를 영속화한다.
 *
 * 동작 모드:
 *   - 백엔드 응답이 `available: false` 거나 query 가 에러일 때 자동 활성화
 *   - 모든 mutation 은 즉시 localStorage 에 반영 + UI 갱신
 *   - 백엔드가 다시 살아나면 (`available: true`) 백엔드 데이터를 우선 사용
 *
 * 헌장: 시뮬레이터는 실제 자본 영향 X. 본 store 도 실제 거래소가 아니므로
 * 헌장 R4 (자본 보호) 와 무관.
 *
 * Race condition 완전 해결 (2026-05-17, useSyncExternalStore 패턴):
 *   - 모든 mutation 후 emitSimChange() 호출 → 구독자 동기 호출.
 *   - getter 는 storage key (=원시 JSON 문자열) 기반 캐시로 referential
 *     stability 보장 (snapshot 비교 false-positive 방지).
 *   - subscribeSimChange 는 같은 탭의 emitter + 다른 탭의 storage 이벤트
 *     양쪽 모두 수신.
 *
 * PnL 정확화 (2026-05-19, AUDIT.md §1.4):
 *   - `computeUnrealizedPnL` / `computeCashReturned` 등을 `sim-pnl.ts` 로 분리.
 *   - PnL 공식에서 잘못된 `× leverage` 제거 (Bybit Perp 표준 일치).
 *   - Close 시 cash 환원에 `Math.max(0, ...)` clamp 적용 (음수 차단).
 */

import {
  computeUnrealizedPnL,
  computeCashReturned,
  computeNetPnL,
} from "./sim-pnl";

const INITIAL_CASH = 200_000;
const COMMISSION_RATE = 0.0001; // 0.01%
const DEFAULT_MAINTENANCE_MARGIN_RATE = 0.005; // 0.5% (Bybit isolated 기본)

function storageKey(
  simUserId: string,
  kind: "account" | "positions" | "transactions" | "orders",
) {
  return `tradelab.sim.${kind}.${simUserId}`;
}

// ─── Types ─────────────────────────────────────────────────

export interface LocalSimAccount {
  cash: number;
  realizedPnl: number;
  totalCommission: number;
  totalFunding: number;
  liquidationCount: number;
  available: false; // 항상 false (백엔드 비활성 상태 표시용)
}

export interface LocalSimPosition {
  id: number;
  userId: string;
  symbol: string;
  productType: "spot" | "perp";
  side: "long" | "short";
  leverage: number;
  entryPrice: number;
  quantity: number;
  margin: number;
  currentPrice: number | null;
  liquidationPrice: number | null;
  /** Maintenance margin rate 가 적용된 청산가 (생성 시 자동 계산). */
  liqPrice: number;
  /** 사용된 maintenance margin rate (기록용). */
  maintenanceMarginRate: number;
  accruedFunding: number;
  accruedCommission: number;
  status: "open" | "closed" | "liquidated";
  openedAt: string;
  closedAt: string | null;
  closedPnl: number | null;
  closedPrice: number | null;
  closedReason: string | null;
  /** 강제청산 timestamp (closedReason === "liquidation" 일 때만). */
  liquidatedAt?: number;
}

export interface LocalSimTransaction {
  id: number;
  userId: string;
  positionId: number | null;
  type: "open" | "close" | "funding" | "commission" | "deposit" | "liquidation";
  symbol: string | null;
  amount: number;
  price: number | null;
  note: string | null;
  ts: string;
}

/**
 * Pending / filled / cancelled limit orders (로컬 모드 전용).
 *
 * Market 주문은 즉시 position 으로 변환되므로 SimOrder 로 저장되지 않는다.
 * Limit 주문만 SimOrder.status = "pending" 으로 보관 후, ticker 갱신 시
 * Simulator 의 useEffect 가 트리거 조건 (mark price ↔ limitPrice) 을
 * 검사해 자동 체결 또는 사용자 취소로 종결.
 */
export interface SimOrder {
  id: string;
  userId: string;
  symbol: string;
  productType: "spot" | "perp";
  side: "long" | "short";
  type: "market" | "limit";
  qty: number;
  /** Required when type === "limit" */
  limitPrice?: number;
  leverage: number;
  marginMode: "cross" | "isolated";
  status: "pending" | "filled" | "cancelled";
  createdAt: number;
  filledAt?: number;
  filledPrice?: number;
  cancelledAt?: number;
}

// ─── Liquidation math ──────────────────────────────────────

/**
 * Bybit isolated margin 스타일 청산가 계산.
 *
 * LONG: 가격 하락 시 청산.  liq = entry × (1 - 1/lev + MMR)
 * SHORT: 가격 상승 시 청산. liq = entry × (1 + 1/lev - MMR)
 *
 * 예시 (entry $78,137, MMR 0.5%):
 *   - LONG 10x:  liq = 78137 × 0.905 = $70,714  (-9.5%)
 *   - SHORT 10x: liq = 78137 × 1.095 = $85,560  (+9.5%)
 *   - LONG 1x:   liq = 78137 × 0.005 ≈ $391    (사실상 청산 없음)
 */
export function calcLiquidationPrice(
  side: "long" | "short",
  entryPrice: number,
  leverage: number,
  maintenanceMarginRate: number = DEFAULT_MAINTENANCE_MARGIN_RATE,
): number {
  const lev = Math.max(1, leverage);
  if (side === "long") {
    return entryPrice * (1 - 1 / lev + maintenanceMarginRate);
  }
  return entryPrice * (1 + 1 / lev - maintenanceMarginRate);
}

export { DEFAULT_MAINTENANCE_MARGIN_RATE };

// ─── Storage helpers ───────────────────────────────────────

function loadJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveJson(key: string, data: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // private mode / quota — ignore
  }
}

// ─── Pub/Sub for cross-component sync ──────────────────────

type SimChangeListener = () => void;
const simListeners = new Set<SimChangeListener>();

/**
 * Subscribe to local-store mutations.
 *
 * 호출자는 같은 탭의 mutation (emitSimChange) 과 다른 탭의 localStorage
 * 이벤트 양쪽을 모두 수신한다. useSyncExternalStore 가 정확히 요구하는
 * subscribe signature.
 */
export function subscribeSimChange(listener: SimChangeListener): () => void {
  simListeners.add(listener);

  const storageHandler = (e: StorageEvent) => {
    if (!e.key) return;
    if (e.key.startsWith("tradelab.sim.")) {
      // 다른 탭의 변경 → 캐시 무효화 후 listener 호출
      invalidateAllCaches();
      listener();
    }
  };
  if (typeof window !== "undefined") {
    window.addEventListener("storage", storageHandler);
  }

  return () => {
    simListeners.delete(listener);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", storageHandler);
    }
  };
}

function emitSimChange(): void {
  // 모든 mutation 후 캐시를 무효화하고 구독자에게 알림.
  invalidateAllCaches();
  for (const l of simListeners) l();
}

// ─── Snapshot caches (referential stability) ───────────────
//
// useSyncExternalStore 의 snapshot 함수는 매번 새 array/object 를 반환하면
// 무한 re-render 를 유발한다. localStorage 의 raw JSON 문자열을 key 로
// 사용해 캐시하고, mutation 시 invalidate 한다.

interface SnapshotCache<T> {
  rawKey: string;
  result: T;
}

let _accountCache: Map<string, SnapshotCache<LocalSimAccount>> = new Map();
let _positionsCache: Map<string, SnapshotCache<LocalSimPosition[]>> = new Map();
let _txsCache: Map<string, SnapshotCache<LocalSimTransaction[]>> = new Map();
let _ordersCache: Map<string, SnapshotCache<SimOrder[]>> = new Map();
let _equityCache: Map<
  string,
  SnapshotCache<{ unrealizedPnl: number; equity: number; openCount: number }>
> = new Map();

function invalidateAllCaches(): void {
  _accountCache.clear();
  _positionsCache.clear();
  _txsCache.clear();
  _ordersCache.clear();
  _equityCache.clear();
}

function getRawStorage(key: string): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

// ─── Account ───────────────────────────────────────────────

/**
 * **PURE READ** — localStorage 에 영속된 계정을 반환.  없으면 `null`.
 *
 * 🚨 React #185 무한 루프 fix (2026-05-18):
 *   본 함수는 useSyncExternalStore 의 getSnapshot 으로 호출되므로 절대
 *   mutation (saveJson / appendTransactionInternal / emitSimChange) 을
 *   수행해서는 안 된다. 신규 계정 생성은 `ensureLocalAccount()` 로 분리.
 *
 *   과거 본 함수는 raw === "" 일 때 fresh 계정을 만들면서 storage 를
 *   쓰고 transaction 을 append → emit 없이 끝났지만 raw 가 변하면서
 *   다음 getSnapshot 호출 시 또 다른 결과를 반환할 수 있어 production
 *   minified React (#185 Maximum update depth) 가 무한 루프로 감지.
 */
export function getLocalAccount(simUserId: string): LocalSimAccount | null {
  const key = storageKey(simUserId, "account");
  const raw = getRawStorage(key);
  const cached = _accountCache.get(simUserId);
  if (cached && cached.rawKey === raw && raw !== "") {
    return cached.result;
  }

  const existing = raw ? safeParse<LocalSimAccount | null>(raw, null) : null;
  if (existing) {
    _accountCache.set(simUserId, { rawKey: raw, result: existing });
    return existing;
  }
  // 🟢 더 이상 fresh 생성 X — null 반환.  명시적 mutation 은 ensureLocalAccount.
  return null;
}

/**
 * 신규 계정 생성 (없으면).  명시적 mutation — 절대 getSnapshot 안에서
 * 호출 X.  호출 위치:
 *   - `useSimUser.register` 완료 직후 (Simulator.tsx onRegister 핸들러)
 *   - `localResetAccount` 의 fresh 재발급
 *   - 그 외 explicit user action
 *
 * 기존 계정 있으면 그대로 반환 (idempotent).
 */
export function ensureLocalAccount(simUserId: string): LocalSimAccount {
  const existing = getLocalAccount(simUserId);
  if (existing) return existing;

  const fresh: LocalSimAccount = {
    cash: INITIAL_CASH,
    realizedPnl: 0,
    totalCommission: 0,
    totalFunding: 0,
    liquidationCount: 0,
    available: false,
  };
  const key = storageKey(simUserId, "account");
  saveJson(key, fresh);
  appendTransactionInternal(simUserId, {
    positionId: null,
    type: "deposit",
    symbol: null,
    amount: INITIAL_CASH,
    price: null,
    note: "초기 가상 자금 $200,000 USD 입금 (로컬 모드)",
  });
  const newRaw = getRawStorage(key);
  _accountCache.set(simUserId, { rawKey: newRaw, result: fresh });
  emitSimChange();
  return fresh;
}

function safeParse<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function setLocalAccount(simUserId: string, acc: LocalSimAccount): void {
  saveJson(storageKey(simUserId, "account"), acc);
}

// ─── Positions ─────────────────────────────────────────────

export function getLocalPositions(
  simUserId: string,
  options: { includeClosed?: boolean; limit?: number } = {},
): LocalSimPosition[] {
  const key = storageKey(simUserId, "positions");
  const raw = getRawStorage(key);
  // 필터 키를 캐시 키에 포함해 옵션별 결과를 독립 캐싱.
  const filterKey = `${simUserId}|${options.includeClosed ? "1" : "0"}|${options.limit ?? "*"}`;
  const cached = _positionsCache.get(filterKey);
  if (cached && cached.rawKey === raw) {
    return cached.result;
  }

  const all = raw ? safeParse<LocalSimPosition[]>(raw, []) : [];
  const filtered = options.includeClosed
    ? all
    : all.filter((p) => p.status === "open");
  filtered.sort(
    (a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime(),
  );
  const result = options.limit ? filtered.slice(0, options.limit) : filtered;
  _positionsCache.set(filterKey, { rawKey: raw, result });
  return result;
}

function setLocalPositions(simUserId: string, positions: LocalSimPosition[]): void {
  saveJson(storageKey(simUserId, "positions"), positions);
}

// ─── Transactions ──────────────────────────────────────────

export function getLocalTransactions(
  simUserId: string,
  limit = 50,
): LocalSimTransaction[] {
  const key = storageKey(simUserId, "transactions");
  const raw = getRawStorage(key);
  const cacheKey = `${simUserId}|${limit}`;
  const cached = _txsCache.get(cacheKey);
  if (cached && cached.rawKey === raw) {
    return cached.result;
  }
  const all = raw ? safeParse<LocalSimTransaction[]>(raw, []) : [];
  all.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
  const result = all.slice(0, limit);
  _txsCache.set(cacheKey, { rawKey: raw, result });
  return result;
}

/**
 * Internal — caller 가 emitSimChange 책임을 진다 (배치 가능하도록).
 *
 * 모든 호출 사이트는 명시적 mutation 경로 (ensureLocalAccount /
 * localOpenPosition / localClosePosition).  getSnapshot 안에서 절대 호출 X.
 */
function appendTransactionInternal(
  simUserId: string,
  tx: Omit<LocalSimTransaction, "id" | "userId" | "ts">,
): void {
  const key = storageKey(simUserId, "transactions");
  const all = loadJson<LocalSimTransaction[]>(key, []);
  const nextId = (all.reduce((max, t) => Math.max(max, t.id), 0) || 0) + 1;
  all.push({
    ...tx,
    id: nextId,
    userId: simUserId,
    ts: new Date().toISOString(),
  });
  saveJson(key, all);
}

// ─── Equity / unrealized ───────────────────────────────────

export function computeLocalEquity(
  simUserId: string,
): {
  unrealizedPnl: number;
  equity: number;
  openCount: number;
} {
  // PURE READ — 계정 없으면 zero equity 로 graceful fallback (Welcome 화면 단계).
  const acc = getLocalAccount(simUserId);
  const positions = getLocalPositions(simUserId, { includeClosed: false });
  const cash = acc?.cash ?? 0;
  // 캐시 — account.cash + 모든 open position 의 id|currentPrice 조합을 key 로.
  const equityKey = `${simUserId}|${cash}|${positions
    .map((p) => `${p.id}:${p.currentPrice ?? 0}`)
    .join(",")}`;
  const cached = _equityCache.get(simUserId);
  if (cached && cached.rawKey === equityKey) {
    return cached.result;
  }

  // ✅ PnL 정확화 (AUDIT.md §1.4): leverage 제거 — quantity × 가격차이만.
  // Bybit Perp 표준: pnl = size × (mark - entry) (LONG) / size × (entry - mark) (SHORT).
  // Leverage 는 margin 에 반영되므로 ROE 에서만 효과가 보이고, dollar PnL 에는
  // 영향을 주지 않는다.
  let unrealizedPnl = 0;
  for (const p of positions) {
    if (p.currentPrice == null) continue;
    unrealizedPnl += computeUnrealizedPnL(
      p.side,
      p.quantity,
      p.entryPrice,
      p.currentPrice,
    );
  }
  const result = {
    unrealizedPnl,
    equity: cash + unrealizedPnl,
    openCount: positions.length,
  };
  _equityCache.set(simUserId, { rawKey: equityKey, result });
  return result;
}

// ─── Mark to market ────────────────────────────────────────

export function localMarkToMarket(
  simUserId: string,
  prices: Map<string, number>,
): { updated: number } {
  const positions = loadJson<LocalSimPosition[]>(
    storageKey(simUserId, "positions"),
    [],
  );
  let updated = 0;
  for (const p of positions) {
    if (p.status !== "open") continue;
    const px = prices.get(p.symbol);
    if (px != null && px > 0) {
      p.currentPrice = px;
      updated++;
    }
  }
  if (updated > 0) {
    setLocalPositions(simUserId, positions);
    emitSimChange();
  }
  return { updated };
}

// ─── Open position ─────────────────────────────────────────

export interface LocalOpenInput {
  simUserId: string;
  symbol: string;
  productType: "spot" | "perp";
  side: "long" | "short";
  leverage: number;
  entryPrice: number;
  quantity: number;
}

export interface LocalOpenResult {
  position?: LocalSimPosition;
  newCash?: number;
  error?: string;
}

export function localOpenPosition(input: LocalOpenInput): LocalOpenResult {
  const { simUserId, symbol, productType, side, leverage, entryPrice, quantity } =
    input;
  if (productType === "spot" && side === "short") {
    return { error: "Spot 상품은 SHORT 불가" };
  }
  if (!entryPrice || entryPrice <= 0) {
    return { error: `${symbol} 시장 가격 fetch 실패` };
  }
  if (quantity <= 0) {
    return { error: "Quantity must be > 0" };
  }
  const effLeverage = productType === "spot" ? 1 : Math.max(1, leverage);
  const positionValue = entryPrice * quantity;
  const margin = positionValue / effLeverage;
  const commission = positionValue * COMMISSION_RATE * effLeverage;
  const totalCost = margin + commission;

  // 명시적 mutation 경로 — 계정 없으면 신규 생성 (idempotent).
  const acc = ensureLocalAccount(simUserId);
  if (acc.cash < totalCost) {
    return {
      error: `잔액 부족: 필요 $${totalCost.toFixed(2)} > 현재 $${acc.cash.toFixed(2)}`,
    };
  }

  // 청산가: Bybit isolated margin 스타일 (MMR 0.5%).
  const liqPrice = calcLiquidationPrice(
    side,
    entryPrice,
    effLeverage,
    DEFAULT_MAINTENANCE_MARGIN_RATE,
  );

  const positions = loadJson<LocalSimPosition[]>(
    storageKey(simUserId, "positions"),
    [],
  );
  const nextId = (positions.reduce((max, p) => Math.max(max, p.id), 0) || 0) + 1;
  const now = new Date().toISOString();
  const newPos: LocalSimPosition = {
    id: nextId,
    userId: simUserId,
    symbol,
    productType,
    side,
    leverage: effLeverage,
    entryPrice,
    quantity,
    margin,
    currentPrice: entryPrice,
    liquidationPrice: liqPrice, // 기존 필드 — 동일 값 유지 (backward compat)
    liqPrice,
    maintenanceMarginRate: DEFAULT_MAINTENANCE_MARGIN_RATE,
    accruedFunding: 0,
    accruedCommission: commission,
    status: "open",
    openedAt: now,
    closedAt: null,
    closedPnl: null,
    closedPrice: null,
    closedReason: null,
  };
  positions.push(newPos);
  setLocalPositions(simUserId, positions);

  // 차감
  const newCash = acc.cash - totalCost;
  setLocalAccount(simUserId, {
    ...acc,
    cash: newCash,
    totalCommission: acc.totalCommission + commission,
  });

  appendTransactionInternal(simUserId, {
    positionId: nextId,
    type: "open",
    symbol,
    amount: -margin,
    price: entryPrice,
    note: `${side.toUpperCase()} ${symbol} ${quantity} @ $${entryPrice.toFixed(2)} (${effLeverage}x ${productType})`,
  });
  appendTransactionInternal(simUserId, {
    positionId: nextId,
    type: "commission",
    symbol,
    amount: -commission,
    price: entryPrice,
    note: `Open commission (0.01% × ${effLeverage}x)`,
  });

  emitSimChange();
  return { position: newPos, newCash };
}

// ─── Close position ────────────────────────────────────────

export interface LocalCloseInput {
  simUserId: string;
  positionId: number;
  exitPrice: number;
  reason?: string;
}

export interface LocalCloseResult {
  position?: LocalSimPosition;
  pnl?: number;
  newCash?: number;
  error?: string;
}

export function localClosePosition(input: LocalCloseInput): LocalCloseResult {
  const { simUserId, positionId, exitPrice, reason = "manual" } = input;
  if (!exitPrice || exitPrice <= 0) {
    return { error: "Exit price fetch 실패" };
  }
  const positions = loadJson<LocalSimPosition[]>(
    storageKey(simUserId, "positions"),
    [],
  );
  const target = positions.find((p) => p.id === positionId && p.status === "open");
  if (!target) return { error: "Position not found" };

  // ✅ PnL 정확화 (AUDIT.md §1.4): leverage 제거 (Bybit Perp 표준).
  //   pnl = size × (exit - entry) (LONG) / size × (entry - exit) (SHORT)
  // Commission 은 기존 식 (positionValue × rate × leverage) 유지 — 본 fix
  // 는 PnL 만 다룬다. 수수료 정확화는 별도 PR.
  const pnlRaw = computeUnrealizedPnL(
    target.side,
    target.quantity,
    target.entryPrice,
    exitPrice,
  );
  const positionValue = exitPrice * target.quantity;
  const exitCommission = positionValue * COMMISSION_RATE * target.leverage;
  const netPnl = computeNetPnL(pnlRaw, exitCommission, target.accruedFunding);

  const isLiquidation = reason === "liquidation";
  // ✅ Cash 음수 차단 (AUDIT.md §1.7): cashReturned = max(0, margin + netPnL).
  // 강제청산은 명시적으로 0 환원 — margin 전손.
  // 손실이 margin 을 초과해도 (예: gap-down) cash 음수 진입 X.
  const cashReturned = isLiquidation
    ? 0
    : computeCashReturned(target.margin, netPnl);

  target.status = isLiquidation ? "liquidated" : "closed";
  target.closedAt = new Date().toISOString();
  target.closedPnl = isLiquidation
    ? -target.margin // 마진 전손
    : netPnl;
  target.closedPrice = exitPrice;
  target.closedReason = reason;
  target.currentPrice = exitPrice;
  if (isLiquidation) {
    target.liquidatedAt = Date.now();
  }
  setLocalPositions(simUserId, positions);

  // close 시 계정이 없을 일은 없지만 (open 했어야 close 가능) 방어적으로
  // ensureLocalAccount 로 폴백.
  const acc = ensureLocalAccount(simUserId);
  // 🛡 Defense-in-depth: computeCashReturned 가 음수를 차단해도, 누적 acc.cash
  // 가 어떤 경로로든 음수에 도달하면 0 으로 강제 보정 + console.error.
  let newCash = acc.cash + cashReturned;
  if (newCash < 0) {
    console.error("[sim] cash would go negative — clamping to 0", {
      cash: acc.cash,
      cashReturned,
      margin: target.margin,
      netPnl,
    });
    newCash = 0;
  }
  setLocalAccount(simUserId, {
    ...acc,
    cash: newCash,
    realizedPnl: acc.realizedPnl + (target.closedPnl ?? 0),
    totalCommission: acc.totalCommission + (isLiquidation ? 0 : exitCommission),
    liquidationCount: acc.liquidationCount + (isLiquidation ? 1 : 0),
  });

  if (isLiquidation) {
    appendTransactionInternal(simUserId, {
      positionId,
      type: "liquidation",
      symbol: target.symbol,
      amount: -target.margin,
      price: exitPrice,
      note: `LIQUIDATION ${target.side.toUpperCase()} ${target.symbol} @ $${exitPrice.toFixed(2)} · 마진 전손 $${target.margin.toFixed(2)}`,
    });
  } else {
    appendTransactionInternal(simUserId, {
      positionId,
      type: "close",
      symbol: target.symbol,
      amount: cashReturned,
      price: exitPrice,
      note: `Close ${target.side.toUpperCase()} ${target.symbol} @ $${exitPrice.toFixed(2)} · PnL ${(target.closedPnl ?? 0).toFixed(2)}`,
    });
    appendTransactionInternal(simUserId, {
      positionId,
      type: "commission",
      symbol: target.symbol,
      amount: -exitCommission,
      price: exitPrice,
      note: `Close commission (0.01% × ${target.leverage}x)`,
    });
  }

  emitSimChange();
  return { position: target, pnl: target.closedPnl ?? 0, newCash };
}

// ─── Reset ─────────────────────────────────────────────────

export function localResetAccount(simUserId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(storageKey(simUserId, "account"));
    window.localStorage.removeItem(storageKey(simUserId, "positions"));
    window.localStorage.removeItem(storageKey(simUserId, "transactions"));
    window.localStorage.removeItem(storageKey(simUserId, "orders"));
  } catch {
    // ignore
  }
  // 캐시 즉시 무효화 — 다음 read 가 새 raw 를 보도록.
  invalidateAllCaches();
  // 즉시 fresh 계정 생성 (deposit transaction 포함 + emit).
  ensureLocalAccount(simUserId);
}

/**
 * 🗑 **NUKE** — 모든 시뮬레이터 데이터를 완전 삭제.
 *
 * 삭제 대상:
 *   - `tradelab.sim.*` 전체 (모든 simUserId 의 account / positions / transactions / orders)
 *   - `tradelab.simUser` (현재 닉네임 + UUID)
 *
 * Welcome 화면 reset 링크 + ErrorBoundary 의 recovery 액션에서 사용.
 *
 * 호출 후:
 *   - 모든 캐시 invalidate
 *   - emitSimChange 로 listener 알림 (현재 마운트된 hook 들이 빈 결과로 복귀)
 *   - useSimUser 가 다음 mount 에서 needsRegistration=true 로 복귀
 *
 * 주의: 본 함수는 페이지 reload 를 트리거하지 않는다. 호출자가 필요 시
 * `window.location.reload()` 를 직접 호출.
 */
export function nukeAllSimData(): void {
  if (typeof window === "undefined") return;
  try {
    const keys = Object.keys(window.localStorage);
    for (const k of keys) {
      if (k.startsWith("tradelab.sim.") || k === "tradelab.simUser") {
        window.localStorage.removeItem(k);
      }
    }
  } catch {
    // private mode / quota — ignore
  }
  invalidateAllCaches();
  emitSimChange();
}

// ─── Orders (pending limit orders) ─────────────────────────

/** crypto.randomUUID polyfill (구형 브라우저 대비) */
function genOrderId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `ord_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function getLocalOrders(
  simUserId: string,
  filter?: "pending" | "filled" | "cancelled",
): SimOrder[] {
  const key = storageKey(simUserId, "orders");
  const raw = getRawStorage(key);
  const cacheKey = `${simUserId}|${filter ?? "*"}`;
  const cached = _ordersCache.get(cacheKey);
  if (cached && cached.rawKey === raw) {
    return cached.result;
  }
  const all = raw ? safeParse<SimOrder[]>(raw, []) : [];
  const filtered = filter ? all.filter((o) => o.status === filter) : all;
  filtered.sort((a, b) => b.createdAt - a.createdAt);
  _ordersCache.set(cacheKey, { rawKey: raw, result: filtered });
  return filtered;
}

function setLocalOrders(simUserId: string, orders: SimOrder[]): void {
  saveJson(storageKey(simUserId, "orders"), orders);
}

export interface AddLocalOrderInput {
  simUserId: string;
  symbol: string;
  productType: "spot" | "perp";
  side: "long" | "short";
  type: "limit" | "market";
  qty: number;
  limitPrice?: number;
  leverage: number;
  marginMode: "cross" | "isolated";
}

export function addLocalOrder(input: AddLocalOrderInput): SimOrder {
  const orders = loadJson<SimOrder[]>(
    storageKey(input.simUserId, "orders"),
    [],
  );
  const next: SimOrder = {
    id: genOrderId(),
    userId: input.simUserId,
    symbol: input.symbol,
    productType: input.productType,
    side: input.side,
    type: input.type,
    qty: input.qty,
    limitPrice: input.limitPrice,
    leverage: input.leverage,
    marginMode: input.marginMode,
    status: "pending",
    createdAt: Date.now(),
  };
  orders.push(next);
  setLocalOrders(input.simUserId, orders);
  emitSimChange();
  return next;
}

export function updateLocalOrder(
  simUserId: string,
  orderId: string,
  patch: Partial<Omit<SimOrder, "id" | "userId">>,
): SimOrder | null {
  const orders = loadJson<SimOrder[]>(storageKey(simUserId, "orders"), []);
  const idx = orders.findIndex((o) => o.id === orderId);
  if (idx < 0) return null;
  orders[idx] = { ...orders[idx], ...patch };
  setLocalOrders(simUserId, orders);
  emitSimChange();
  return orders[idx];
}

export function cancelLocalOrder(
  simUserId: string,
  orderId: string,
): SimOrder | null {
  return updateLocalOrder(simUserId, orderId, {
    status: "cancelled",
    cancelledAt: Date.now(),
  });
}

// ─── Export / Import (백업 / 복구) ─────────────────────────
//
// localStorage 는 사용자가 브라우저 캐시 / 시크릿 모드 / 다른 기기 전환 시
// 휘발된다. 백엔드 DB 가 없는 local-only 모드에서 사용자가 자기 데이터를
// 보호할 수 있도록 JSON export / import 를 제공.
//
// 보안: 시뮬레이터 데이터는 가짜 자산이므로 평문 export 무방.
// 단, 사용자가 export 한 JSON 파일을 SNS 등 공개 채널에 올리면 nickname 노출.

/**
 * 모든 `tradelab.sim.*` 키 + `tradelab.simUser` 를 JSON 으로 직렬화.
 *
 * 반환 형식:
 * ```json
 * {
 *   "version": 1,
 *   "exportedAt": "2026-05-19T12:34:56.789Z",
 *   "data": {
 *     "tradelab.sim.account.<uuid>": "{...}",
 *     "tradelab.sim.positions.<uuid>": "[...]",
 *     "tradelab.simUser": "{...}",
 *     ...
 *   }
 * }
 * ```
 *
 * AUDIT.md §2.4 (local-only 적응 — S3 대신 사용자 파일 다운로드).
 */
export function exportSimData(): string {
  const data: Record<string, string> = {};
  if (typeof window === "undefined") {
    return JSON.stringify({
      version: 1,
      exportedAt: new Date().toISOString(),
      data: {},
    });
  }
  try {
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith("tradelab.sim.") || key === "tradelab.simUser") {
        const value = window.localStorage.getItem(key);
        if (value != null) data[key] = value;
      }
    }
  } catch {
    // private mode / quota — 빈 export 반환
  }
  return JSON.stringify(
    {
      version: 1,
      exportedAt: new Date().toISOString(),
      data,
    },
    null,
    2,
  );
}

export interface ImportResult {
  ok: boolean;
  error?: string;
  /** 복원된 key 개수 (성공 시). */
  restored?: number;
}

/**
 * `exportSimData` 가 만든 JSON 을 받아 localStorage 를 복원.
 *
 * 정책:
 *   - **REPLACE** — 기존 `tradelab.sim.*` / `tradelab.simUser` 를 모두 삭제 후
 *     import 데이터로 덮어쓴다 (merge 가 아님).
 *   - 다른 key (Tradelab 외 앱) 는 건드리지 않는다.
 *   - version === 1 만 허용.
 *
 * 호출 후 자동으로 emitSimChange 발화 — 현재 마운트된 hook 들이 새 데이터로
 * 즉시 갱신.  단, simUser hook 은 mount 시 한 번만 읽으므로 (정책 결정),
 * import 후 페이지 reload 권장.
 */
export function importSimData(json: string): ImportResult {
  if (typeof window === "undefined") {
    return { ok: false, error: "브라우저 환경이 아닙니다" };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (err) {
    return { ok: false, error: `JSON parse 실패: ${(err as Error).message}` };
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("version" in parsed) ||
    !("data" in parsed)
  ) {
    return { ok: false, error: "잘못된 export 파일 형식" };
  }
  const obj = parsed as { version: unknown; data: unknown };
  if (obj.version !== 1) {
    return { ok: false, error: `지원되지 않는 버전: ${String(obj.version)}` };
  }
  if (typeof obj.data !== "object" || obj.data === null) {
    return { ok: false, error: "data 필드 누락" };
  }
  try {
    // 1. 기존 sim 데이터 모두 제거
    const existingKeys = Object.keys(window.localStorage);
    for (const k of existingKeys) {
      if (k.startsWith("tradelab.sim.") || k === "tradelab.simUser") {
        window.localStorage.removeItem(k);
      }
    }
    // 2. import 데이터 복원
    let restored = 0;
    for (const [key, value] of Object.entries(
      obj.data as Record<string, unknown>,
    )) {
      if (
        typeof value !== "string" ||
        !(key.startsWith("tradelab.sim.") || key === "tradelab.simUser")
      ) {
        continue;
      }
      window.localStorage.setItem(key, value);
      restored++;
    }
    invalidateAllCaches();
    emitSimChange();
    return { ok: true, restored };
  } catch (err) {
    return { ok: false, error: `복원 실패: ${(err as Error).message}` };
  }
}
