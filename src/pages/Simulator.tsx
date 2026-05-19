/**
 * Investment Simulator (모의투자) — Bybit-style Trading UI (2026-05-15).
 *
 * Onboarding:
 *   1. 신규 방문 → SimulatorWelcome 화면 (닉네임 입력 + Start with $200,000 버튼)
 *   2. 등록 후 → simUser localStorage 영구 저장 → simulator UI 진입
 *   3. 등록된 사용자는 바로 simulator UI
 *
 * 레이아웃 (Bybit /trade/usdt/BTCUSDT 미러, md:768px 부터 3-column):
 *   ┌──────────────────────────────────────────────────────────┐
 *   │  Symbol · Last · 24h · 6 popular · Nickname               │
 *   ├─────────────────────────────────────────────────────────┤
 *   │  Cash · Equity · uPnL · rPnL · Open · Mark · Reset       │
 *   ├──────────────────────┬──────────────┬───────────────────┤
 *   │  Candle Chart        │  Order Book  │  Trade Form        │
 *   │  + 9 TF tabs         │  + Recent    │  (Buy/Sell on top) │
 *   ├──────────────────────┴──────────────┴───────────────────┤
 *   │  Tabs: Positions / Order History / Trade History          │
 *   └──────────────────────────────────────────────────────────┘
 *
 * Charter: 본 페이지는 BBDX 시그널 시스템과 완전 분리. 모의투자는 헌장 R4
 * (자본 보호) 와 별개로 사용자 학습 / UX 실험용.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  CandleChartLW,
  type ChartPositionLine,
  type ChartOrderLine,
} from "@/components/CandleChartLW";
import { SimulatorWelcome } from "@/components/SimulatorWelcome";
import { useSimUser } from "@/hooks/useSimUser";
import {
  fetchSimKlines,
  fetchOrderBook,
  fetchRecentTrades,
  fetchSimTicker,
  SIM_TIMEFRAMES,
  type SimTimeframe,
  type OrderBookSnapshot,
  type RecentTrade,
  type SimTicker,
} from "@/lib/bybit-simulator";
import {
  localOpenPosition,
  localClosePosition,
  localResetAccount,
  localMarkToMarket,
  getLocalPositions,
  addLocalOrder,
  updateLocalOrder,
  cancelLocalOrder,
  ensureLocalAccount,
  exportSimData,
  importSimData,
  type SimOrder,
} from "@/lib/sim-local-store";
import {
  computeUnrealizedPnL,
  computeMarginRatio,
  getMarginRatioColor,
  DEFAULT_MAINTENANCE_MARGIN_RATE,
} from "@/lib/sim-pnl";
import {
  useLocalAccountSync,
  useLocalEquitySync,
  useLocalPositionsSync,
  useLocalOrdersSync,
  useLocalTransactionsSync,
} from "@/hooks/useSimLocalStore";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Loader2,
  AlertCircle,
  RotateCcw,
  Edit3,
  Check,
  X,
  LogOut,
  Trash2,
  ClipboardList,
  Download,
  Upload,
} from "lucide-react";
import type { Candle } from "@shared/types";

const POPULAR_SYMBOLS = [
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
  "XRPUSDT",
  "BNBUSDT",
  "DOGEUSDT",
];

type BottomTab =
  | "positions"
  | "open-orders"
  | "order-history"
  | "trade-history";

function formatPrice(p: number): string {
  if (!p || p === 0) return "—";
  if (p < 0.01) return p.toFixed(8);
  if (p < 1) return p.toFixed(6);
  if (p < 100) return p.toFixed(4);
  return p.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function formatUSD(v: number): string {
  return `$${v.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatQty(v: number): string {
  if (!v) return "0";
  if (v >= 1000) return v.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (v >= 1) return v.toFixed(4);
  return v.toFixed(6);
}

export default function Simulator() {
  const { simUser, mounted, needsRegistration, register, setNickname, signOut } =
    useSimUser();

  // ── State (only used when registered) ─────────────────────
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [timeframe, setTimeframe] = useState<SimTimeframe>("1h");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [candlesLoading, setCandlesLoading] = useState(false);
  const [orderBook, setOrderBook] = useState<OrderBookSnapshot | null>(null);
  const [recentTrades, setRecentTrades] = useState<RecentTrade[]>([]);
  const [ticker, setTicker] = useState<SimTicker | null>(null);

  const [productType, setProductType] = useState<"spot" | "perp">("perp");
  const [marginMode, setMarginMode] = useState<"cross" | "isolated">("cross");
  const [orderType, setOrderType] = useState<"limit" | "market">("market");
  const [side, setSide] = useState<"long" | "short">("long");
  const [leverage, setLeverage] = useState(10);
  const [priceText, setPriceText] = useState("");
  const [qtyText, setQtyText] = useState("");

  const [bottomTab, setBottomTab] = useState<BottomTab>("positions");

  const [editingNick, setEditingNick] = useState(false);
  const [nickInput, setNickInput] = useState("");

  // Export / Import (백업 · 복구) — hidden file input + ref.
  const importFileInputRef = useRef<HTMLInputElement>(null);

  // ── tRPC (only when registered) ───────────────────────────
  const trpcEnabled = !!simUser?.id;
  const accountQuery = trpc.simulator.account.useQuery(
    { simUserId: simUser?.id ?? "" },
    { enabled: trpcEnabled, refetchInterval: 10_000, retry: 1 },
  );
  const positionsQuery = trpc.simulator.positions.useQuery(
    { simUserId: simUser?.id ?? "", includeClosed: false, limit: 50 },
    { enabled: trpcEnabled, refetchInterval: 10_000, retry: 1 },
  );
  const allPositionsQuery = trpc.simulator.positions.useQuery(
    { simUserId: simUser?.id ?? "", includeClosed: true, limit: 100 },
    {
      enabled: trpcEnabled && bottomTab === "order-history",
      refetchInterval: 30_000,
      retry: 1,
    },
  );
  const transactionsQuery = trpc.simulator.transactions.useQuery(
    { simUserId: simUser?.id ?? "", limit: 100 },
    {
      enabled: trpcEnabled && bottomTab === "trade-history",
      refetchInterval: 15_000,
      retry: 1,
    },
  );

  const utils = trpc.useUtils();
  const invalidateAll = () => {
    utils.simulator.account.invalidate();
    utils.simulator.positions.invalidate();
    utils.simulator.transactions.invalidate();
  };
  const openMutation = trpc.simulator.openPosition.useMutation({
    onSuccess: invalidateAll,
  });
  const closeMutation = trpc.simulator.closePosition.useMutation({
    onSuccess: invalidateAll,
  });
  const refreshMutation = trpc.simulator.refresh.useMutation({
    onSuccess: invalidateAll,
  });
  const resetMutation = trpc.simulator.reset.useMutation({
    onSuccess: invalidateAll,
  });

  // ── Candle fetch (500 candles — Bybit / TradingView 같은 자유로운 zoom/scroll) ─
  useEffect(() => {
    if (!symbol || !simUser) return;
    let cancelled = false;
    setCandlesLoading(true);
    fetchSimKlines(symbol, timeframe, 500)
      .then((d) => !cancelled && setCandles(d))
      .catch(() => !cancelled && setCandles([]))
      .finally(() => !cancelled && setCandlesLoading(false));
    return () => {
      cancelled = true;
    };
  }, [symbol, timeframe, simUser]);

  // ── Order book + recent trades + ticker polling ──────────
  useEffect(() => {
    if (!symbol || !simUser) return;
    let cancelled = false;
    const refresh = async () => {
      const [ob, trades, t] = await Promise.all([
        fetchOrderBook(symbol, 20),
        fetchRecentTrades(symbol, 25),
        fetchSimTicker(symbol),
      ]);
      if (cancelled) return;
      if (ob) setOrderBook(ob);
      if (trades.length) setRecentTrades(trades);
      if (t) setTicker(t);
    };
    refresh();
    const id = setInterval(refresh, 3_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [symbol, simUser]);

  // ── Auto-fill price input (limit) ────────────────────────
  useEffect(() => {
    if (orderType === "limit" && ticker && !priceText) {
      setPriceText(String(ticker.lastPrice));
    }
  }, [ticker, orderType, priceText]);

  // ── Local mode detection ──────────────────────────────────
  // 백엔드 응답이 `available: false` 거나 query error 가 발생하면 localStorage
  // 기반 fallback 으로 전환. 사용자가 익명 모드에서 즉시 모의투자를 체험 가능.
  const isBackendUnavailable =
    accountQuery.isError ||
    (accountQuery.data && accountQuery.data.available === false);
  const useLocalMode: boolean = !!simUser?.id && !!isBackendUnavailable;

  // 🚨 React #185 fix (2026-05-18): 기존 simUser 이지만 sim.account.* 키만
  // 누락된 edge case (브라우저 캐시 부분 삭제 등) 를 위해, local mode 진입
  // 직후 account 가 null 이면 명시적으로 materialize.  본 effect 는 mutation
  // 으로 emitSimChange 를 발화해 다음 render 에서 정상 cash 가 보이도록 한다.
  useEffect(() => {
    if (useLocalMode && simUser?.id) {
      ensureLocalAccount(simUser.id);
    }
  }, [useLocalMode, simUser?.id]);

  // ── Derived (backend OR local store) ─────────────────────
  //
  // useSyncExternalStore 기반 hook 으로 외부 store 의 변경을 동기적으로
  // 수신. 기존 localRev / useMemo 패턴은 ticker 갱신과 mutation 사이의
  // race condition 으로 Position 카드 깜빡거림을 유발했다 — emit-based
  // subscription 으로 완전 제거.
  //
  // 호출 자체는 useLocalMode 와 무관하게 항상 수행 (Hook 규칙 — 조건부
  // 호출 금지). 백엔드 모드일 땐 결과를 사용하지 않을 뿐 비용 없음.
  const localAccount = useLocalAccountSync(simUser?.id);
  const localEquity = useLocalEquitySync(simUser?.id);
  const localOpenPositions = useLocalPositionsSync(simUser?.id, "open");
  const localClosedPositions = useLocalPositionsSync(simUser?.id, "closed");
  const localTxs = useLocalTransactionsSync(simUser?.id, 100);
  /** Pending limit orders — 항상 가져와 Open Orders 탭 카운트 표시 + 트리거 검사 */
  const localPendingOrders = useLocalOrdersSync(simUser?.id, "pending");

  const account = useLocalMode
    ? localAccount
      ? {
          cash: localAccount.cash,
          equity: localEquity.equity || localAccount.cash,
          realizedPnl: localAccount.realizedPnl,
          totalCommission: localAccount.totalCommission,
          totalFunding: localAccount.totalFunding,
          liquidationCount: localAccount.liquidationCount,
          openPositions: localEquity.openCount,
          unrealizedPnl: localEquity.unrealizedPnl,
          available: false as const,
        }
      : null
    : accountQuery.data;

  const positions = useLocalMode ? localOpenPositions : (positionsQuery.data ?? []);
  const closedPositions = useLocalMode
    ? localClosedPositions
    : (allPositionsQuery.data ?? []).filter((p: any) => p.status !== "open");
  const transactions = useLocalMode ? localTxs : (transactionsQuery.data ?? []);

  const currentPrice = ticker?.lastPrice ?? 0;

  /**
   * Phase 2 #6 — 현재 차트 심볼의 open 포지션 + pending limit 주문 priceLine 입력.
   *
   * 같은 심볼만 필터해 차트에 overlay (다른 심볼 포지션이 BTC 차트에 보이면 혼란).
   * useMemo 로 reference stability 보장 — positions / orders / symbol 이 안 변하면
   * 같은 array 를 재사용해 CandleChartLW 의 useEffect 가 불필요하게 재실행되지 않음.
   */
  const chartPositionLines = useMemo<ChartPositionLine[]>(() => {
    return positions
      .filter((p: any) => p.symbol === symbol && p.status === "open")
      .map((p: any) => {
        const liq =
          typeof p.liqPrice === "number" && p.liqPrice > 0
            ? p.liqPrice
            : typeof p.liquidationPrice === "number" && p.liquidationPrice > 0
              ? p.liquidationPrice
              : null;
        return {
          id: p.id,
          side: p.side as "long" | "short",
          entryPrice: p.entryPrice,
          liqPrice: liq,
          label: `${p.side === "long" ? "L" : "S"} ${formatQty(p.quantity)}`,
        };
      });
  }, [positions, symbol]);

  const chartOrderLines = useMemo<ChartOrderLine[]>(() => {
    if (!useLocalMode) return [];
    return localPendingOrders
      .filter(
        (o) =>
          o.symbol === symbol &&
          o.status === "pending" &&
          o.type === "limit" &&
          typeof o.limitPrice === "number" &&
          o.limitPrice > 0,
      )
      .map((o) => ({
        id: o.id,
        side: o.side,
        limitPrice: o.limitPrice as number,
        label: `${o.side === "long" ? "L" : "S"} ${formatQty(o.qty)} Limit`,
      }));
  }, [localPendingOrders, symbol, useLocalMode]);

  const qty = parseFloat(qtyText) || 0;
  const price = parseFloat(priceText) || 0;
  const effectivePrice = orderType === "market" ? currentPrice : price;
  const positionValue = effectivePrice * qty;
  const margin = positionValue / Math.max(1, leverage);
  const commission = positionValue * 0.0001 * Math.max(1, leverage);
  const totalCost = margin + commission;
  const cashAvailable = account?.cash ?? 0;
  const isAffordable =
    cashAvailable >= totalCost && qty > 0 && effectivePrice > 0;

  /**
   * Local 모드에서 ticker 갱신 시:
   *   1. 해당 심볼의 open 포지션을 mark-to-market
   *   2. 청산가 도달한 포지션을 강제청산 (liquidation reason)
   *
   * `localMarkToMarket` 와 `localClosePosition` 모두 내부에서 emitSimChange()
   * 호출하므로 별도 setState 트리거 불필요.
   */
  useEffect(() => {
    if (!useLocalMode || !simUser?.id || !ticker) return;

    // 1) Mark-to-market
    const prices = new Map<string, number>([[ticker.symbol, ticker.lastPrice]]);
    localMarkToMarket(simUser.id, prices);

    // 2) 청산 검사
    const openPositions = getLocalPositions(simUser.id, { includeClosed: false });
    for (const pos of openPositions) {
      if (pos.symbol !== ticker.symbol) continue;
      if (!pos.liqPrice || pos.liqPrice <= 0) continue;
      const mark = ticker.lastPrice;
      const hit =
        pos.side === "long" ? mark <= pos.liqPrice : mark >= pos.liqPrice;
      if (!hit) continue;
      const result = localClosePosition({
        simUserId: simUser.id,
        positionId: pos.id,
        exitPrice: pos.liqPrice,
        reason: "liquidation",
      });
      if (!result.error) {
        toast.error(
          `${pos.symbol} ${pos.side.toUpperCase()} 강제청산`,
          {
            description: `청산가 $${pos.liqPrice.toFixed(2)} 도달 · 마진 $${pos.margin.toFixed(2)} 전손`,
          },
        );
      }
    }
  }, [useLocalMode, simUser?.id, ticker]);

  /**
   * Local 모드 — pending limit 주문 트리거.
   *
   * ticker 갱신마다 현재 ticker.symbol 의 pending limit 주문을 순회해 mark
   * price 가 limitPrice 에 도달했는지 검사. 도달 시 즉시 localOpenPosition
   * 으로 포지션 생성 + order.status = "filled".
   *
   * 트리거 규칙 (정통 거래소 limit 동작):
   *   - LONG 매수 limit: mark ≤ limitPrice 시 체결 (저가 매수 의도)
   *   - SHORT 매도 limit: mark ≥ limitPrice 시 체결 (고가 매도 의도)
   *
   * 체결 가격은 사용자가 지정한 limitPrice 그대로 (mark price 아님).
   * 잔액 부족으로 localOpenPosition 이 실패하면 order 는 그대로 pending 유지
   * (자동 취소 안 함) — 사용자가 직접 취소 또는 잔액 보충 후 자동 재시도.
   */
  useEffect(() => {
    if (!useLocalMode || !simUser?.id || !ticker) return;
    // localPendingOrders 는 useLocalOrdersSync 가 항상 최신을 보장하므로
    // 별도 read 불필요. 단, 본 effect 는 ticker 변경 시에만 트리거되어야
    // 하므로 의존성에서 localPendingOrders 는 제외 (무한 루프 방지).
    for (const order of localPendingOrders) {
      if (order.type !== "limit") continue;
      if (!order.limitPrice || order.limitPrice <= 0) continue;
      if (order.symbol !== ticker.symbol) continue;
      const mark = ticker.lastPrice;
      const shouldFill =
        order.side === "long"
          ? mark <= order.limitPrice
          : mark >= order.limitPrice;
      if (!shouldFill) continue;
      const result = localOpenPosition({
        simUserId: simUser.id,
        symbol: order.symbol,
        productType: order.productType,
        side: order.side,
        leverage: order.leverage,
        entryPrice: order.limitPrice,
        quantity: order.qty,
      });
      if (result.error) {
        // 잔액 부족 등 — order 는 pending 유지, 다음 갱신에서 재시도.
        continue;
      }
      updateLocalOrder(simUser.id, order.id, {
        status: "filled",
        filledAt: Date.now(),
        filledPrice: order.limitPrice,
      });
    }
    // localPendingOrders 가 dep 에 빠진 건 의도적 (위 mark-to-market 과
    // 무한 루프 방지). 다음 ticker 갱신에서 자연스럽게 재실행됨.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useLocalMode, simUser?.id, ticker]);

  /** 로컬 모드에서 mutation 결과 errors 표시용 */
  const [localError, setLocalError] = useState<string | null>(null);

  // ── Handlers ──────────────────────────────────────────────
  const submitOrder = useCallback(
    (forSide: "long" | "short") => {
      if (!simUser?.id) return;
      if (productType === "spot" && forSide === "short") return;
      if (qty <= 0 || effectivePrice <= 0) return;
      setSide(forSide);
      setLocalError(null);

      if (useLocalMode) {
        if (orderType === "limit") {
          // Limit 주문: 즉시 체결하지 않고 pending order 로 저장.
          // ticker 갱신 시 트리거 useEffect 가 limitPrice 검사 후 자동 체결.
          if (!effectivePrice || effectivePrice <= 0) {
            setLocalError("Limit price 입력 필요");
            return;
          }
          addLocalOrder({
            simUserId: simUser.id,
            symbol,
            productType,
            side: forSide,
            type: "limit",
            qty,
            limitPrice: effectivePrice,
            leverage: productType === "spot" ? 1 : leverage,
            marginMode,
          });
          setQtyText("");
          return;
        }
        // Market 주문 — 기존 흐름 (즉시 position 생성).
        const result = localOpenPosition({
          simUserId: simUser.id,
          symbol,
          productType,
          side: forSide,
          leverage: productType === "spot" ? 1 : leverage,
          entryPrice: effectivePrice,
          quantity: qty,
        });
        if (result.error) setLocalError(result.error);
        else setQtyText("");
        return;
      }

      openMutation.mutate({
        simUserId: simUser.id,
        symbol,
        productType,
        side: forSide,
        leverage: productType === "spot" ? 1 : leverage,
        quantity: qty,
        entryPrice: orderType === "market" ? undefined : effectivePrice,
        orderType,
        marginMode,
      });
    },
    [
      simUser?.id,
      useLocalMode,
      openMutation,
      symbol,
      productType,
      leverage,
      qty,
      orderType,
      effectivePrice,
      marginMode,
    ],
  );

  const handleCancelOrder = (orderId: string) => {
    if (!simUser?.id) return;
    if (!useLocalMode) return;
    cancelLocalOrder(simUser.id, orderId);
  };

  const handleClose = (positionId: number) => {
    if (!simUser?.id) return;
    setLocalError(null);
    if (useLocalMode) {
      const result = localClosePosition({
        simUserId: simUser.id,
        positionId,
        exitPrice: currentPrice,
        reason: "manual",
      });
      if (result.error) setLocalError(result.error);
      return;
    }
    closeMutation.mutate({ simUserId: simUser.id, positionId });
  };

  const handleReset = () => {
    if (!simUser?.id) return;
    if (
      !window.confirm(
        "계정을 초기화하면 모든 open 포지션이 강제 청산되고 $200,000 으로 리셋됩니다. 진행할까요?",
      )
    )
      return;
    if (useLocalMode) {
      localResetAccount(simUser.id);
      setLocalError(null);
      return;
    }
    resetMutation.mutate({ simUserId: simUser.id });
  };

  const handleRefresh = () => {
    if (!simUser?.id) return;
    if (useLocalMode) {
      if (ticker) {
        localMarkToMarket(simUser.id, new Map([[ticker.symbol, ticker.lastPrice]]));
      }
      return;
    }
    refreshMutation.mutate({ simUserId: simUser.id });
  };

  const handleSignOut = () => {
    if (
      !window.confirm(
        "닉네임을 변경하면 새로운 시뮬레이션 계정이 만들어집니다 (현재 포지션/거래내역은 서버에 남아있으나 본 브라우저에서는 더 이상 접근 불가). 진행할까요?",
      )
    )
      return;
    signOut();
  };

  /**
   * Export — 현재 localStorage 의 sim 데이터를 JSON 파일로 다운로드.
   *
   * AUDIT.md §2.4 (local-only 적응 — S3 audit log 대신 사용자 파일 백업).
   * 로컬 모드뿐 아니라 백엔드 모드에서도 사용 가능 (localStorage cache 백업용).
   */
  const handleExport = useCallback(() => {
    const json = exportSimData();
    try {
      const parsed = JSON.parse(json) as { data?: Record<string, string> };
      const keyCount = parsed.data ? Object.keys(parsed.data).length : 0;
      if (keyCount === 0) {
        toast.warning("내보낼 시뮬레이터 데이터가 없습니다.");
        return;
      }
    } catch {
      // 검증 실패해도 export 자체는 진행
    }
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    a.href = url;
    a.download = `tradelab-simulator-backup-${date}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("백업 다운로드 완료");
  }, []);

  /** Import 버튼 → 숨겨진 file input 클릭 트리거. */
  const handleImportClick = useCallback(() => {
    importFileInputRef.current?.click();
  }, []);

  /**
   * 사용자가 JSON 파일을 선택하면 → 확인 dialog → localStorage 복원 → reload.
   *
   * 복원 후 simUser hook 이 mount 시점 값을 캐싱하므로 reload 가 필요.
   */
  const handleImportFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = ""; // 같은 파일 재선택 가능하도록 reset
      if (!file) return;
      if (
        !window.confirm(
          "현재 시뮬레이터 데이터를 백업 파일로 덮어쓰시겠습니까?\n\n" +
            "- 기존 닉네임 · UUID · 포지션 · 거래 내역이 모두 교체됩니다.\n" +
            "- 본 브라우저에서만 적용.\n" +
            "- 복원 후 페이지가 자동 reload 됩니다.",
        )
      ) {
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const text = typeof reader.result === "string" ? reader.result : "";
        const result = importSimData(text);
        if (!result.ok) {
          toast.error(
            `복원 실패: ${result.error ?? "올바른 백업 파일이 아닙니다."}`,
          );
          return;
        }
        toast.success(
          `복원 완료 (${result.restored ?? 0}개 항목) — 새로고침합니다.`,
        );
        // 짧은 지연 후 reload — toast 가 시각적으로 인지될 시간 확보.
        setTimeout(() => window.location.reload(), 600);
      };
      reader.onerror = () => {
        toast.error("파일 읽기 실패");
      };
      reader.readAsText(file);
    },
    [],
  );

  /**
   * 사용자가 %  버튼을 누르면 (가용 현금 × pct%) 를 totalCost (= margin +
   * commission) 로 환산해 maxQty 를 계산.
   *
   * 기존 식 `maxQty = (usable * leverage) / price` 는 commission (0.01% ×
   * leverage) 를 무시했기 때문에 100% 슬라이더에서 totalCost > cashAvailable
   * 이 발생해 isAffordable=false → Long/Short 버튼이 disable 되었다.
   *
   * 새 식 (commission 포함):
   *   margin     = price × qty / leverage
   *   commission = price × qty × 0.0001 × leverage
   *   totalCost  = qty × (price/leverage + price × 0.0001 × leverage)
   *              = qty × costPerUnit
   *   ∴ qty = usable / costPerUnit
   *
   * 부동소수점 오차 안전망으로 0.9999 곱 (4 자리 안전 margin).
   */
  const setQtyByPercent = (pct: number) => {
    if (effectivePrice <= 0) return;
    const effLeverage = productType === "spot" ? 1 : Math.max(1, leverage);
    const usable = (cashAvailable * pct) / 100;
    const costPerUnit =
      effectivePrice / effLeverage + effectivePrice * 0.0001 * effLeverage;
    if (costPerUnit <= 0) return;
    const maxQty = usable / costPerUnit;
    const safeQty = maxQty * 0.9999;
    setQtyText(safeQty > 0 ? safeQty.toFixed(6) : "0");
  };

  // ── Bot guard: until simUser mounted ─────────────────────
  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-neon-cyan" />
      </div>
    );
  }

  // ── Onboarding flow ──────────────────────────────────────
  //
  // 🚨 React #185 fix (2026-05-18): register 성공 직후 ensureLocalAccount
  // 를 호출해 local 모드의 계정을 명시적으로 materialize.  과거에는
  // getLocalAccount 가 getSnapshot 안에서 fresh 를 만들면서 production
  // 빌드에서 무한 update loop (#185) 가 발생.  이제 mutation 은 명시적 경로.
  //
  // 백엔드 모드 (Railway DB 활성) 에서는 local account 가 materialize 되어도
  // 사용되지 않음 — useLocalMode 가 false 이므로 무해.
  if (needsRegistration) {
    return (
      <SimulatorWelcome
        onRegister={(nickname) => {
          const result = register(nickname);
          if (result) ensureLocalAccount(result.id);
          return result;
        }}
      />
    );
  }

  // ── Render simulator ─────────────────────────────────────
  return (
    <div className="flex flex-col p-2 gap-2 text-xs">
      {/* ── Top bar ──────────────────────────────────────── */}
      <div className="rounded-md border border-border/30 bg-card/60 backdrop-blur-sm px-3 py-2 flex flex-wrap items-center gap-3">
        {/* Symbol picker */}
        <Input
          value={symbol}
          onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          className="font-display font-bold text-base h-8 w-32 sm:w-40"
        />

        {/* Last + change */}
        <div className="flex items-baseline gap-2">
          <span
            className={cn(
              "font-display font-bold text-lg sm:text-xl leading-none",
              (ticker?.pctChange24h ?? 0) >= 0
                ? "text-neon-green"
                : "text-neon-red",
            )}
          >
            {ticker ? `$${formatPrice(ticker.lastPrice)}` : "—"}
          </span>
          <span
            className={cn(
              "font-mono text-xs sm:text-sm font-semibold",
              (ticker?.pctChange24h ?? 0) >= 0
                ? "text-neon-green"
                : "text-neon-red",
            )}
          >
            {ticker
              ? `${ticker.pctChange24h >= 0 ? "+" : ""}${ticker.pctChange24h.toFixed(2)}%`
              : "—"}
          </span>
        </div>

        {/* 24h stats */}
        <div className="hidden xl:flex items-center gap-3 text-[10px] font-mono">
          <StatPair label="24h H" value={ticker ? `$${formatPrice(ticker.high24h)}` : "—"} />
          <StatPair label="24h L" value={ticker ? `$${formatPrice(ticker.low24h)}` : "—"} />
          <StatPair
            label="24h Vol"
            value={ticker ? `$${(ticker.turnover24h / 1e6).toFixed(2)}M` : "—"}
          />
        </div>

        {/* Popular symbols */}
        <div className="flex gap-1 flex-wrap">
          {POPULAR_SYMBOLS.map((s) => (
            <button
              key={s}
              onClick={() => setSymbol(s)}
              className={cn(
                "px-2 py-0.5 rounded-sm border text-[10px] font-mono transition-colors",
                symbol === s
                  ? "border-neon-cyan text-neon-cyan bg-neon-cyan/10"
                  : "border-border/30 text-muted-foreground hover:border-neon-cyan/40",
              )}
            >
              {s.replace("USDT", "")}
            </button>
          ))}
        </div>

        {/* Nickname (always rightmost) */}
        <div className="flex items-center gap-2 ml-auto pl-3 border-l border-border/30">
          {editingNick ? (
            <>
              <Input
                value={nickInput}
                onChange={(e) => setNickInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setNickname(nickInput);
                    setEditingNick(false);
                  } else if (e.key === "Escape") {
                    setEditingNick(false);
                  }
                }}
                className="h-7 w-32 font-mono text-xs"
                autoFocus
              />
              <button
                onClick={() => {
                  setNickname(nickInput);
                  setEditingNick(false);
                }}
                className="text-neon-green"
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                onClick={() => setEditingNick(false)}
                className="text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </>
          ) : (
            <>
              <Wallet className="h-4 w-4 text-neon-cyan" />
              <span className="font-display font-semibold text-sm">
                {simUser?.nickname ?? "—"}
              </span>
              <button
                onClick={() => {
                  setNickInput(simUser?.nickname ?? "");
                  setEditingNick(true);
                }}
                title="닉네임 편집"
                className="text-muted-foreground hover:text-neon-cyan"
              >
                <Edit3 className="h-3 w-3" />
              </button>
              <button
                onClick={handleSignOut}
                title="다른 닉네임으로 시작"
                className="text-muted-foreground hover:text-neon-red"
              >
                <LogOut className="h-3 w-3" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Account quick bar ────────────────────────────── */}
      <div className="rounded-md border border-border/30 bg-card/40 px-3 py-2 grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-6 gap-3 items-center">
        <KV label="Cash" value={formatUSD(account?.cash ?? 0)} color="text-neon-cyan" />
        <KV
          label="Equity"
          value={formatUSD(account?.equity ?? 0)}
          color="text-neon-green"
        />
        <KV
          label="Unrealized P&L"
          value={formatUSD(account?.unrealizedPnl ?? 0)}
          color={(account?.unrealizedPnl ?? 0) >= 0 ? "text-neon-green" : "text-neon-red"}
        />
        <KV
          label="Realized P&L"
          value={formatUSD(account?.realizedPnl ?? 0)}
          color={(account?.realizedPnl ?? 0) >= 0 ? "text-neon-green" : "text-neon-red"}
        />
        <KV
          label="Positions"
          value={`${account?.openPositions ?? 0}`}
        />
        <div className="flex gap-1.5 justify-end items-center col-span-3 sm:col-span-1 flex-wrap">
          {/* Hidden file input — handleImportClick 가 클릭 트리거 */}
          <input
            ref={importFileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleImportFile}
            className="hidden"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={handleRefresh}
            disabled={refreshMutation.isPending}
            className="font-mono text-[10px] h-7"
          >
            {refreshMutation.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3 mr-1" />
            )}
            Mark
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleExport}
            className="font-mono text-[10px] h-7 text-neon-cyan hover:bg-neon-cyan/10"
            title="현재 시뮬레이터 데이터를 JSON 백업 파일로 다운로드"
          >
            <Download className="h-3 w-3 mr-1" />
            Export
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleImportClick}
            className="font-mono text-[10px] h-7 text-neon-green hover:bg-neon-green/10"
            title="JSON 백업 파일에서 시뮬레이터 데이터를 복원"
          >
            <Upload className="h-3 w-3 mr-1" />
            Import
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleReset}
            disabled={resetMutation.isPending}
            className="font-mono text-[10px] h-7 text-neon-red hover:bg-neon-red/10"
          >
            {resetMutation.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RotateCcw className="h-3 w-3 mr-1" />
            )}
            Reset
          </Button>
        </div>
      </div>

      {/* Local mode notice (backend DB unavailable) */}
      {useLocalMode && (
        <div className="rounded-md border border-neon-cyan/40 bg-neon-cyan/10 px-3 py-1.5 font-mono text-[11px] text-neon-cyan flex items-center gap-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>
            로컬 모드 (LOCAL MODE) — 백엔드 DB 비활성. 포지션 / 거래내역이 이
            브라우저에만 저장됩니다. 브라우저 캐시 삭제 시 사라집니다.
          </span>
        </div>
      )}

      {/* ── Main 3-column grid (md: 768px 부터) ─────────── */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_220px] xl:grid-cols-[1fr_240px_280px] gap-2">
        {/* Left — Chart */}
        <div className="rounded-md border border-border/30 bg-card/60 p-2 flex flex-col min-h-[420px]">
          {/* Timeframe tabs */}
          <div className="flex items-center gap-0.5 mb-2 flex-wrap">
            {SIM_TIMEFRAMES.map((tf) => (
              <button
                key={tf.value}
                onClick={() => setTimeframe(tf.value)}
                className={cn(
                  "px-2 py-0.5 rounded-sm font-mono text-[10px] uppercase transition-colors",
                  timeframe === tf.value
                    ? "bg-neon-cyan/15 text-neon-cyan border border-neon-cyan/40"
                    : "text-muted-foreground border border-transparent hover:bg-muted/30",
                )}
              >
                {tf.label}
              </button>
            ))}
            <div className="ml-auto font-mono text-[10px] text-muted-foreground flex items-center gap-2">
              {candlesLoading && <Loader2 className="h-3 w-3 animate-spin" />}
              <span className="hidden sm:inline">{symbol} · {candles.length}c</span>
            </div>
          </div>
          {/* Chart */}
          <div className="flex-1 min-h-[380px]">
            {candles.length > 0 ? (
              <CandleChartLW
                candles={candles}
                currentPrice={currentPrice}
                height={420}
                showLegend={false}
                positionLines={chartPositionLines}
                orderLines={chartOrderLines}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground font-mono">
                {candlesLoading ? "Loading…" : "No candles available"}
              </div>
            )}
          </div>
        </div>

        {/* Middle — Order Book stacked over Recent Trades */}
        <div className="grid grid-rows-[1fr_1fr] gap-2 min-h-[420px] max-h-[480px]">
          <OrderBookPanel ob={orderBook} ticker={ticker} symbol={symbol} />
          <RecentTradesPanel trades={recentTrades} symbol={symbol} />
        </div>

        {/* Right — Trade Form (xl shows separately; md/lg stacks under) */}
        <div className="rounded-md border border-border/30 bg-card/60 p-3 flex flex-col gap-2 xl:col-span-1 md:col-span-2 xl:col-auto">
          {/* Product type tabs */}
          <div className="flex gap-1">
            {(["perp", "spot"] as const).map((t) => (
              <button
                key={t}
                onClick={() => {
                  setProductType(t);
                  if (t === "spot") {
                    setLeverage(1);
                    if (side === "short") setSide("long");
                  } else if (leverage < 2) {
                    setLeverage(10);
                  }
                }}
                className={cn(
                  "flex-1 py-1 rounded-sm border text-[11px] font-mono uppercase transition-colors",
                  productType === t
                    ? "border-neon-pink text-neon-pink bg-neon-pink/10"
                    : "border-border/30 text-muted-foreground hover:border-neon-pink/40",
                )}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Margin + Leverage (perp only) */}
          {productType === "perp" && (
            <div className="grid grid-cols-2 gap-2 items-end">
              <div>
                <label className="font-mono text-[9px] uppercase text-muted-foreground mb-0.5 block">
                  Margin
                </label>
                <div className="flex gap-1">
                  {(["cross", "isolated"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setMarginMode(m)}
                      className={cn(
                        "flex-1 py-0.5 rounded-sm border text-[10px] font-mono uppercase",
                        marginMode === m
                          ? "border-neon-yellow text-neon-yellow bg-neon-yellow/10"
                          : "border-border/30 text-muted-foreground",
                      )}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="font-mono text-[9px] uppercase text-muted-foreground mb-0.5 block">
                  Leverage {leverage}x
                </label>
                <input
                  type="range"
                  min={1}
                  max={125}
                  step={1}
                  value={leverage}
                  onChange={(e) => setLeverage(parseInt(e.target.value))}
                  className="w-full accent-neon-cyan h-6"
                />
              </div>
            </div>
          )}

          {/* Order type tabs */}
          <div className="flex gap-1 border-b border-border/30">
            {(["market", "limit"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setOrderType(t)}
                className={cn(
                  "px-3 py-1 font-mono text-[11px] uppercase border-b-2 transition-colors",
                  orderType === t
                    ? "border-neon-cyan text-neon-cyan"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Price */}
          <div>
            <label className="font-mono text-[9px] uppercase text-muted-foreground mb-0.5 block">
              Price (USDT)
            </label>
            <Input
              type="text"
              inputMode="decimal"
              value={orderType === "market" ? "Market" : priceText}
              onChange={(e) => setPriceText(e.target.value)}
              disabled={orderType === "market"}
              placeholder={ticker ? formatPrice(ticker.lastPrice) : "0.00"}
              className="font-mono text-xs h-8"
            />
          </div>

          {/* Quantity */}
          <div>
            <label className="font-mono text-[9px] uppercase text-muted-foreground mb-0.5 block">
              Quantity ({symbol.replace("USDT", "")})
            </label>
            <Input
              type="text"
              inputMode="decimal"
              value={qtyText}
              onChange={(e) => setQtyText(e.target.value)}
              placeholder="0.00"
              className="font-mono text-xs h-8"
            />
            <div className="flex gap-1 mt-1">
              {[25, 50, 75, 100].map((p) => (
                <button
                  key={p}
                  onClick={() => setQtyByPercent(p)}
                  className="flex-1 py-0.5 rounded-sm border border-border/30 text-[10px] font-mono text-muted-foreground hover:border-neon-cyan/40 hover:text-neon-cyan transition-colors"
                >
                  {p}%
                </button>
              ))}
            </div>
          </div>

          {/* Buy/Sell — ALWAYS HIGH UP (Bybit style) */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button
              onClick={() => submitOrder("long")}
              disabled={!isAffordable || openMutation.isPending}
              className={cn(
                "h-10 font-display font-bold uppercase text-sm",
                "bg-neon-green hover:bg-neon-green/80 text-background",
                (!isAffordable || openMutation.isPending) && "opacity-60",
              )}
            >
              {openMutation.isPending && side === "long" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <TrendingUp className="h-4 w-4 mr-1" />
                  Buy / Long
                </>
              )}
            </Button>
            <Button
              onClick={() => submitOrder("short")}
              disabled={
                productType === "spot" ||
                openMutation.isPending ||
                !isAffordable
              }
              className={cn(
                "h-10 font-display font-bold uppercase text-sm",
                "bg-neon-red hover:bg-neon-red/80 text-background",
                (productType === "spot" || !isAffordable) && "opacity-60",
              )}
            >
              {openMutation.isPending && side === "short" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <TrendingDown className="h-4 w-4 mr-1" />
                  Sell / Short
                </>
              )}
            </Button>
          </div>

          {/* Order summary */}
          <div className="grid grid-cols-2 gap-y-0.5 gap-x-3 text-[10px] font-mono mt-1 pt-1 border-t border-border/20">
            <span className="text-muted-foreground">Value</span>
            <span className="text-right text-foreground">{formatUSD(positionValue)}</span>
            <span className="text-muted-foreground">Margin</span>
            <span className="text-right text-foreground">{formatUSD(margin)}</span>
            <span className="text-muted-foreground">Fee (0.01%)</span>
            <span className="text-right text-neon-yellow">{formatUSD(commission)}</span>
            <span className="text-muted-foreground">Total Cost</span>
            <span
              className={cn(
                "text-right font-bold",
                isAffordable ? "text-neon-green" : "text-neon-red",
              )}
            >
              {formatUSD(totalCost)}
            </span>
            <span className="text-muted-foreground">Available</span>
            <span className="text-right text-foreground">{formatUSD(cashAvailable)}</span>
          </div>

          {/* Inline error */}
          {!isAffordable && qty > 0 && effectivePrice > 0 && (
            <div className="font-mono text-[10px] text-neon-red flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              잔액 부족
            </div>
          )}
          {openMutation.data && "error" in (openMutation.data as any) && (
            <div className="font-mono text-[10px] text-neon-red flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {String((openMutation.data as any).error)}
            </div>
          )}
          {localError && (
            <div className="font-mono text-[10px] text-neon-red flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {localError}
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom tabs ───────────────────────────────────── */}
      <div className="rounded-md border border-border/30 bg-card/60 flex flex-col">
        <div className="flex gap-0 border-b border-border/30 px-2 overflow-x-auto">
          {(
            [
              { value: "positions", label: `Positions (${positions.length})` },
              {
                value: "open-orders",
                label: `Open Orders${
                  useLocalMode ? ` (${localPendingOrders.length})` : ""
                }`,
              },
              { value: "order-history", label: "Order History" },
              { value: "trade-history", label: "Trade History" },
            ] as { value: BottomTab; label: string }[]
          ).map((t) => (
            <button
              key={t.value}
              onClick={() => setBottomTab(t.value)}
              className={cn(
                "px-3 py-2 font-mono text-[11px] uppercase border-b-2 transition-colors whitespace-nowrap",
                bottomTab === t.value
                  ? "border-neon-cyan text-neon-cyan"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="p-2 overflow-auto max-h-[280px]">
          {bottomTab === "positions" && (
            <PositionsTable
              positions={positions}
              onClose={handleClose}
              isClosing={closeMutation.isPending}
              totalCapital={
                (account?.cash ?? 0) +
                positions.reduce(
                  (s: number, p: any) =>
                    s + (typeof p.margin === "number" ? p.margin : 0),
                  0,
                )
              }
            />
          )}
          {bottomTab === "open-orders" && (
            <OpenOrdersTable
              orders={localPendingOrders}
              ticker={ticker}
              onCancel={handleCancelOrder}
              useLocalMode={useLocalMode}
            />
          )}
          {bottomTab === "order-history" && (
            <PositionsTable
              positions={closedPositions}
              onClose={handleClose}
              isClosing={false}
              showClosed
              totalCapital={
                (account?.cash ?? 0) +
                positions.reduce(
                  (s: number, p: any) =>
                    s + (typeof p.margin === "number" ? p.margin : 0),
                  0,
                )
              }
            />
          )}
          {bottomTab === "trade-history" && (
            <TradeHistoryTable transactions={transactions} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────

function StatPair({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground font-semibold">{value}</span>
    </div>
  );
}

function KV({
  label,
  value,
  color = "text-foreground",
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="flex flex-col">
      <span className="font-mono text-[9px] uppercase text-muted-foreground">
        {label}
      </span>
      <span className={cn("font-display font-bold text-xs sm:text-sm", color)}>
        {value}
      </span>
    </div>
  );
}

function OrderBookPanel({
  ob,
  ticker,
  symbol,
}: {
  ob: OrderBookSnapshot | null;
  ticker: SimTicker | null;
  symbol: string;
}) {
  const askSlice = ob?.asks.slice(0, 8).reverse() ?? [];
  const bidSlice = ob?.bids.slice(0, 8) ?? [];
  const maxSize = Math.max(
    ...askSlice.map((l) => l.size),
    ...bidSlice.map((l) => l.size),
    1,
  );

  return (
    <div className="rounded-md border border-border/30 bg-card/60 p-2 flex flex-col text-xs min-h-0 overflow-hidden">
      <div className="flex justify-between items-center mb-1 px-1">
        <span className="font-display font-bold text-foreground text-[11px]">
          Order Book
        </span>
        <span className="font-mono text-[9px] text-muted-foreground">
          {symbol}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-1 font-mono text-[9px] text-muted-foreground border-b border-border/20 pb-0.5 px-1">
        <span>Price</span>
        <span className="text-right">Size</span>
        <span className="text-right">Total</span>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0">
        <div>
          {askSlice.map((l, i) => {
            const total = askSlice.slice(i).reduce((sum, x) => sum + x.size, 0);
            return (
              <OrderBookRow
                key={`ask-${i}`}
                price={l.price}
                size={l.size}
                total={total}
                maxSize={maxSize}
                side="ask"
              />
            );
          })}
        </div>
        <div className="border-y border-border/30 py-0.5 px-1 my-0.5 flex justify-between font-mono text-[10px]">
          <span
            className={cn(
              "font-bold",
              (ticker?.pctChange24h ?? 0) >= 0
                ? "text-neon-green"
                : "text-neon-red",
            )}
          >
            {ticker ? formatPrice(ticker.lastPrice) : "—"}
          </span>
          <span className="text-muted-foreground">
            {ob && ob.asks[0] && ob.bids[0]
              ? `↕${(ob.asks[0].price - ob.bids[0].price).toFixed(2)}`
              : ""}
          </span>
        </div>
        <div>
          {bidSlice.map((l, i) => {
            const total = bidSlice
              .slice(0, i + 1)
              .reduce((sum, x) => sum + x.size, 0);
            return (
              <OrderBookRow
                key={`bid-${i}`}
                price={l.price}
                size={l.size}
                total={total}
                maxSize={maxSize}
                side="bid"
              />
            );
          })}
        </div>
        {!ob && (
          <p className="text-center text-muted-foreground font-mono text-[9px] py-2">
            Loading…
          </p>
        )}
      </div>
    </div>
  );
}

function OrderBookRow({
  price,
  size,
  total,
  maxSize,
  side,
}: {
  price: number;
  size: number;
  total: number;
  maxSize: number;
  side: "ask" | "bid";
}) {
  const pct = Math.min(100, (size / maxSize) * 100);
  return (
    <div className="relative grid grid-cols-3 gap-1 font-mono text-[10px] px-1 py-0 hover:bg-muted/20 leading-tight">
      <div
        className={cn(
          "absolute right-0 top-0 bottom-0 opacity-15",
          side === "ask" ? "bg-neon-red" : "bg-neon-green",
        )}
        style={{ width: `${pct}%` }}
      />
      <span
        className={cn(
          "relative",
          side === "ask" ? "text-neon-red" : "text-neon-green",
        )}
      >
        {formatPrice(price)}
      </span>
      <span className="text-right text-foreground relative">{formatQty(size)}</span>
      <span className="text-right text-muted-foreground relative">
        {formatQty(total)}
      </span>
    </div>
  );
}

function RecentTradesPanel({
  trades,
  symbol,
}: {
  trades: RecentTrade[];
  symbol: string;
}) {
  return (
    <div className="rounded-md border border-border/30 bg-card/60 p-2 flex flex-col text-xs min-h-0 overflow-hidden">
      <div className="flex justify-between items-center mb-1 px-1">
        <span className="font-display font-bold text-foreground text-[11px]">
          Recent Trades
        </span>
        <span className="font-mono text-[9px] text-muted-foreground">
          {symbol}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-1 font-mono text-[9px] text-muted-foreground border-b border-border/20 pb-0.5 px-1">
        <span>Price</span>
        <span className="text-right">Size</span>
        <span className="text-right">Time</span>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0">
        {trades.length === 0 ? (
          <p className="text-center text-muted-foreground font-mono text-[9px] py-2">
            Loading…
          </p>
        ) : (
          trades.slice(0, 18).map((t, i) => (
            <div
              key={i}
              className="grid grid-cols-3 gap-1 font-mono text-[10px] px-1 py-0 leading-tight hover:bg-muted/20"
            >
              <span
                className={cn(
                  t.side === "Buy" ? "text-neon-green" : "text-neon-red",
                )}
              >
                {formatPrice(t.price)}
              </span>
              <span className="text-right text-foreground">
                {formatQty(t.size)}
              </span>
              <span className="text-right text-muted-foreground">
                {new Date(t.ts).toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  hour12: false,
                })}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function PositionsTable({
  positions,
  onClose,
  isClosing,
  showClosed = false,
  totalCapital = 0,
}: {
  positions: any[];
  onClose: (id: number) => void;
  isClosing: boolean;
  showClosed?: boolean;
  /**
   * Phase 2 #1: Margin 컬럼의 "자본 대비 비율" 표시에 사용.
   *   총 자본 = account.cash + 모든 open position 의 margin 합산.
   * 0 이면 비율 표시는 생략 (closed 포지션 탭 등에서 자본 추정 불가 시 graceful).
   */
  totalCapital?: number;
}) {
  if (positions.length === 0) {
    return (
      <p className="text-center py-6 text-muted-foreground font-mono text-xs">
        {showClosed ? "닫힌 포지션 없음" : "보유 포지션 없음"}
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border/20 font-mono text-[10px] text-muted-foreground uppercase">
            <th className="text-left px-2 py-1.5">Symbol</th>
            <th className="text-left px-2 py-1.5">Side</th>
            <th className="text-left px-2 py-1.5">Type</th>
            <th className="text-right px-2 py-1.5">Lev</th>
            <th className="text-right px-2 py-1.5">Qty</th>
            <th
              className="text-right px-2 py-1.5"
              title="Position 에 묶인 Margin (자본 대비 비율)"
            >
              Margin
            </th>
            <th className="text-right px-2 py-1.5">Entry</th>
            <th className="text-right px-2 py-1.5">{showClosed ? "Exit" : "Mark"}</th>
            <th className="text-right px-2 py-1.5">Liq Price</th>
            <th className="text-right px-2 py-1.5">P&L</th>
            <th className="text-right px-2 py-1.5">P&L %</th>
            {!showClosed && (
              <th
                className="text-right px-2 py-1.5"
                title="Margin Ratio — 청산 임박도 (maintenance / current margin). 1.0 = 청산 임계."
              >
                MR
              </th>
            )}
            <th className="text-left px-2 py-1.5">{showClosed ? "Reason" : "Time"}</th>
            {!showClosed && <th className="px-2 py-1.5"></th>}
          </tr>
        </thead>
        <tbody>
          {positions.map((p: any) => {
            const mark = showClosed
              ? (p.closedPrice ?? p.entryPrice)
              : (p.currentPrice ?? p.entryPrice);
            // ✅ PnL 정확화 (AUDIT.md §1.4): leverage 곱하기 제거.
            // open 포지션: 실시간 mark price 로 unrealized PnL 계산.
            // closed 포지션: 저장된 closedPnl 그대로 사용 (백워드 호환).
            const pnl = showClosed
              ? (p.closedPnl ?? 0)
              : computeUnrealizedPnL(p.side, p.quantity, p.entryPrice, mark);
            // ROE = pnl / margin (×100 to percent).
            const pnlPct = p.margin > 0 ? (pnl / p.margin) * 100 : 0;
            // Margin Ratio — open 일 때만 계산.
            const mmr =
              typeof p.maintenanceMarginRate === "number" && p.maintenanceMarginRate > 0
                ? p.maintenanceMarginRate
                : DEFAULT_MAINTENANCE_MARGIN_RATE;
            const marginRatio =
              !showClosed && p.margin > 0
                ? computeMarginRatio(
                    p.side,
                    p.quantity,
                    p.entryPrice,
                    mark,
                    p.margin,
                    mmr,
                  )
                : null;
            const marginRatioColor =
              marginRatio != null ? getMarginRatioColor(marginRatio) : "";

            // Liq price: 신규 필드 우선, 없으면 legacy liquidationPrice fallback.
            const liqPrice: number | null =
              typeof p.liqPrice === "number" && p.liqPrice > 0
                ? p.liqPrice
                : typeof p.liquidationPrice === "number" && p.liquidationPrice > 0
                  ? p.liquidationPrice
                  : null;

            // 청산까지 거리 (%). 양수 = 안전 여유. open 일 때만 계산.
            let liqDistancePct: number | null = null;
            if (!showClosed && liqPrice != null && mark > 0) {
              liqDistancePct =
                p.side === "long"
                  ? ((mark - liqPrice) / mark) * 100
                  : ((liqPrice - mark) / mark) * 100;
            }
            // 색상 단계: <1% 위험 (red), 1~5% 경고 (yellow), >5% 정상 (muted).
            const liqColor = showClosed
              ? "text-muted-foreground"
              : liqDistancePct == null
                ? "text-muted-foreground"
                : liqDistancePct < 1
                  ? "text-neon-red"
                  : liqDistancePct < 5
                    ? "text-neon-yellow"
                    : "text-muted-foreground";

            const isLiquidated =
              p.status === "liquidated" || p.closedReason === "liquidation";

            return (
              <tr
                key={p.id}
                className="border-b border-border/10 font-mono text-[11px] hover:bg-muted/10"
              >
                <td className="px-2 py-1.5 text-foreground font-semibold">
                  {p.symbol.replace("USDT", "")}
                </td>
                <td className="px-2 py-1.5">
                  <Badge
                    className={cn(
                      "font-mono text-[9px] uppercase",
                      p.side === "long"
                        ? "bg-neon-green/15 text-neon-green border-neon-green/40"
                        : "bg-neon-red/15 text-neon-red border-neon-red/40",
                    )}
                  >
                    {p.side}
                  </Badge>
                </td>
                <td className="px-2 py-1.5 text-muted-foreground uppercase">
                  {p.productType}
                </td>
                <td className="px-2 py-1.5 text-right text-foreground">
                  {p.leverage}×
                </td>
                <td className="px-2 py-1.5 text-right text-foreground">
                  {formatQty(p.quantity)}
                </td>
                {/* Phase 2 #1: Margin 사용량 + 자본 대비 비율. */}
                <td
                  className="px-2 py-1.5 text-right text-muted-foreground"
                  title={`Margin: ${formatUSD(p.margin ?? 0)}${
                    totalCapital > 0
                      ? ` · 자본 대비 ${((p.margin / totalCapital) * 100).toFixed(1)}%`
                      : ""
                  }`}
                >
                  {formatUSD(p.margin ?? 0)}
                  {totalCapital > 0 && p.margin > 0 && (
                    <span className="block text-[9px] opacity-70">
                      {((p.margin / totalCapital) * 100).toFixed(1)}%
                    </span>
                  )}
                </td>
                <td className="px-2 py-1.5 text-right text-foreground">
                  ${formatPrice(p.entryPrice)}
                </td>
                <td className="px-2 py-1.5 text-right text-foreground">
                  ${formatPrice(mark)}
                </td>
                <td className={cn("px-2 py-1.5 text-right", liqColor)}>
                  {liqPrice != null ? `$${formatPrice(liqPrice)}` : "—"}
                  {liqDistancePct != null && !showClosed && (
                    <span className="block text-[9px] opacity-70">
                      {liqDistancePct >= 0 ? "" : ""}
                      {liqDistancePct.toFixed(2)}% 여유
                    </span>
                  )}
                </td>
                <td
                  className={cn(
                    "px-2 py-1.5 text-right font-bold",
                    pnl >= 0 ? "text-neon-green" : "text-neon-red",
                  )}
                >
                  {pnl >= 0 ? "+" : ""}
                  {formatUSD(pnl)}
                </td>
                <td
                  className={cn(
                    "px-2 py-1.5 text-right",
                    pnl >= 0 ? "text-neon-green/80" : "text-neon-red/80",
                  )}
                >
                  {pnlPct >= 0 ? "+" : ""}
                  {pnlPct.toFixed(2)}%
                </td>
                {!showClosed && (
                  <td
                    className={cn(
                      "px-2 py-1.5 text-right font-mono",
                      marginRatioColor,
                    )}
                    title={
                      marginRatio != null
                        ? `Margin Ratio ${(marginRatio * 100).toFixed(1)}% (maintenance / current margin). 1.0 = 청산 임계.`
                        : undefined
                    }
                  >
                    {marginRatio == null || !isFinite(marginRatio)
                      ? "—"
                      : `${(marginRatio * 100).toFixed(1)}%`}
                  </td>
                )}
                <td className="px-2 py-1.5 text-muted-foreground text-[10px]">
                  {showClosed ? (
                    isLiquidated ? (
                      <Badge className="font-mono text-[9px] uppercase bg-neon-red/15 text-neon-red border-neon-red/40">
                        강제청산
                      </Badge>
                    ) : (
                      <span>수동 종료</span>
                    )
                  ) : (
                    new Date(p.openedAt).toLocaleString("ko-KR", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  )}
                </td>
                {!showClosed && (
                  <td className="px-2 py-1.5 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onClose(p.id)}
                      disabled={isClosing}
                      className="h-6 px-2 font-mono text-[10px]"
                    >
                      {isClosing ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        "Close"
                      )}
                    </Button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function OpenOrdersTable({
  orders,
  ticker,
  onCancel,
  useLocalMode,
}: {
  orders: SimOrder[];
  ticker: SimTicker | null;
  onCancel: (id: string) => void;
  useLocalMode: boolean;
}) {
  if (!useLocalMode) {
    return (
      <p className="text-center py-6 text-muted-foreground font-mono text-xs">
        백엔드 모드에서는 Open Orders 가 거래소 측에서 관리됩니다. (현재 페이지는
        local-only 모의투자 모드 전용)
      </p>
    );
  }
  if (orders.length === 0) {
    return (
      <p className="text-center py-6 text-muted-foreground font-mono text-xs">
        <ClipboardList className="h-4 w-4 inline-block mr-1 -mt-0.5 opacity-60" />
        Pending orders 없음 — Limit 주문을 제출하면 여기 표시됩니다.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border/20 font-mono text-[10px] text-muted-foreground uppercase">
            <th className="text-left px-2 py-1.5">Symbol</th>
            <th className="text-left px-2 py-1.5">Side</th>
            <th className="text-left px-2 py-1.5">Type</th>
            <th className="text-right px-2 py-1.5">Lev</th>
            <th className="text-right px-2 py-1.5">Qty</th>
            <th className="text-right px-2 py-1.5">Limit</th>
            <th className="text-right px-2 py-1.5">Mark</th>
            <th className="text-right px-2 py-1.5">Distance</th>
            <th className="text-left px-2 py-1.5">Time</th>
            <th className="px-2 py-1.5"></th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => {
            const isTickerSymbol =
              ticker?.symbol === o.symbol && ticker.lastPrice > 0;
            const mark = isTickerSymbol ? ticker!.lastPrice : null;
            const distancePct =
              mark != null && o.limitPrice && o.limitPrice > 0
                ? ((o.limitPrice - mark) / mark) * 100
                : null;
            // LONG limit: limit 이 mark 보다 낮을 때 정상 (체결 대기 = 가격 하락 기대)
            // SHORT limit: limit 이 mark 보다 높을 때 정상 (체결 대기 = 가격 상승 기대)
            return (
              <tr
                key={o.id}
                className="border-b border-border/10 font-mono text-[11px] hover:bg-muted/10"
              >
                <td className="px-2 py-1.5 text-foreground font-semibold">
                  {o.symbol.replace("USDT", "")}
                </td>
                <td className="px-2 py-1.5">
                  <Badge
                    className={cn(
                      "font-mono text-[9px] uppercase",
                      o.side === "long"
                        ? "bg-neon-green/15 text-neon-green border-neon-green/40"
                        : "bg-neon-red/15 text-neon-red border-neon-red/40",
                    )}
                  >
                    {o.side}
                  </Badge>
                </td>
                <td className="px-2 py-1.5">
                  <Badge className="font-mono text-[9px] uppercase bg-neon-cyan/15 text-neon-cyan border-neon-cyan/40">
                    {o.type}
                  </Badge>
                </td>
                <td className="px-2 py-1.5 text-right text-foreground">
                  {o.leverage}×
                </td>
                <td className="px-2 py-1.5 text-right text-foreground">
                  {formatQty(o.qty)}
                </td>
                <td className="px-2 py-1.5 text-right text-neon-cyan">
                  {o.limitPrice ? `$${formatPrice(o.limitPrice)}` : "—"}
                </td>
                <td className="px-2 py-1.5 text-right text-foreground">
                  {mark != null ? `$${formatPrice(mark)}` : "—"}
                </td>
                <td
                  className={cn(
                    "px-2 py-1.5 text-right",
                    distancePct == null
                      ? "text-muted-foreground"
                      : Math.abs(distancePct) < 0.5
                        ? "text-neon-yellow"
                        : "text-muted-foreground",
                  )}
                >
                  {distancePct != null
                    ? `${distancePct >= 0 ? "+" : ""}${distancePct.toFixed(2)}%`
                    : "—"}
                </td>
                <td className="px-2 py-1.5 text-muted-foreground text-[10px]">
                  {new Date(o.createdAt).toLocaleString("ko-KR", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </td>
                <td className="px-2 py-1.5 text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onCancel(o.id)}
                    className="h-6 px-2 font-mono text-[10px] text-neon-red hover:bg-neon-red/10"
                    title="주문 취소"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TradeHistoryTable({ transactions }: { transactions: any[] }) {
  if (transactions.length === 0) {
    return (
      <p className="text-center py-6 text-muted-foreground font-mono text-xs">
        거래 내역 없음
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border/20 font-mono text-[10px] text-muted-foreground uppercase">
            <th className="text-left px-2 py-1.5">Time</th>
            <th className="text-left px-2 py-1.5">Type</th>
            <th className="text-left px-2 py-1.5">Symbol</th>
            <th className="text-right px-2 py-1.5">Price</th>
            <th className="text-right px-2 py-1.5">Amount</th>
            <th className="text-left px-2 py-1.5">Note</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx: any) => (
            <tr
              key={tx.id}
              className="border-b border-border/10 font-mono text-[11px]"
            >
              <td className="px-2 py-1.5 text-muted-foreground text-[10px] whitespace-nowrap">
                {new Date(tx.ts).toLocaleString("ko-KR", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </td>
              <td className="px-2 py-1.5">
                <Badge
                  className={cn(
                    "font-mono text-[9px] uppercase",
                    tx.type === "open" &&
                      "bg-neon-cyan/15 text-neon-cyan border-neon-cyan/40",
                    tx.type === "close" &&
                      "bg-neon-green/15 text-neon-green border-neon-green/40",
                    tx.type === "commission" &&
                      "bg-neon-yellow/15 text-neon-yellow border-neon-yellow/40",
                    tx.type === "funding" &&
                      "bg-orange-500/15 text-orange-400 border-orange-500/40",
                    tx.type === "deposit" &&
                      "bg-neon-pink/15 text-neon-pink border-neon-pink/40",
                    tx.type === "liquidation" &&
                      "bg-neon-red/15 text-neon-red border-neon-red/40",
                  )}
                >
                  {tx.type}
                </Badge>
              </td>
              <td className="px-2 py-1.5 text-foreground">{tx.symbol ?? "—"}</td>
              <td className="px-2 py-1.5 text-right text-foreground">
                {tx.price ? `$${formatPrice(tx.price)}` : "—"}
              </td>
              <td
                className={cn(
                  "px-2 py-1.5 text-right",
                  tx.amount >= 0 ? "text-neon-green" : "text-neon-red",
                )}
              >
                {tx.amount >= 0 ? "+" : ""}
                {formatUSD(tx.amount)}
              </td>
              <td className="px-2 py-1.5 text-muted-foreground text-[10px]">
                {tx.note}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
