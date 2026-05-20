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

import { useState, useEffect, useCallback, useMemo, useRef, memo } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useThrottledValue } from "@/hooks/useThrottledValue";
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
import { SimulatorOnboarding } from "@/components/SimulatorOnboarding";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  buildIdempotencyToken,
  checkAndRecordIdempotency,
  isAccountAbnormallyLarge,
  hasSeenOnboarding,
  markOnboardingShown,
  INITIAL_CASH,
  INITIAL_CASH_SANITY_THRESHOLD,
  type SimOrder,
} from "@/lib/sim-local-store";
import {
  computeUnrealizedPnL,
  computeMarginRatio,
  getMarginRatioColor,
  DEFAULT_MAINTENANCE_MARGIN_RATE,
  applySlippage,
  SLIPPAGE_PCT,
  computeSimulatorStats,
  estimateUserAvgReturnPct,
  BBDX_BASELINE,
  MIN_TRADES_FOR_COMPARISON,
  type SimulatorStats,
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
  AlertTriangle,
  BarChart3,
  HelpCircle,
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

  // ── Onboarding (Phase 4 #15) ─────────────────────────────
  //
  // 첫 진입: simUser 등록 + 모달 미표시 + 사용자가 실제 사용 가능한 상태일 때만
  // 1회 노출. mount 후 약간 지연 (50ms) — 다른 toast / overlay 와 겹치지 않도록.
  //
  // 재진입: 헤더 HelpCircle 클릭 시 setShowOnboarding(true) — onboardingShown 키는
  // 그대로 유지 (이미 mark 되어 있어 자동 노출 영향 X).
  const [showOnboarding, setShowOnboarding] = useState(false);
  const autoOnboardingHandled = useRef(false);
  useEffect(() => {
    if (!simUser?.id) return;
    if (autoOnboardingHandled.current) return;
    autoOnboardingHandled.current = true;
    if (hasSeenOnboarding()) return;
    // 약간의 지연으로 다른 mount-time alert 들 (sanity, local mode 안내) 와 분리.
    const t = window.setTimeout(() => setShowOnboarding(true), 50);
    return () => window.clearTimeout(t);
  }, [simUser?.id]);

  const handleCloseOnboarding = useCallback((_completed: boolean) => {
    // 정책: 시작하기 / 건너뛰기 / esc / overlay 모두 동일하게 mark — 사용자가
    // 한 번이라도 본 이상 자동 노출 안 함. "다시 보기" 버튼은 별도 경로.
    markOnboardingShown();
    setShowOnboarding(false);
  }, []);

  // ── Sanity Guard (Phase 4): 비정상 자본 감지 ──────────────
  //
  // 2026-05-19 이전 PnL fix 이전 빌드에서 `× leverage` 이중계산으로 cash 가
  // 비정상 수치 ($4.05T 등) 로 부풀어진 잔존 데이터를 탐지.
  // Local 모드에서만 의미 있음 (백엔드 모드는 DB 가 정상화된 상태).
  // toast 는 마운트 직후 한 번만 — sanityGuardShown ref 로 중복 차단.
  const sanityGuardShown = useRef(false);
  const isAbnormalCapital = useLocalMode && isAccountAbnormallyLarge(localAccount);
  useEffect(() => {
    if (!isAbnormalCapital) return;
    if (sanityGuardShown.current) return;
    sanityGuardShown.current = true;
    const cashStr = (localAccount?.cash ?? 0).toLocaleString("en-US", {
      maximumFractionDigits: 0,
    });
    toast.warning(`비정상 자본 감지: $${cashStr}`, {
      description:
        "이전 PnL 버그(leverage 이중계산)의 잔존 데이터일 수 있습니다. " +
        "Export 로 백업한 뒤 Reset 을 권장합니다.",
      duration: 10_000,
    });
  }, [isAbnormalCapital, localAccount?.cash]);

  // ── Simulator Stats (Phase 4 #16 일부) ──────────────────────
  //
  // closed positions 에서 winRate/avgWin/avgLoss/Expectancy/MaxDD 집계.
  // 백테스트 결과와의 직접 비교는 별도 세션 — 본 카드는 시뮬레이터 자체 stats 만.
  //
  // useMemo 로 closedPositions reference 가 안 변하면 같은 결과 재사용 →
  // 불필요한 재집계 비용 없음.
  const simulatorStats = useMemo(
    () => computeSimulatorStats(closedPositions, INITIAL_CASH),
    [closedPositions],
  );

  /**
   * Phase 4 #16: BBDX 시스템 baseline 과 사용자 stats 비교 데이터.
   *
   *   - 사용자 winRate vs BBDX winRate 차이 (퍼센트 포인트).
   *   - 사용자 expectancy 를 ROE% 로 추정해 BBDX avgReturnPct 와 비교.
   *   - 사용자 maxDrawdownPct (양수) 를 BBDX 의 |maxDrawdownPct| 와 비교.
   *
   * 표시 조건은 simulatorStats.totalTrades >= MIN_TRADES_FOR_COMPARISON.
   * 미달 시 비교 카드는 안내 텍스트만 노출.
   */
  const comparison = useMemo(() => {
    const userWinRatePct = simulatorStats.winRate * 100;
    const baselineWinRatePct = BBDX_BASELINE.winRate * 100;
    const winRateDiff = userWinRatePct - baselineWinRatePct;
    const userAvgReturnPct = estimateUserAvgReturnPct(
      simulatorStats.expectancy,
      INITIAL_CASH,
    );
    const baselineAvgReturnPct = BBDX_BASELINE.avgReturnPct;
    const avgReturnDiff = userAvgReturnPct - baselineAvgReturnPct;
    // maxDrawdownPct: 사용자는 양수 (0.05 = -5%), BBDX baseline 은 음수.
    // 절댓값으로 비교 (낮을수록 좋음).
    const userMaxDdAbs = simulatorStats.maxDrawdownPct; // 양수
    const baselineMaxDdAbs = Math.abs(BBDX_BASELINE.maxDrawdownPct);
    const maxDdDiffAbs = userMaxDdAbs - baselineMaxDdAbs; // 양수 = 사용자가 더 깊은 DD
    return {
      userWinRatePct,
      baselineWinRatePct,
      winRateDiff,
      userAvgReturnPct,
      baselineAvgReturnPct,
      avgReturnDiff,
      userMaxDdAbs,
      baselineMaxDdAbs,
      maxDdDiffAbs,
    };
  }, [simulatorStats]);

  const canCompareToBBDX =
    simulatorStats.totalTrades >= MIN_TRADES_FOR_COMPARISON;

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
   * Phase 3 #3 (2026-05-20): ticker 250ms throttle — 분봉 버벅거림 최적화.
   *
   * ticker 자체는 3 초마다 polling 이므로 자주 갱신되지 않지만, 단일 fetch
   * 안에서 같은 reference 가 setState 될 때 React 가 새 reference 로 인식해
   * 매번 mark-to-market useEffect 가 실행됐다. 250ms throttle 로 한 묶음에 한
   * 번만 처리하도록 만들어 re-render 비용 절감.
   *
   * 청산 검사는 unthrottled (즉시) 분리 — 가격이 청산가 닿는 정확한 순간을
   * 놓치면 사용자 손해.
   */
  const throttledTicker = useThrottledValue(ticker, 250);

  /**
   * Local 모드 — Mark-to-market (250ms throttle 적용).
   *
   * `localMarkToMarket` 은 내부에서 emitSimChange() 호출하므로 별도 setState
   * 트리거 불필요. 250ms 묶음으로 호출되어 chart re-render 비용을 줄인다.
   */
  useEffect(() => {
    if (!useLocalMode || !simUser?.id || !throttledTicker) return;
    const prices = new Map<string, number>([
      [throttledTicker.symbol, throttledTicker.lastPrice],
    ]);
    localMarkToMarket(simUser.id, prices);
  }, [useLocalMode, simUser?.id, throttledTicker]);

  /**
   * Local 모드 — 강제청산 검사 (unthrottled = 즉시).
   *
   * 청산가 닿는 순간을 절대 놓치면 안 되므로 throttle 적용 X.
   * 단, ticker 폴링은 3 초 주기이므로 실제 검사 빈도는 충분히 낮다.
   */
  useEffect(() => {
    if (!useLocalMode || !simUser?.id || !ticker) return;
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

  /**
   * Phase 3 #11: Submit lock — 진입 버튼 빠르게 연속 클릭으로 인한 중복 진입 방지.
   *
   * 다중 방어선:
   *   1) submitting state — 진행 중인 비동기 동안 버튼 disabled.
   *   2) Idempotency token — localStorage 에 최근 5초 token 기록, 같은 키
   *      (symbol+side+qty+price) 의 token 이 5초 이내면 거부.
   *
   * 디바운스 (시간 기반) 는 사용자가 빠르게 scale-in 하는 경우와 충돌 가능 →
   * 적용 안 함. 정확히 "같은 가격에 같은 수량" 만 차단.
   */
  const [submitting, setSubmitting] = useState(false);

  // ── Handlers ──────────────────────────────────────────────
  const submitOrder = useCallback(
    (forSide: "long" | "short") => {
      if (!simUser?.id) return;
      if (productType === "spot" && forSide === "short") return;
      if (qty <= 0 || effectivePrice <= 0) return;
      // Phase 3 #11: Submit lock — 진행 중이면 즉시 무시.
      // 본 가드는 (lock 설정 사이 동시 클릭) race condition 까지는 완전 차단 X.
      // → 그 다음 idempotency token 검사가 race 도 차단.
      if (submitting) return;
      setSide(forSide);
      setLocalError(null);

      // Phase 3 #11: Idempotency token — 같은 의도 (symbol/side/qty/price/leverage/orderType)
      // 가 5초 윈도우 안에 재호출되면 거부. localStorage 기반이므로 다중 탭에서도 작동.
      const effLeverage = productType === "spot" ? 1 : leverage;
      const idemToken = buildIdempotencyToken({
        symbol,
        side: forSide,
        qty,
        entryPrice: effectivePrice,
        leverage: effLeverage,
        orderType,
      });
      const { duplicate } = checkAndRecordIdempotency(simUser.id, idemToken);
      if (duplicate) {
        toast.warning("중복 주문 차단", {
          description: "같은 조건의 주문이 5초 이내 이미 제출되었습니다.",
        });
        return;
      }

      setSubmitting(true);
      // try/finally 로 lock 해제 보장 — 예외 / 동기 return 모두 안전.
      try {
        if (useLocalMode) {
          if (orderType === "limit") {
            // Limit 주문: 즉시 체결하지 않고 pending order 로 저장.
            // ticker 갱신 시 트리거 useEffect 가 limitPrice 검사 후 자동 체결.
            // ※ Slippage 미적용 — 사용자가 정한 가격에 체결.
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
              leverage: effLeverage,
              marginMode,
            });
            setQtyText("");
            return;
          }
          // Market 주문 — slippage 적용 (Phase 3 #9, AUDIT.md).
          // LONG : entry × (1 + 0.1%) — 사용자 손해 방향 (체결가 ↑)
          // SHORT: entry × (1 - 0.1%) — 사용자 손해 방향 (체결가 ↓)
          // PnL 은 entryPrice 가 적용 후 값이므로 자동 반영.
          const slippedEntry = applySlippage(effectivePrice, forSide);
          const result = localOpenPosition({
            simUserId: simUser.id,
            symbol,
            productType,
            side: forSide,
            leverage: effLeverage,
            entryPrice: slippedEntry,
            quantity: qty,
          });
          if (result.error) {
            setLocalError(result.error);
          } else {
            setQtyText("");
            toast.success(
              `Market ${forSide.toUpperCase()} ${symbol} 체결`,
              {
                description: `Entry $${slippedEntry.toFixed(2)} (slippage ${
                  forSide === "long" ? "+" : "-"
                }${(SLIPPAGE_PCT * 100).toFixed(2)}%)`,
              },
            );
          }
          return;
        }

        openMutation.mutate({
          simUserId: simUser.id,
          symbol,
          productType,
          side: forSide,
          leverage: effLeverage,
          quantity: qty,
          entryPrice: orderType === "market" ? undefined : effectivePrice,
          orderType,
          marginMode,
        });
      } finally {
        // 동기 path 끝에서 즉시 해제 — 백엔드 모드의 비동기 mutation 은 자체
        // openMutation.isPending state 로 별도 disabled 처리 (기존 UI 유지).
        setSubmitting(false);
      }
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
      submitting,
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
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-col p-1.5 sm:p-2 gap-1.5 sm:gap-2 text-xs">
        {/* Phase 4 #15: 신규 사용자 가이드 모달 + 다시 보기 진입점. */}
        <SimulatorOnboarding
          open={showOnboarding}
          onClose={handleCloseOnboarding}
        />
        {/* ── Top bar ──────────────────────────────────────── */}
      <div className="rounded-md border border-border/30 bg-card/60 backdrop-blur-sm px-2 sm:px-3 py-1.5 sm:py-2 flex flex-wrap items-center gap-2 sm:gap-3">
        {/* Symbol picker */}
        <Input
          value={symbol}
          onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          className="font-display font-bold text-base h-9 sm:h-8 w-28 sm:w-40"
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

        {/* Popular symbols — 모바일에서 가로 스크롤로 차지 공간 최소화 */}
        <div className="flex gap-1 overflow-x-auto sm:flex-wrap w-full sm:w-auto sm:order-none order-last -mx-2 sm:mx-0 px-2 sm:px-0 pb-0.5 sm:pb-0 scrollbar-none">
          {POPULAR_SYMBOLS.map((s) => (
            <button
              key={s}
              onClick={() => setSymbol(s)}
              className={cn(
                "px-2 py-1 sm:py-0.5 rounded-sm border text-[10px] font-mono transition-colors flex-shrink-0",
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
              {/* Phase 4 #15: Onboarding 가이드 다시 보기 — onboardingShown 키는 변경 X. */}
              <button
                onClick={() => setShowOnboarding(true)}
                title="시뮬레이터 가이드 다시 보기"
                className="text-muted-foreground hover:text-neon-cyan"
              >
                <HelpCircle className="h-3 w-3" />
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
      <div className="rounded-md border border-border/30 bg-card/40 px-2 sm:px-3 py-2 grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-6 gap-2 sm:gap-3 items-center">
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
        <div className="flex gap-1 sm:gap-1.5 justify-end items-center col-span-2 sm:col-span-1 flex-wrap">
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

      {/* 🚨 Sanity Guard — 비정상 자본 감지 (Phase 4) */}
      {isAbnormalCapital && (
        <div className="rounded-md border-2 border-neon-red/60 bg-neon-red/10 px-3 py-2 font-mono text-[11px] flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="flex items-start gap-2 flex-1">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 text-neon-red mt-0.5" />
            <div className="flex flex-col gap-0.5">
              <span className="text-neon-red font-bold uppercase tracking-wide">
                비정상 자본 감지 — Sanity Guard
              </span>
              <span className="text-foreground/90">
                현재 자본이 $
                {INITIAL_CASH_SANITY_THRESHOLD.toLocaleString("en-US", {
                  maximumFractionDigits: 0,
                })}{" "}
                을 초과합니다. 이전 PnL 버그(leverage 이중계산)의 잔존
                데이터일 가능성이 높습니다.
              </span>
              <span className="text-muted-foreground text-[10px]">
                권장: Export 로 백업 → Reset. 새 거래부터는 정확한 PnL 공식
                (Bybit Perp 표준) 이 적용됩니다.
              </span>
            </div>
          </div>
          <div className="flex gap-1.5 sm:flex-shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={handleExport}
              className="font-mono text-[10px] h-7 text-neon-cyan hover:bg-neon-cyan/10"
            >
              <Download className="h-3 w-3 mr-1" />
              Export
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleReset}
              className="font-mono text-[10px] h-7 text-neon-red hover:bg-neon-red/20 border-neon-red/60"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Reset Now
            </Button>
          </div>
        </div>
      )}

      {/* 🎯 BBDX 시스템 vs 내 거래 — 한 줄 요약 (Phase 4 #16) — 5건 이상에서만 노출 */}
      {canCompareToBBDX && (
        <BBDXComparisonOneLiner
          winRateDiff={comparison.winRateDiff}
          userWinRatePct={comparison.userWinRatePct}
          baselineWinRatePct={comparison.baselineWinRatePct}
        />
      )}

      {/* 📊 Simulator Stats (Phase 4 #16 일부) — closed trades 가 있을 때만 노출 */}
      {simulatorStats.totalTrades > 0 && (
        <div className="rounded-md border border-neon-cyan/30 bg-card/40 px-3 py-2 flex flex-col gap-1.5">
          <div className="flex items-center gap-2 text-[10px] font-mono">
            <BarChart3 className="h-3.5 w-3.5 text-neon-cyan" />
            <span className="font-display font-bold text-foreground uppercase tracking-wide">
              Simulator Stats
            </span>
            <span className="text-muted-foreground">
              · {simulatorStats.totalTrades} closed trade
              {simulatorStats.totalTrades === 1 ? "" : "s"}
            </span>
            <span className="ml-auto text-muted-foreground hidden md:inline">
              정확한 백테스트 비교는 <code className="text-neon-cyan">/backtest</code>{" "}
              페이지
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-3 gap-y-1.5">
            <KV
              label="Win Rate"
              value={`${(simulatorStats.winRate * 100).toFixed(1)}%`}
              color={
                simulatorStats.winRate >= 0.5
                  ? "text-neon-green"
                  : "text-neon-red"
              }
            />
            <KV
              label={`Avg Win (${simulatorStats.wins})`}
              value={formatUSD(simulatorStats.avgWin)}
              color="text-neon-green"
            />
            <KV
              label={`Avg Loss (${simulatorStats.losses})`}
              value={formatUSD(simulatorStats.avgLoss)}
              color="text-neon-red"
            />
            <KV
              label="Expectancy / trade"
              value={formatUSD(simulatorStats.expectancy)}
              color={
                simulatorStats.expectancy >= 0
                  ? "text-neon-green"
                  : "text-neon-red"
              }
            />
            <KV
              label={`Max DD (${(simulatorStats.maxDrawdownPct * 100).toFixed(1)}%)`}
              value={formatUSD(-simulatorStats.maxDrawdown)}
              color="text-neon-red"
            />
            <KV
              label={`Total PnL (${(simulatorStats.totalPnlPct * 100).toFixed(1)}%)`}
              value={formatUSD(simulatorStats.totalPnl)}
              color={
                simulatorStats.totalPnl >= 0
                  ? "text-neon-green"
                  : "text-neon-red"
              }
            />
          </div>
        </div>
      )}

      {/* 📊 BBDX 시스템 vs 내 거래 — 표 형태 비교 카드 (Phase 4 #16) */}
      {simulatorStats.totalTrades > 0 && (
        <BBDXComparisonCard
          canCompare={canCompareToBBDX}
          stats={simulatorStats}
          comparison={comparison}
        />
      )}

      {/* ── Main 3-column grid (md: 768px 부터) ───────────
           모바일: Chart → Trade Form → (Order Book + Recent Trades 가로)
           Order form 을 chart 바로 아래로 끌어올려 모바일 사용자가 진입 form 까지
           스크롤 거리를 최소화 (오더북/체결내역은 보조). */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_220px] xl:grid-cols-[1fr_240px_280px] gap-2">
        {/* Left — Chart */}
        <div className="rounded-md border border-border/30 bg-card/60 p-2 flex flex-col min-h-[340px] sm:min-h-[420px] order-1 md:order-none">
          {/* Timeframe tabs — 모바일에서 가로 스크롤 */}
          <div className="flex items-center gap-0.5 mb-2 overflow-x-auto sm:flex-wrap scrollbar-none">
            {SIM_TIMEFRAMES.map((tf) => (
              <button
                key={tf.value}
                onClick={() => setTimeframe(tf.value)}
                className={cn(
                  "px-2 py-1 sm:py-0.5 rounded-sm font-mono text-[10px] uppercase transition-colors flex-shrink-0",
                  timeframe === tf.value
                    ? "bg-neon-cyan/15 text-neon-cyan border border-neon-cyan/40"
                    : "text-muted-foreground border border-transparent hover:bg-muted/30",
                )}
              >
                {tf.label}
              </button>
            ))}
            <div className="ml-auto font-mono text-[10px] text-muted-foreground flex items-center gap-2 flex-shrink-0">
              {candlesLoading && <Loader2 className="h-3 w-3 animate-spin" />}
              <span className="hidden sm:inline">{symbol} · {candles.length}c</span>
            </div>
          </div>
          {/* Chart — 모바일은 320px, 데스크탑은 420px */}
          <div className="flex-1 min-h-[300px] sm:min-h-[380px]">
            {candles.length > 0 ? (
              <CandleChartLW
                candles={candles}
                currentPrice={currentPrice}
                height={typeof window !== "undefined" && window.innerWidth < 640 ? 320 : 420}
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

        {/* Middle — Order Book stacked over Recent Trades
            모바일: 가로 2-col 으로 변환 (수직 스크롤 절약) — order-3 */}
        <div className="grid grid-cols-2 md:grid-cols-1 md:grid-rows-[1fr_1fr] gap-2 min-h-[260px] sm:min-h-[420px] md:max-h-[480px] order-3 md:order-none">
          <OrderBookPanel ob={orderBook} ticker={ticker} symbol={symbol} />
          <RecentTradesPanel trades={recentTrades} symbol={symbol} />
        </div>

        {/* Right — Trade Form (xl shows separately; md/lg stacks under)
            모바일: chart 바로 아래 (order-2) — 사용자가 빠르게 주문 form 접근 */}
        <div className="rounded-md border border-border/30 bg-card/60 p-2.5 sm:p-3 flex flex-col gap-2 xl:col-span-1 md:col-span-2 xl:col-auto order-2 md:order-none">
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
          {/* Phase 3 #11: submitting state 까지 disabled 조건에 포함 — 연속 클릭 차단. */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button
              onClick={() => submitOrder("long")}
              disabled={!isAffordable || openMutation.isPending || submitting}
              className={cn(
                "h-10 font-display font-bold uppercase text-sm",
                "bg-neon-green hover:bg-neon-green/80 text-background",
                (!isAffordable || openMutation.isPending || submitting) && "opacity-60",
              )}
            >
              {(openMutation.isPending || submitting) && side === "long" ? (
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
                submitting ||
                !isAffordable
              }
              className={cn(
                "h-10 font-display font-bold uppercase text-sm",
                "bg-neon-red hover:bg-neon-red/80 text-background",
                (productType === "spot" || !isAffordable || submitting) && "opacity-60",
              )}
            >
              {(openMutation.isPending || submitting) && side === "short" ? (
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
            {/* Phase 4 #15: Margin / Fee tooltips. */}
            <TermTooltip
              label="Margin"
              content="이 포지션에 사용될 자본 (USD). positionValue / leverage. 청산 시 max(0, margin + PnL) 가 cash 로 환원됩니다."
              className="text-muted-foreground"
            />
            <span className="text-right text-foreground">{formatUSD(margin)}</span>
            <TermTooltip
              label="Fee (0.01%)"
              content="거래 수수료. positionValue × 0.01% × leverage. 본 시뮬레이터는 진입과 종료 모두에 동일 비율 적용 (Bybit Spot · Perp 표준)."
              className="text-muted-foreground"
            />
            <span className="text-right text-neon-yellow">{formatUSD(commission)}</span>
            {/* Phase 3 #9: Market 진입 시 slippage 미리보기 — LONG/SHORT 모두 손해 방향.
                Phase 4 #15: TermTooltip 으로 hover 시 정확한 설명 노출. */}
            {orderType === "market" && effectivePrice > 0 && (
              <>
                <TermTooltip
                  label={`Est. Entry (${side === "long" ? "Buy" : "Sell"})`}
                  content={`Market 주문 시 적용되는 Slippage (${(SLIPPAGE_PCT * 100).toFixed(2)}%). 실제 체결가가 예상보다 사용자에게 불리한 방향으로 결정됩니다. LONG 매수 → 체결가 ↑, SHORT 매도 → 체결가 ↓. Limit 주문은 적용 X.`}
                  className="text-muted-foreground"
                />
                <span className="text-right text-amber-300/80">
                  ${formatPrice(applySlippage(effectivePrice, side))}
                  <span className="ml-1 opacity-70">
                    ({side === "long" ? "+" : "-"}
                    {(SLIPPAGE_PCT * 100).toFixed(2)}%)
                  </span>
                </span>
              </>
            )}
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
        <div className="flex gap-0 border-b border-border/30 px-1 sm:px-2 overflow-x-auto scrollbar-none">
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
                "px-2 sm:px-3 py-2 font-mono text-[10px] sm:text-[11px] uppercase border-b-2 transition-colors whitespace-nowrap flex-shrink-0",
                bottomTab === t.value
                  ? "border-neon-cyan text-neon-cyan"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="p-1.5 sm:p-2 overflow-auto max-h-[380px] sm:max-h-[280px]">
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

      {/* Phase 2 #13: footer 면책 라벨 — 거래 화면에서도 가상 거래임을 상시 명시. */}
      <div className="mt-1 flex items-center justify-center gap-1.5 px-2 py-1 font-mono text-[9px] text-amber-300/70 text-center">
        <AlertCircle className="h-3 w-3 text-amber-400/70 flex-shrink-0" />
        <span className="leading-tight">
          가상 거래입니다 · 실제 자금 없음 · 한국 가상자산법: 투자 자문 아님
          <span className="hidden sm:inline"> · 데이터는 본 브라우저 localStorage 한정</span>
        </span>
      </div>
      </div>
    </TooltipProvider>
  );
}

// ─── Sub-components ─────────────────────────────────────────

/**
 * Phase 4 #15: 핵심 용어 hover 시 설명 tooltip.
 *
 * 사용처: PositionsTable 헤더 (Margin / Liq Price / ROE / MR) + 주문 form 의
 * Margin / Fee / Slippage 라벨. 부모는 반드시 TooltipProvider 안에 있어야 한다
 * (Simulator render root 에 이미 wrap).
 *
 * 점선 underline + cursor-help 으로 "hover 시 정보 있음" 시각 hint.
 */
function TermTooltip({
  label,
  content,
  className,
}: {
  label: React.ReactNode;
  content: React.ReactNode;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "cursor-help underline decoration-dotted decoration-muted-foreground/40 underline-offset-2",
            className,
          )}
        >
          {label}
        </span>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="max-w-xs text-[11px] font-mono leading-relaxed"
      >
        {content}
      </TooltipContent>
    </Tooltip>
  );
}

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

/**
 * Phase 3 #3 (2026-05-20): PositionRow 분리 + React.memo.
 *
 * ticker tick 마다 positions array 가 새 reference 가 되어도, 개별 row 의
 * 입력 props (id / qty / currentPrice / closedPnl 등) 가 같으면 row 자체는
 * re-render skip. 차트 + tabs + 전체 페이지의 re-render 비용 절감.
 *
 * memo eq fn: 비교는 row 가 의존하는 모든 필드를 명시. shallow ref equality
 * 가 깨져도 (parent 가 새 객체 spread) 값이 같으면 skip.
 */
interface PositionRowProps {
  p: any;
  showClosed: boolean;
  totalCapital: number;
  isClosing: boolean;
  onClose: (id: number) => void;
}

const PositionRow = memo(
  function PositionRow({
    p,
    showClosed,
    totalCapital,
    isClosing,
    onClose,
  }: PositionRowProps) {
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
      <tr className="border-b border-border/10 font-mono text-[11px] hover:bg-muted/10">
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
  },
  (prev, next) => {
    // 핵심 의존 필드만 비교 — 같으면 re-render skip.
    return (
      prev.p.id === next.p.id &&
      prev.p.quantity === next.p.quantity &&
      prev.p.entryPrice === next.p.entryPrice &&
      prev.p.currentPrice === next.p.currentPrice &&
      prev.p.closedPrice === next.p.closedPrice &&
      prev.p.closedPnl === next.p.closedPnl &&
      prev.p.status === next.p.status &&
      prev.p.margin === next.p.margin &&
      prev.p.liqPrice === next.p.liqPrice &&
      prev.showClosed === next.showClosed &&
      prev.totalCapital === next.totalCapital &&
      prev.isClosing === next.isClosing &&
      prev.onClose === next.onClose
    );
  },
);

/**
 * #14 모바일 UX: 포지션을 카드 형태로 렌더링.
 *
 * 카드 구조 (모바일 < sm):
 *   ┌────────────────────────────────────┐
 *   │ BTC   [LONG]  10x  perp       Close│  ← Symbol/Side/Lev + Close 버튼
 *   │ Entry $100  Mark $110              │  ← 가격
 *   │ Qty 0.5     Margin $50 (12%)       │  ← 수량/마진
 *   │ Liq $50 (5.3% 여유)                │  ← 청산
 *   │ +$5.00 (+10.0%)  MR 25%            │  ← PnL/MR
 *   └────────────────────────────────────┘
 */
const PositionCard = memo(
  function PositionCard({
    p,
    showClosed,
    totalCapital,
    isClosing,
    onClose,
  }: PositionRowProps) {
    const mark = showClosed
      ? (p.closedPrice ?? p.entryPrice)
      : (p.currentPrice ?? p.entryPrice);
    const pnl = showClosed
      ? (p.closedPnl ?? 0)
      : computeUnrealizedPnL(p.side, p.quantity, p.entryPrice, mark);
    const pnlPct = p.margin > 0 ? (pnl / p.margin) * 100 : 0;
    const mmr =
      typeof p.maintenanceMarginRate === "number" && p.maintenanceMarginRate > 0
        ? p.maintenanceMarginRate
        : DEFAULT_MAINTENANCE_MARGIN_RATE;
    const marginRatio =
      !showClosed && p.margin > 0
        ? computeMarginRatio(p.side, p.quantity, p.entryPrice, mark, p.margin, mmr)
        : null;
    const marginRatioColor =
      marginRatio != null ? getMarginRatioColor(marginRatio) : "";
    const liqPrice: number | null =
      typeof p.liqPrice === "number" && p.liqPrice > 0
        ? p.liqPrice
        : typeof p.liquidationPrice === "number" && p.liquidationPrice > 0
          ? p.liquidationPrice
          : null;
    let liqDistancePct: number | null = null;
    if (!showClosed && liqPrice != null && mark > 0) {
      liqDistancePct =
        p.side === "long"
          ? ((mark - liqPrice) / mark) * 100
          : ((liqPrice - mark) / mark) * 100;
    }
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
      <div className="rounded-md border border-border/30 bg-card/60 p-2.5 flex flex-col gap-1.5 font-mono text-[11px]">
        {/* Row 1 — Symbol + Side + Type + Lev + Close */}
        <div className="flex items-center gap-2">
          <span className="font-display font-bold text-sm text-foreground">
            {p.symbol.replace("USDT", "")}
          </span>
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
          <span className="text-[10px] text-muted-foreground uppercase">
            {p.productType} {p.leverage}×
          </span>
          {!showClosed && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onClose(p.id)}
              disabled={isClosing}
              className="ml-auto h-7 px-2.5 font-mono text-[10px]"
            >
              {isClosing ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                "Close"
              )}
            </Button>
          )}
          {showClosed && isLiquidated && (
            <Badge className="ml-auto font-mono text-[9px] uppercase bg-neon-red/15 text-neon-red border-neon-red/40">
              강제청산
            </Badge>
          )}
        </div>
        {/* Row 2 — PnL prominent */}
        <div className="flex items-baseline justify-between">
          <span
            className={cn(
              "font-bold text-base",
              pnl >= 0 ? "text-neon-green" : "text-neon-red",
            )}
          >
            {pnl >= 0 ? "+" : ""}
            {formatUSD(pnl)}
          </span>
          <span
            className={cn(
              "font-mono text-xs font-semibold",
              pnl >= 0 ? "text-neon-green/80" : "text-neon-red/80",
            )}
          >
            {pnlPct >= 0 ? "+" : ""}
            {pnlPct.toFixed(2)}%
          </span>
        </div>
        {/* Row 3 — 2-col grid: Entry / Mark + Qty / Margin */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px]">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Entry</span>
            <span className="text-foreground">${formatPrice(p.entryPrice)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{showClosed ? "Exit" : "Mark"}</span>
            <span className="text-foreground">${formatPrice(mark)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Qty</span>
            <span className="text-foreground">{formatQty(p.quantity)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Margin</span>
            <span className="text-foreground">
              {formatUSD(p.margin ?? 0)}
              {totalCapital > 0 && p.margin > 0 && (
                <span className="opacity-70 ml-1">
                  ({((p.margin / totalCapital) * 100).toFixed(1)}%)
                </span>
              )}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Liq</span>
            <span className={liqColor}>
              {liqPrice != null ? `$${formatPrice(liqPrice)}` : "—"}
              {liqDistancePct != null && !showClosed && (
                <span className="opacity-70 ml-1">
                  ({liqDistancePct.toFixed(1)}%)
                </span>
              )}
            </span>
          </div>
          {!showClosed && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">MR</span>
              <span className={marginRatioColor}>
                {marginRatio == null || !isFinite(marginRatio)
                  ? "—"
                  : `${(marginRatio * 100).toFixed(1)}%`}
              </span>
            </div>
          )}
          <div className="flex justify-between col-span-2">
            <span className="text-muted-foreground">
              {showClosed ? "Reason" : "Time"}
            </span>
            <span className="text-muted-foreground text-[10px]">
              {showClosed
                ? isLiquidated
                  ? "강제청산"
                  : "수동 종료"
                : new Date(p.openedAt).toLocaleString("ko-KR", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
            </span>
          </div>
        </div>
      </div>
    );
  },
  (prev, next) => {
    return (
      prev.p.id === next.p.id &&
      prev.p.quantity === next.p.quantity &&
      prev.p.entryPrice === next.p.entryPrice &&
      prev.p.currentPrice === next.p.currentPrice &&
      prev.p.closedPrice === next.p.closedPrice &&
      prev.p.closedPnl === next.p.closedPnl &&
      prev.p.status === next.p.status &&
      prev.p.margin === next.p.margin &&
      prev.p.liqPrice === next.p.liqPrice &&
      prev.showClosed === next.showClosed &&
      prev.totalCapital === next.totalCapital &&
      prev.isClosing === next.isClosing &&
      prev.onClose === next.onClose
    );
  },
);

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
    <>
    {/* #14 모바일 UX: < sm 에서 카드 변환 */}
    <div className="flex flex-col gap-2 sm:hidden">
      {positions.map((p: any) => (
        <PositionCard
          key={p.id}
          p={p}
          showClosed={showClosed}
          totalCapital={totalCapital}
          isClosing={isClosing}
          onClose={onClose}
        />
      ))}
    </div>
    <div className="overflow-x-auto hidden sm:block">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border/20 font-mono text-[10px] text-muted-foreground uppercase">
            <th className="text-left px-2 py-1.5">Symbol</th>
            <th className="text-left px-2 py-1.5">Side</th>
            <th className="text-left px-2 py-1.5">Type</th>
            <th className="text-right px-2 py-1.5">Lev</th>
            <th className="text-right px-2 py-1.5">Qty</th>
            {/* Phase 4 #15: Margin tooltip. */}
            <th className="text-right px-2 py-1.5">
              <TermTooltip
                label="Margin"
                content="이 포지션에 사용된 자본 (USD). Position 청산 시 max(0, margin + PnL) 가 cash 로 환원됩니다. 강제청산은 0 환원 (margin 전손)."
              />
            </th>
            <th className="text-right px-2 py-1.5">Entry</th>
            <th className="text-right px-2 py-1.5">{showClosed ? "Exit" : "Mark"}</th>
            {/* Phase 4 #15: Liq Price tooltip. */}
            <th className="text-right px-2 py-1.5">
              <TermTooltip
                label="Liq Price"
                content="강제 청산 가격. mark price 가 도달 시 margin 전손. LONG 은 entry 아래, SHORT 은 entry 위에 위치. 청산 임계 = 1/leverage + 유지 margin (0.5%)."
              />
            </th>
            <th className="text-right px-2 py-1.5">P&L</th>
            {/* Phase 4 #15: ROE tooltip (P&L %). */}
            <th className="text-right px-2 py-1.5">
              <TermTooltip
                label="ROE"
                content="Return on Equity — Margin 대비 수익률. 10x 레버리지 + 1% 가격 변동 = ±10% ROE. -100% 도달 시 청산 임계."
              />
            </th>
            {!showClosed && (
              <th className="text-right px-2 py-1.5">
                {/* Phase 4 #15: MR tooltip. */}
                <TermTooltip
                  label="MR"
                  content="Margin Ratio — 유지 margin / 현재 margin (청산 임박도). 0.5 미만 안전, 0.5~0.8 경고, 0.8 이상 위험, 1.0 도달 시 청산 임계."
                />
              </th>
            )}
            <th className="text-left px-2 py-1.5">{showClosed ? "Reason" : "Time"}</th>
            {!showClosed && <th className="px-2 py-1.5"></th>}
          </tr>
        </thead>
        <tbody>
          {positions.map((p: any) => (
            <PositionRow
              key={p.id}
              p={p}
              showClosed={showClosed}
              totalCapital={totalCapital}
              isClosing={isClosing}
              onClose={onClose}
            />
          ))}
        </tbody>
      </table>
    </div>
    </>
  );
}

/**
 * Phase 3 #3 (2026-05-20): OrderRow 분리 + React.memo.
 *
 * OpenOrdersTable 의 row 도 ticker 변경에 영향받지만, distance 외에는 정적.
 * tickerSymbol 과 lastPrice 만 의존 필드로 비교해 불필요한 re-render skip.
 */
interface OrderRowProps {
  o: SimOrder;
  /** ticker 가 해당 row 의 symbol 과 매칭될 때만 mark price 사용. */
  mark: number | null;
  onCancel: (id: string) => void;
}

const OrderRow = memo(
  function OrderRow({ o, mark, onCancel }: OrderRowProps) {
    const distancePct =
      mark != null && o.limitPrice && o.limitPrice > 0
        ? ((o.limitPrice - mark) / mark) * 100
        : null;
    // LONG limit: limit 이 mark 보다 낮을 때 정상 (체결 대기 = 가격 하락 기대)
    // SHORT limit: limit 이 mark 보다 높을 때 정상 (체결 대기 = 가격 상승 기대)
    return (
      <tr className="border-b border-border/10 font-mono text-[11px] hover:bg-muted/10">
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
  },
  (prev, next) => {
    return (
      prev.o.id === next.o.id &&
      prev.o.status === next.o.status &&
      prev.o.limitPrice === next.o.limitPrice &&
      prev.o.qty === next.o.qty &&
      prev.mark === next.mark &&
      prev.onCancel === next.onCancel
    );
  },
);

/**
 * #14 모바일 UX: pending limit 주문 카드 형태.
 */
const OrderCard = memo(
  function OrderCard({ o, mark, onCancel }: OrderRowProps) {
    const distancePct =
      mark != null && o.limitPrice && o.limitPrice > 0
        ? ((o.limitPrice - mark) / mark) * 100
        : null;
    return (
      <div className="rounded-md border border-border/30 bg-card/60 p-2.5 flex flex-col gap-1.5 font-mono text-[11px]">
        <div className="flex items-center gap-2">
          <span className="font-display font-bold text-sm text-foreground">
            {o.symbol.replace("USDT", "")}
          </span>
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
          <Badge className="font-mono text-[9px] uppercase bg-neon-cyan/15 text-neon-cyan border-neon-cyan/40">
            {o.type}
          </Badge>
          <span className="text-[10px] text-muted-foreground">
            {o.leverage}×
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onCancel(o.id)}
            className="ml-auto h-7 px-2.5 font-mono text-[10px] text-neon-red hover:bg-neon-red/10"
            title="주문 취소"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px]">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Limit</span>
            <span className="text-neon-cyan">
              {o.limitPrice ? `$${formatPrice(o.limitPrice)}` : "—"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Mark</span>
            <span className="text-foreground">
              {mark != null ? `$${formatPrice(mark)}` : "—"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Qty</span>
            <span className="text-foreground">{formatQty(o.qty)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Distance</span>
            <span
              className={cn(
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
            </span>
          </div>
          <div className="flex justify-between col-span-2">
            <span className="text-muted-foreground">Time</span>
            <span className="text-muted-foreground">
              {new Date(o.createdAt).toLocaleString("ko-KR", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        </div>
      </div>
    );
  },
  (prev, next) => {
    return (
      prev.o.id === next.o.id &&
      prev.o.status === next.o.status &&
      prev.o.limitPrice === next.o.limitPrice &&
      prev.o.qty === next.o.qty &&
      prev.mark === next.mark &&
      prev.onCancel === next.onCancel
    );
  },
);

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
    <>
    {/* #14 모바일 UX: < sm 에서 카드 변환 */}
    <div className="flex flex-col gap-2 sm:hidden">
      {orders.map((o) => {
        const isTickerSymbol =
          ticker?.symbol === o.symbol && ticker.lastPrice > 0;
        const mark = isTickerSymbol ? ticker!.lastPrice : null;
        return (
          <OrderCard key={o.id} o={o} mark={mark} onCancel={onCancel} />
        );
      })}
    </div>
    <div className="overflow-x-auto hidden sm:block">
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
            return (
              <OrderRow
                key={o.id}
                o={o}
                mark={mark}
                onCancel={onCancel}
              />
            );
          })}
        </tbody>
      </table>
    </div>
    </>
  );
}

/**
 * Phase 3 #3 (2026-05-20): TransactionRow 분리 + React.memo.
 *
 * 거래내역은 immutable (id 가 unique 하고 한번 생성되면 변경 X) 이므로,
 * 같은 id → 같은 결과. memo 가 거의 모든 row 의 re-render 를 제거.
 */
interface TransactionRowProps {
  tx: any;
}

const TransactionRow = memo(
  function TransactionRow({ tx }: TransactionRowProps) {
    return (
      <tr className="border-b border-border/10 font-mono text-[11px]">
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
    );
  },
  (prev, next) =>
    prev.tx.id === next.tx.id &&
    prev.tx.amount === next.tx.amount &&
    prev.tx.note === next.tx.note,
);

/**
 * #14 모바일 UX: 거래 내역 카드 형태.
 */
const TransactionCard = memo(
  function TransactionCard({ tx }: TransactionRowProps) {
    return (
      <div className="rounded-md border border-border/30 bg-card/60 p-2 flex flex-col gap-1 font-mono text-[11px]">
        <div className="flex items-center gap-2">
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
          <span className="text-foreground text-[10px]">{tx.symbol ?? "—"}</span>
          <span
            className={cn(
              "ml-auto font-bold",
              tx.amount >= 0 ? "text-neon-green" : "text-neon-red",
            )}
          >
            {tx.amount >= 0 ? "+" : ""}
            {formatUSD(tx.amount)}
          </span>
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>
            {new Date(tx.ts).toLocaleString("ko-KR", {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          <span>{tx.price ? `$${formatPrice(tx.price)}` : ""}</span>
        </div>
        {tx.note && (
          <span className="text-[10px] text-muted-foreground/80 leading-tight">
            {tx.note}
          </span>
        )}
      </div>
    );
  },
  (prev, next) =>
    prev.tx.id === next.tx.id &&
    prev.tx.amount === next.tx.amount &&
    prev.tx.note === next.tx.note,
);

function TradeHistoryTable({ transactions }: { transactions: any[] }) {
  if (transactions.length === 0) {
    return (
      <p className="text-center py-6 text-muted-foreground font-mono text-xs">
        거래 내역 없음
      </p>
    );
  }
  return (
    <>
    {/* #14 모바일 UX: < sm 에서 카드 변환 */}
    <div className="flex flex-col gap-1.5 sm:hidden">
      {transactions.map((tx: any) => (
        <TransactionCard key={tx.id} tx={tx} />
      ))}
    </div>
    <div className="overflow-x-auto hidden sm:block">
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
            <TransactionRow key={tx.id} tx={tx} />
          ))}
        </tbody>
      </table>
    </div>
    </>
  );
}

// ─── Phase 4 #16: BBDX 시스템 비교 ────────────────────────
//
// "내 거래 vs BBDX 시스템" 한 줄 요약 + 표 형태 카드.
// 표본이 부족하면 (< MIN_TRADES_FOR_COMPARISON) 비교는 회색 텍스트 안내만.

interface ComparisonValues {
  userWinRatePct: number;
  baselineWinRatePct: number;
  winRateDiff: number;
  userAvgReturnPct: number;
  baselineAvgReturnPct: number;
  avgReturnDiff: number;
  userMaxDdAbs: number;
  baselineMaxDdAbs: number;
  maxDdDiffAbs: number;
}

/**
 * 한 줄 요약 — 사용자 winRate 가 BBDX 보다 얼마나 더/덜 잘하고 있는지.
 *
 * 표시:
 *   - 양수 차이: "🎯 당신의 Win Rate XX% — BBDX 시스템 (YY%) 대비 +Zpp 우수 ⭐"
 *   - 음수 차이: "📉 당신의 Win Rate XX% — BBDX 시스템 (YY%) 대비 -Zpp. 시그널 정확히 따라가시면 개선 가능."
 *   - ±2pp 이내: "≈ 당신의 Win Rate XX% — BBDX 시스템 (YY%) 과 유사 수준."
 */
function BBDXComparisonOneLiner({
  winRateDiff,
  userWinRatePct,
  baselineWinRatePct,
}: {
  winRateDiff: number;
  userWinRatePct: number;
  baselineWinRatePct: number;
}) {
  let icon: React.ReactNode;
  let text: React.ReactNode;
  let color: string;
  let border: string;

  if (winRateDiff > 2) {
    icon = <span>🎯</span>;
    color = "text-neon-green";
    border = "border-neon-green/40 bg-neon-green/5";
    text = (
      <>
        당신의 Win Rate{" "}
        <span className="font-bold">{userWinRatePct.toFixed(1)}%</span> — BBDX 시스템 ({baselineWinRatePct.toFixed(1)}%) 대비{" "}
        <span className="font-bold">+{winRateDiff.toFixed(1)}pp 우수</span> ⭐
      </>
    );
  } else if (winRateDiff < -2) {
    icon = <span>📉</span>;
    color = "text-neon-red";
    border = "border-neon-red/40 bg-neon-red/5";
    text = (
      <>
        당신의 Win Rate{" "}
        <span className="font-bold">{userWinRatePct.toFixed(1)}%</span> — BBDX 시스템 ({baselineWinRatePct.toFixed(1)}%) 대비{" "}
        <span className="font-bold">{winRateDiff.toFixed(1)}pp</span>. 시그널을
        정확히 따라가시면 개선 가능합니다.
      </>
    );
  } else {
    icon = <span>≈</span>;
    color = "text-neon-cyan";
    border = "border-neon-cyan/40 bg-neon-cyan/5";
    text = (
      <>
        당신의 Win Rate{" "}
        <span className="font-bold">{userWinRatePct.toFixed(1)}%</span> — BBDX 시스템 ({baselineWinRatePct.toFixed(1)}%) 과 유사 수준 (±2pp).
      </>
    );
  }
  return (
    <div
      className={cn(
        "rounded-md border px-3 py-1.5 font-mono text-[11px] flex items-center gap-2",
        border,
        color,
      )}
    >
      <span className="text-base leading-none">{icon}</span>
      <span className="text-foreground/95">{text}</span>
    </div>
  );
}

/**
 * 표 형태 비교 카드 — Win Rate / Avg Return / Sharpe / Max DD / Total Trades 행.
 *
 * 표본 부족 시 (< MIN_TRADES_FOR_COMPARISON): 카드는 노출하되 본문은 안내 텍스트만.
 */
function BBDXComparisonCard({
  canCompare,
  stats,
  comparison,
}: {
  canCompare: boolean;
  stats: SimulatorStats;
  comparison: ComparisonValues;
}) {
  return (
    <div className="rounded-md border border-neon-pink/30 bg-card/40 px-3 py-2 flex flex-col gap-1.5">
      <div className="flex items-center gap-2 text-[10px] font-mono">
        <BarChart3 className="h-3.5 w-3.5 text-neon-pink" />
        <span className="font-display font-bold text-foreground uppercase tracking-wide">
          📊 BBDX 시스템 vs 내 거래
        </span>
        <span className="ml-auto text-muted-foreground hidden md:inline">
          baseline: {BBDX_BASELINE.period}
        </span>
      </div>

      {!canCompare ? (
        <p className="font-mono text-[11px] text-muted-foreground py-1">
          거래 {MIN_TRADES_FOR_COMPARISON}건 이상 누적 후 비교 가능합니다.
          (현재 {stats.totalTrades} / {MIN_TRADES_FOR_COMPARISON})
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] font-mono">
            <thead>
              <tr className="border-b border-border/20 text-[10px] text-muted-foreground uppercase">
                <th className="text-left px-2 py-1">Metric</th>
                <th className="text-right px-2 py-1">BBDX 시스템</th>
                <th className="text-right px-2 py-1">당신</th>
                <th className="text-right px-2 py-1">차이</th>
              </tr>
            </thead>
            <tbody>
              <ComparisonRow
                label="Win Rate"
                baseline={`${comparison.baselineWinRatePct.toFixed(1)}%`}
                user={`${comparison.userWinRatePct.toFixed(1)}%`}
                diff={`${comparison.winRateDiff >= 0 ? "+" : ""}${comparison.winRateDiff.toFixed(1)}pp`}
                better={comparison.winRateDiff > 0}
              />
              <ComparisonRow
                label="Avg Return / trade"
                baseline={`+${(comparison.baselineAvgReturnPct * 100).toFixed(2)}%`}
                user={`${comparison.userAvgReturnPct >= 0 ? "+" : ""}${(comparison.userAvgReturnPct * 100).toFixed(2)}%`}
                diff={`${comparison.avgReturnDiff >= 0 ? "+" : ""}${(comparison.avgReturnDiff * 100).toFixed(2)}pp`}
                better={comparison.avgReturnDiff > 0}
                title="사용자 거래당 평균 ROE 추정. 정확 분석은 /backtest 페이지."
              />
              <ComparisonRow
                label="Sharpe (approx)"
                baseline={BBDX_BASELINE.sharpe.toFixed(2)}
                user="—"
                diff="—"
                better={null}
                title="Sharpe 정확 계산은 /backtest 페이지. 시뮬레이터 표본은 분산이 커서 신뢰성 낮음."
              />
              <ComparisonRow
                label="Max Drawdown"
                baseline={`-${(comparison.baselineMaxDdAbs * 100).toFixed(1)}%`}
                user={`-${(comparison.userMaxDdAbs * 100).toFixed(1)}%`}
                diff={`${comparison.maxDdDiffAbs >= 0 ? "+" : ""}${(comparison.maxDdDiffAbs * 100).toFixed(1)}pp`}
                // 낮은 DD 가 좋음 — 사용자 DD - baseline DD 가 음수 → 더 잘함.
                better={comparison.maxDdDiffAbs < 0}
              />
              <ComparisonRow
                label="Total Trades"
                baseline={BBDX_BASELINE.totalTrades.toLocaleString("en-US")}
                user={`${stats.totalTrades}`}
                diff="—"
                better={null}
              />
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">
        baseline 출처: BBDX 백테스트 ({BBDX_BASELINE.period}). 차이가 큰 경우 —
        진입 타이밍 / slippage (0.1%) / leverage 선택 영향 가능. 정확한 비교는
        Tradelab의{" "}
        <code className="text-neon-cyan">/backtest</code> 페이지를 사용하세요.
      </p>
    </div>
  );
}

function ComparisonRow({
  label,
  baseline,
  user,
  diff,
  better,
  title,
}: {
  label: string;
  baseline: string;
  user: string;
  diff: string;
  /** true = 사용자가 더 잘함 (green), false = 더 못함 (red), null = 비교 불가 (muted). */
  better: boolean | null;
  title?: string;
}) {
  const diffColor =
    better === null
      ? "text-muted-foreground"
      : better
        ? "text-neon-green font-bold"
        : "text-neon-red font-bold";
  return (
    <tr
      className="border-b border-border/10 hover:bg-muted/10"
      title={title}
    >
      <td className="px-2 py-1 text-foreground">{label}</td>
      <td className="px-2 py-1 text-right text-muted-foreground">{baseline}</td>
      <td className="px-2 py-1 text-right text-foreground">{user}</td>
      <td className={cn("px-2 py-1 text-right", diffColor)}>{diff}</td>
    </tr>
  );
}
