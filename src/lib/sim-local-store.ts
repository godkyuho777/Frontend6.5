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
 */

const INITIAL_CASH = 200_000;
const COMMISSION_RATE = 0.0001; // 0.01%

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
  accruedFunding: number;
  accruedCommission: number;
  status: "open" | "closed" | "liquidated";
  openedAt: string;
  closedAt: string | null;
  closedPnl: number | null;
  closedPrice: number | null;
  closedReason: string | null;
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

// ─── Account ───────────────────────────────────────────────

export function getLocalAccount(simUserId: string): LocalSimAccount {
  const key = storageKey(simUserId, "account");
  const existing = loadJson<LocalSimAccount | null>(key, null);
  if (existing) return existing;
  // 신규 — $200k 입금 + transaction 기록
  const fresh: LocalSimAccount = {
    cash: INITIAL_CASH,
    realizedPnl: 0,
    totalCommission: 0,
    totalFunding: 0,
    liquidationCount: 0,
    available: false,
  };
  saveJson(key, fresh);
  appendTransaction(simUserId, {
    positionId: null,
    type: "deposit",
    symbol: null,
    amount: INITIAL_CASH,
    price: null,
    note: "초기 가상 자금 $200,000 USD 입금 (로컬 모드)",
  });
  return fresh;
}

function setLocalAccount(simUserId: string, acc: LocalSimAccount): void {
  saveJson(storageKey(simUserId, "account"), acc);
}

// ─── Positions ─────────────────────────────────────────────

export function getLocalPositions(
  simUserId: string,
  options: { includeClosed?: boolean; limit?: number } = {},
): LocalSimPosition[] {
  const all = loadJson<LocalSimPosition[]>(storageKey(simUserId, "positions"), []);
  const filtered = options.includeClosed
    ? all
    : all.filter((p) => p.status === "open");
  // 최신순 정렬
  filtered.sort(
    (a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime(),
  );
  return options.limit ? filtered.slice(0, options.limit) : filtered;
}

function setLocalPositions(simUserId: string, positions: LocalSimPosition[]): void {
  saveJson(storageKey(simUserId, "positions"), positions);
}

// ─── Transactions ──────────────────────────────────────────

export function getLocalTransactions(
  simUserId: string,
  limit = 50,
): LocalSimTransaction[] {
  const all = loadJson<LocalSimTransaction[]>(storageKey(simUserId, "transactions"), []);
  // 최신순 정렬
  all.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
  return all.slice(0, limit);
}

function appendTransaction(
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
  const acc = getLocalAccount(simUserId);
  const positions = getLocalPositions(simUserId, { includeClosed: false });
  let unrealizedPnl = 0;
  for (const p of positions) {
    if (p.currentPrice == null) continue;
    const dir = p.side === "long" ? 1 : -1;
    unrealizedPnl += dir * (p.currentPrice - p.entryPrice) * p.quantity * p.leverage;
  }
  return {
    unrealizedPnl,
    equity: acc.cash + unrealizedPnl,
    openCount: positions.length,
  };
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
  setLocalPositions(simUserId, positions);
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

  const acc = getLocalAccount(simUserId);
  if (acc.cash < totalCost) {
    return {
      error: `잔액 부족: 필요 $${totalCost.toFixed(2)} > 현재 $${acc.cash.toFixed(2)}`,
    };
  }

  const liqDistance = 0.95 / effLeverage;
  const liquidationPrice =
    side === "long"
      ? entryPrice * (1 - liqDistance)
      : entryPrice * (1 + liqDistance);

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
    liquidationPrice,
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

  appendTransaction(simUserId, {
    positionId: nextId,
    type: "open",
    symbol,
    amount: -margin,
    price: entryPrice,
    note: `${side.toUpperCase()} ${symbol} ${quantity} @ $${entryPrice.toFixed(2)} (${effLeverage}x ${productType})`,
  });
  appendTransaction(simUserId, {
    positionId: nextId,
    type: "commission",
    symbol,
    amount: -commission,
    price: entryPrice,
    note: `Open commission (0.01% × ${effLeverage}x)`,
  });

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

  const dir = target.side === "long" ? 1 : -1;
  const pnlRaw = dir * (exitPrice - target.entryPrice) * target.quantity * target.leverage;
  const positionValue = exitPrice * target.quantity;
  const exitCommission = positionValue * COMMISSION_RATE * target.leverage;
  const netReturn = target.margin + pnlRaw - exitCommission - target.accruedFunding;

  target.status = "closed";
  target.closedAt = new Date().toISOString();
  target.closedPnl = pnlRaw - exitCommission - target.accruedFunding;
  target.closedPrice = exitPrice;
  target.closedReason = reason;
  target.currentPrice = exitPrice;
  setLocalPositions(simUserId, positions);

  const acc = getLocalAccount(simUserId);
  const newCash = acc.cash + netReturn;
  setLocalAccount(simUserId, {
    ...acc,
    cash: newCash,
    realizedPnl: acc.realizedPnl + (target.closedPnl ?? 0),
    totalCommission: acc.totalCommission + exitCommission,
  });

  appendTransaction(simUserId, {
    positionId,
    type: "close",
    symbol: target.symbol,
    amount: netReturn,
    price: exitPrice,
    note: `Close ${target.side.toUpperCase()} ${target.symbol} @ $${exitPrice.toFixed(2)} · PnL ${(target.closedPnl ?? 0).toFixed(2)}`,
  });
  appendTransaction(simUserId, {
    positionId,
    type: "commission",
    symbol: target.symbol,
    amount: -exitCommission,
    price: exitPrice,
    note: `Close commission (0.01% × ${target.leverage}x)`,
  });

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
  // 즉시 fresh 계정 생성 (deposit transaction 포함)
  getLocalAccount(simUserId);
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
  const all = loadJson<SimOrder[]>(storageKey(simUserId, "orders"), []);
  const filtered = filter ? all.filter((o) => o.status === filter) : all;
  // 최신순 (createdAt desc)
  filtered.sort((a, b) => b.createdAt - a.createdAt);
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
