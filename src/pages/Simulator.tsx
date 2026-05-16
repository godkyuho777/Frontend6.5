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

import { useState, useEffect, useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { CandleChartLW } from "@/components/CandleChartLW";
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
  getLocalAccount,
  getLocalPositions,
  getLocalTransactions,
  computeLocalEquity,
  localOpenPosition,
  localClosePosition,
  localResetAccount,
  localMarkToMarket,
} from "@/lib/sim-local-store";
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

type BottomTab = "positions" | "order-history" | "trade-history";

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

  /** Local store revision counter — increment to force re-read after mutation */
  const [localRev, setLocalRev] = useState(0);
  const bumpLocal = () => setLocalRev((r) => r + 1);

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
  const useLocalMode = !!simUser?.id && isBackendUnavailable;

  // ── Derived (backend OR local store) ─────────────────────
  // 의존성: useLocalMode + localRev → mutation 후 자동 refresh
  // localRev 를 명시적으로 useMemo dep 에 포함시켜야 bumpLocal() 호출이 실제
  // 재계산을 유발한다 (`void localRev;` 만으로는 React 가 의존성을 추적하지 못함).
  const localAccount = useMemo(
    () =>
      simUser?.id && useLocalMode ? getLocalAccount(simUser.id) : null,
    [simUser?.id, useLocalMode, localRev],
  );
  const localEquity = useMemo(
    () =>
      simUser?.id && useLocalMode ? computeLocalEquity(simUser.id) : null,
    [simUser?.id, useLocalMode, localRev],
  );
  const localOpenPositions = useMemo(
    () =>
      simUser?.id && useLocalMode
        ? getLocalPositions(simUser.id, { includeClosed: false })
        : [],
    [simUser?.id, useLocalMode, localRev],
  );
  const localAllPositions = useMemo(
    () =>
      simUser?.id && useLocalMode && bottomTab === "order-history"
        ? getLocalPositions(simUser.id, { includeClosed: true, limit: 100 })
        : [],
    [simUser?.id, useLocalMode, bottomTab, localRev],
  );
  const localTxs = useMemo(
    () =>
      simUser?.id && useLocalMode && bottomTab === "trade-history"
        ? getLocalTransactions(simUser.id, 100)
        : [],
    [simUser?.id, useLocalMode, bottomTab, localRev],
  );

  const account = useLocalMode
    ? localAccount
      ? {
          cash: localAccount.cash,
          equity: localEquity?.equity ?? localAccount.cash,
          realizedPnl: localAccount.realizedPnl,
          totalCommission: localAccount.totalCommission,
          totalFunding: localAccount.totalFunding,
          liquidationCount: localAccount.liquidationCount,
          openPositions: localEquity?.openCount ?? 0,
          unrealizedPnl: localEquity?.unrealizedPnl ?? 0,
          available: false as const,
        }
      : null
    : accountQuery.data;

  const positions = useLocalMode ? localOpenPositions : (positionsQuery.data ?? []);
  const closedPositions = useLocalMode
    ? localAllPositions.filter((p) => p.status !== "open")
    : (allPositionsQuery.data ?? []).filter((p: any) => p.status !== "open");
  const transactions = useLocalMode ? localTxs : (transactionsQuery.data ?? []);

  const currentPrice = ticker?.lastPrice ?? 0;

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

  /** Local 모드에서 ticker 갱신 시 해당 심볼의 open 포지션을 mark-to-market. */
  useEffect(() => {
    if (!useLocalMode || !simUser?.id || !ticker) return;
    const prices = new Map<string, number>([[ticker.symbol, ticker.lastPrice]]);
    const { updated } = localMarkToMarket(simUser.id, prices);
    if (updated > 0) bumpLocal();
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
        bumpLocal();
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
      bumpLocal();
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
      bumpLocal();
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
      bumpLocal();
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

  const setQtyByPercent = (pct: number) => {
    if (effectivePrice <= 0) return;
    const usable = (cashAvailable * pct) / 100;
    const maxQty = (usable * Math.max(1, leverage)) / effectivePrice;
    setQtyText(maxQty.toFixed(6));
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
  if (needsRegistration) {
    return <SimulatorWelcome onRegister={register} />;
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
        <div className="flex gap-2 justify-end items-center col-span-3 sm:col-span-1">
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
            />
          )}
          {bottomTab === "order-history" && (
            <PositionsTable
              positions={closedPositions}
              onClose={handleClose}
              isClosing={false}
              showClosed
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
}: {
  positions: any[];
  onClose: (id: number) => void;
  isClosing: boolean;
  showClosed?: boolean;
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
            <th className="text-right px-2 py-1.5">Entry</th>
            <th className="text-right px-2 py-1.5">{showClosed ? "Exit" : "Mark"}</th>
            <th className="text-right px-2 py-1.5">P&L</th>
            <th className="text-right px-2 py-1.5">P&L %</th>
            <th className="text-left px-2 py-1.5">Time</th>
            {!showClosed && <th className="px-2 py-1.5"></th>}
          </tr>
        </thead>
        <tbody>
          {positions.map((p: any) => {
            const dir = p.side === "long" ? 1 : -1;
            const mark = showClosed
              ? (p.closedPrice ?? p.entryPrice)
              : (p.currentPrice ?? p.entryPrice);
            const pnl = showClosed
              ? (p.closedPnl ?? 0)
              : dir * (mark - p.entryPrice) * p.quantity * p.leverage;
            const pnlPct = p.margin > 0 ? (pnl / p.margin) * 100 : 0;
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
                <td className="px-2 py-1.5 text-right text-foreground">
                  ${formatPrice(p.entryPrice)}
                </td>
                <td className="px-2 py-1.5 text-right text-foreground">
                  ${formatPrice(mark)}
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
                <td className="px-2 py-1.5 text-muted-foreground text-[10px]">
                  {new Date(
                    showClosed ? p.closedAt ?? p.openedAt : p.openedAt,
                  ).toLocaleString("ko-KR", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
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
