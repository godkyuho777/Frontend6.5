/**
 * Investment Simulator (모의투자) — Phase 1 UI (2026-05-15).
 *
 * 가상 자금 $200,000 USD 로 모의 거래.
 *
 * 화면 구조:
 *   [Dashboard]
 *     - Cash / Equity / Realized P&L / Unrealized P&L / Commission / Funding
 *     - Reset 버튼
 *   [Open Position Form]
 *     - Ticker 입력 + 시장가 + funding rate quote
 *     - product (spot / perp) + side (long / short) + leverage + quantity
 *     - Open 버튼
 *   [Chart]
 *     - 선택 ticker 의 캔들 차트
 *   [Open Positions]
 *     - 보유 포지션 카드 (현재가 / P&L / 청산가 / Close 버튼)
 *   [Transaction History]
 *     - 최근 거래 내역
 *
 * 헌장: 본 페이지는 BBDX 시그널 시스템과 완전 분리.
 */

import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { HudPanel } from "@/components/HudPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { fetchKlines } from "@/lib/bybit-client";
import { CandleChartLW } from "@/components/CandleChartLW";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Play,
  Loader2,
  AlertCircle,
  History,
  DollarSign,
  Percent,
  Coins,
  X,
  RotateCcw,
} from "lucide-react";
import type { Candle } from "@shared/types";

const POPULAR_SYMBOLS = [
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
  "XRPUSDT",
  "BNBUSDT",
  "DOGEUSDT",
  "AVAXUSDT",
  "LINKUSDT",
];

function formatPrice(p: number): string {
  if (p === 0) return "—";
  if (p < 0.01) return p.toFixed(8);
  if (p < 1) return p.toFixed(6);
  if (p < 100) return p.toFixed(4);
  return p.toFixed(2);
}

function formatUSD(v: number): string {
  return `$${v.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function Simulator() {
  const { user, signIn } = useAuth();

  // ── State ────────────────────────────────────────────────
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [productType, setProductType] = useState<"spot" | "perp">("spot");
  const [side, setSide] = useState<"long" | "short">("long");
  const [leverage, setLeverage] = useState(1);
  const [qtyText, setQtyText] = useState("0.01");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [candlesLoading, setCandlesLoading] = useState(false);

  const isAuthed = Boolean(user);

  // ── tRPC ─────────────────────────────────────────────────
  const accountQuery = trpc.simulator.account.useQuery(undefined, {
    enabled: isAuthed,
    refetchInterval: 10_000,
  });
  const positionsQuery = trpc.simulator.positions.useQuery(undefined, {
    enabled: isAuthed,
    refetchInterval: 10_000,
  });
  const transactionsQuery = trpc.simulator.transactions.useQuery(
    { limit: 30 },
    { enabled: isAuthed, refetchInterval: 15_000 },
  );
  const quoteQuery = trpc.simulator.quote.useQuery(
    { symbol },
    {
      enabled: isAuthed && !!symbol,
      refetchInterval: 5_000,
      staleTime: 3_000,
    },
  );

  const utils = trpc.useUtils();
  const openMutation = trpc.simulator.openPosition.useMutation({
    onSuccess: () => {
      utils.simulator.account.invalidate();
      utils.simulator.positions.invalidate();
      utils.simulator.transactions.invalidate();
    },
  });
  const closeMutation = trpc.simulator.closePosition.useMutation({
    onSuccess: () => {
      utils.simulator.account.invalidate();
      utils.simulator.positions.invalidate();
      utils.simulator.transactions.invalidate();
    },
  });
  const refreshMutation = trpc.simulator.refresh.useMutation({
    onSuccess: () => {
      utils.simulator.account.invalidate();
      utils.simulator.positions.invalidate();
    },
  });
  const resetMutation = trpc.simulator.reset.useMutation({
    onSuccess: () => {
      utils.simulator.account.invalidate();
      utils.simulator.positions.invalidate();
      utils.simulator.transactions.invalidate();
    },
  });

  // ── 차트 데이터 fetch (Bybit 직접) ────────────────────────
  useEffect(() => {
    if (!symbol) return;
    setCandlesLoading(true);
    fetchKlines(symbol, "4h", 120)
      .then((data) => setCandles(data))
      .catch(() => setCandles([]))
      .finally(() => setCandlesLoading(false));
  }, [symbol]);

  // ── 계산 ──────────────────────────────────────────────────
  const account = accountQuery.data;
  const positions = positionsQuery.data ?? [];
  const transactions = transactionsQuery.data ?? [];
  const quote = quoteQuery.data;
  const currentPrice = quote?.price ?? 0;

  const qty = parseFloat(qtyText) || 0;
  const positionValue = currentPrice * qty;
  const margin = positionValue / Math.max(1, leverage);
  const commission = positionValue * 0.0001 * leverage;
  const totalCost = margin + commission;
  const cashAvailable = account?.cash ?? 0;
  const isAffordable = cashAvailable >= totalCost && qty > 0 && currentPrice > 0;

  // ── Handlers ──────────────────────────────────────────────
  function handleOpen() {
    if (!isAffordable) return;
    openMutation.mutate({
      symbol,
      productType,
      side,
      leverage: productType === "spot" ? 1 : leverage,
      quantity: qty,
      entryPrice: currentPrice,
    });
  }

  function handleClose(positionId: number) {
    closeMutation.mutate({ positionId });
  }

  function handleReset() {
    if (
      !window.confirm(
        "계정을 초기화하면 모든 open 포지션이 강제 청산되고 $200,000 으로 리셋됩니다. 진행할까요?",
      )
    )
      return;
    resetMutation.mutate();
  }

  // ── Unauthed view ─────────────────────────────────────────
  if (!isAuthed) {
    return (
      <div className="max-w-2xl mx-auto p-8">
        <HudPanel
          title="Investment Simulator"
          subtitle="$200,000 가상 자금으로 모의 거래 — 로그인 필요"
          variant="highlight"
        >
          <div className="flex flex-col items-center gap-4 py-6">
            <Wallet className="h-12 w-12 text-neon-cyan" />
            <p className="font-mono text-sm text-muted-foreground text-center">
              모의투자 기능은 로그인 후 사용 가능. 가상 자금 $200,000 USD 가 자동
              지급됩니다.
            </p>
            <Button onClick={() => signIn?.()} className="font-mono">
              로그인
            </Button>
          </div>
        </HudPanel>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 max-w-7xl mx-auto">
      {/* ── DASHBOARD ──────────────────────────────────── */}
      <HudPanel
        title="Investment Simulator Dashboard"
        subtitle="가상 자금 $200,000 USD · 실제 거래 X"
        headerRight={
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => refreshMutation.mutate()}
              disabled={refreshMutation.isPending}
              className="font-mono text-[11px] h-7"
            >
              {refreshMutation.isPending ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3 mr-1" />
              )}
              Mark to market
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleReset}
              disabled={resetMutation.isPending}
              className="font-mono text-[11px] h-7 text-neon-red hover:bg-neon-red/10"
            >
              {resetMutation.isPending ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <RotateCcw className="h-3 w-3 mr-1" />
              )}
              계정 초기화
            </Button>
          </div>
        }
      >
        {accountQuery.isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-neon-cyan" />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatBox
              label="Cash"
              value={formatUSD(account?.cash ?? 0)}
              icon={<DollarSign className="h-3 w-3" />}
              color="text-neon-cyan"
            />
            <StatBox
              label="Equity"
              value={formatUSD(account?.equity ?? 0)}
              icon={<Wallet className="h-3 w-3" />}
              color="text-neon-green"
            />
            <StatBox
              label="Unrealized P&L"
              value={formatUSD(account?.unrealizedPnl ?? 0)}
              color={
                (account?.unrealizedPnl ?? 0) >= 0
                  ? "text-neon-green"
                  : "text-neon-red"
              }
            />
            <StatBox
              label="Realized P&L"
              value={formatUSD(account?.realizedPnl ?? 0)}
              color={
                (account?.realizedPnl ?? 0) >= 0
                  ? "text-neon-green"
                  : "text-neon-red"
              }
            />
            <StatBox
              label="Commission"
              value={formatUSD(account?.totalCommission ?? 0)}
              color="text-muted-foreground"
            />
            <StatBox
              label="보유 포지션"
              value={`${account?.openPositions ?? 0}건`}
              icon={<Coins className="h-3 w-3" />}
              color="text-neon-yellow"
            />
          </div>
        )}
      </HudPanel>

      {/* ── OPEN POSITION FORM + QUOTE ─────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <HudPanel
            title="포지션 진입"
            subtitle="Ticker 입력 → 시장가 확인 → leverage / quantity 설정 후 Open"
            headerRight={<TrendingUp className="h-5 w-5 text-neon-cyan" />}
          >
            <div className="space-y-3">
              {/* Symbol selector */}
              <div>
                <label className="font-mono text-[10px] uppercase text-muted-foreground mb-1 block">
                  Ticker
                </label>
                <div className="flex gap-2 flex-wrap">
                  <Input
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                    placeholder="BTCUSDT"
                    className="font-mono text-sm max-w-xs"
                  />
                  {POPULAR_SYMBOLS.slice(0, 5).map((s) => (
                    <button
                      key={s}
                      onClick={() => setSymbol(s)}
                      className={cn(
                        "px-2 py-1 rounded-sm border text-[11px] font-mono transition-colors",
                        symbol === s
                          ? "border-neon-cyan text-neon-cyan bg-neon-cyan/10"
                          : "border-border/30 text-muted-foreground hover:border-neon-cyan/40",
                      )}
                    >
                      {s.replace("USDT", "")}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quote panel */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 rounded-sm border border-neon-cyan/20 bg-neon-cyan/5">
                <div>
                  <div className="font-mono text-[10px] uppercase text-muted-foreground">
                    Market Price
                  </div>
                  <div className="font-display font-bold text-lg text-neon-cyan">
                    {quote?.available ? `$${formatPrice(currentPrice)}` : "—"}
                  </div>
                </div>
                <div>
                  <div className="font-mono text-[10px] uppercase text-muted-foreground">
                    Funding (4h)
                  </div>
                  <div className="font-display text-sm text-foreground">
                    {((quote?.fundingRate ?? 0) * 100).toFixed(4)}%
                  </div>
                </div>
                <div>
                  <div className="font-mono text-[10px] uppercase text-muted-foreground">
                    Commission
                  </div>
                  <div className="font-display text-sm text-foreground">
                    0.01% × {leverage}x
                  </div>
                </div>
                <div>
                  <div className="font-mono text-[10px] uppercase text-muted-foreground">
                    Status
                  </div>
                  <div className="font-display text-sm">
                    {quote?.available ? (
                      <span className="text-neon-green">LIVE</span>
                    ) : (
                      <span className="text-neon-red">UNAVAILABLE</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Product type + Side + Leverage */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-mono text-[10px] uppercase text-muted-foreground mb-1 block">
                    상품
                  </label>
                  <div className="flex gap-1">
                    {(["spot", "perp"] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => {
                          setProductType(t);
                          if (t === "spot") {
                            setLeverage(1);
                            if (side === "short") setSide("long");
                          }
                        }}
                        className={cn(
                          "flex-1 py-1.5 rounded-sm border text-xs font-mono uppercase transition-colors",
                          productType === t
                            ? "border-neon-pink text-neon-pink bg-neon-pink/10"
                            : "border-border/30 text-muted-foreground hover:border-neon-pink/40",
                        )}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="font-mono text-[10px] uppercase text-muted-foreground mb-1 block">
                    방향
                  </label>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setSide("long")}
                      className={cn(
                        "flex-1 py-1.5 rounded-sm border text-xs font-mono uppercase transition-colors",
                        side === "long"
                          ? "border-neon-green text-neon-green bg-neon-green/10"
                          : "border-border/30 text-muted-foreground hover:border-neon-green/40",
                      )}
                    >
                      LONG
                    </button>
                    <button
                      onClick={() => setSide("short")}
                      disabled={productType === "spot"}
                      className={cn(
                        "flex-1 py-1.5 rounded-sm border text-xs font-mono uppercase transition-colors",
                        side === "short"
                          ? "border-neon-red text-neon-red bg-neon-red/10"
                          : productType === "spot"
                            ? "border-border/20 text-muted-foreground/40 cursor-not-allowed"
                            : "border-border/30 text-muted-foreground hover:border-neon-red/40",
                      )}
                    >
                      SHORT
                    </button>
                  </div>
                </div>
                <div>
                  <label className="font-mono text-[10px] uppercase text-muted-foreground mb-1 block">
                    레버리지 {productType === "spot" && "(spot=1x 강제)"}
                  </label>
                  <Input
                    type="number"
                    min={1}
                    max={productType === "spot" ? 1 : 125}
                    value={leverage}
                    onChange={(e) =>
                      setLeverage(Math.max(1, parseInt(e.target.value) || 1))
                    }
                    disabled={productType === "spot"}
                    className="font-mono text-sm"
                  />
                </div>
              </div>

              {/* Quantity */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-mono text-[10px] uppercase text-muted-foreground mb-1 block">
                    수량 (코인 단위)
                  </label>
                  <Input
                    type="text"
                    value={qtyText}
                    onChange={(e) => setQtyText(e.target.value)}
                    placeholder="0.01"
                    className="font-mono text-sm"
                  />
                </div>
                <div className="sm:col-span-2 p-3 rounded-sm border border-border/20 bg-background/30">
                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                    <div>
                      <span className="text-muted-foreground">Position Value</span>
                      <div className="text-foreground font-bold">
                        {formatUSD(positionValue)}
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Margin Required</span>
                      <div className="text-foreground font-bold">
                        {formatUSD(margin)}
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Commission</span>
                      <div className="text-neon-yellow">{formatUSD(commission)}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Total Cost</span>
                      <div
                        className={cn(
                          "font-bold",
                          isAffordable ? "text-neon-green" : "text-neon-red",
                        )}
                      >
                        {formatUSD(totalCost)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Open button */}
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleOpen}
                  disabled={!isAffordable || openMutation.isPending}
                  className="bg-neon-cyan text-background hover:bg-neon-cyan/80 font-mono"
                >
                  {openMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4 mr-2" />
                  )}
                  포지션 진입
                </Button>
                {!isAffordable && qty > 0 && currentPrice > 0 && (
                  <span className="font-mono text-[11px] text-neon-red flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    잔액 부족 (필요 {formatUSD(totalCost)} / 현재{" "}
                    {formatUSD(cashAvailable)})
                  </span>
                )}
                {openMutation.data && "error" in openMutation.data && (
                  <span className="font-mono text-[11px] text-neon-red">
                    {String(openMutation.data.error)}
                  </span>
                )}
              </div>
            </div>
          </HudPanel>
        </div>

        {/* Chart */}
        <div>
          <HudPanel
            title={`${symbol} 4H Chart`}
            subtitle="최근 120 캔들"
            headerRight={
              candlesLoading && <Loader2 className="h-4 w-4 animate-spin" />
            }
          >
            {candles.length > 0 ? (
              <CandleChartLW
                candles={candles}
                currentPrice={currentPrice}
                height={300}
                showLegend={false}
              />
            ) : (
              <p className="font-mono text-xs text-muted-foreground text-center py-12">
                {candlesLoading ? "차트 로딩 중..." : "캔들 데이터 없음"}
              </p>
            )}
          </HudPanel>
        </div>
      </div>

      {/* ── OPEN POSITIONS ──────────────────────────────── */}
      <HudPanel
        title="보유 포지션"
        subtitle={`${positions.length}건 · mark-to-market`}
        headerRight={<Coins className="h-5 w-5 text-neon-yellow" />}
      >
        {positions.length === 0 ? (
          <p className="font-mono text-sm text-muted-foreground text-center py-6">
            보유 포지션 없음. 위에서 진입 가능.
          </p>
        ) : (
          <div className="space-y-2">
            {positions.map((p: any) => (
              <PositionCard
                key={p.id}
                position={p}
                onClose={() => handleClose(p.id)}
                isClosing={closeMutation.isPending}
              />
            ))}
          </div>
        )}
      </HudPanel>

      {/* ── TRANSACTION HISTORY ─────────────────────────── */}
      <HudPanel
        title="거래 내역"
        subtitle={`최근 ${transactions.length}건`}
        headerRight={<History className="h-5 w-5 text-muted-foreground" />}
      >
        {transactions.length === 0 ? (
          <p className="font-mono text-sm text-muted-foreground text-center py-6">
            거래 내역 없음.
          </p>
        ) : (
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-background/90 backdrop-blur">
                <tr className="border-b border-border/20 font-mono text-[10px] text-muted-foreground">
                  <th className="text-left px-2 py-2">Time</th>
                  <th className="text-left px-2 py-2">Type</th>
                  <th className="text-left px-2 py-2">Symbol</th>
                  <th className="text-right px-2 py-2">Amount</th>
                  <th className="text-left px-2 py-2">Note</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx: any) => (
                  <tr key={tx.id} className="border-b border-border/10">
                    <td className="px-2 py-1.5 font-mono text-[10px] text-muted-foreground whitespace-nowrap">
                      {new Date(tx.ts).toLocaleString("ko-KR", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-2 py-1.5 font-mono text-[10px]">
                      <Badge
                        className={cn(
                          "font-mono text-[9px] uppercase",
                          tx.type === "open" && "bg-neon-cyan/20 text-neon-cyan",
                          tx.type === "close" && "bg-neon-green/20 text-neon-green",
                          tx.type === "commission" &&
                            "bg-neon-yellow/20 text-neon-yellow",
                          tx.type === "funding" && "bg-orange-500/20 text-orange-400",
                          tx.type === "deposit" && "bg-neon-pink/20 text-neon-pink",
                          tx.type === "liquidation" && "bg-neon-red/20 text-neon-red",
                        )}
                      >
                        {tx.type}
                      </Badge>
                    </td>
                    <td className="px-2 py-1.5 font-mono text-[10px]">
                      {tx.symbol ?? "—"}
                    </td>
                    <td
                      className={cn(
                        "px-2 py-1.5 font-mono text-[10px] text-right",
                        tx.amount >= 0 ? "text-neon-green" : "text-neon-red",
                      )}
                    >
                      {tx.amount >= 0 ? "+" : ""}
                      {formatUSD(tx.amount)}
                    </td>
                    <td className="px-2 py-1.5 font-mono text-[10px] text-muted-foreground">
                      {tx.note}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </HudPanel>
    </div>
  );
}

// ── Sub Components ────────────────────────────────────────────

function StatBox({
  label,
  value,
  icon,
  color = "text-foreground",
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  color?: string;
}) {
  return (
    <div className="rounded-sm border border-border/20 bg-background/30 p-3">
      <div className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground uppercase">
        {icon}
        <span>{label}</span>
      </div>
      <div className={cn("font-display font-bold text-base mt-1", color)}>
        {value}
      </div>
    </div>
  );
}

function PositionCard({
  position,
  onClose,
  isClosing,
}: {
  position: any;
  onClose: () => void;
  isClosing: boolean;
}) {
  const direction = position.side === "long" ? 1 : -1;
  const currentPrice = position.currentPrice ?? position.entryPrice;
  const pnl =
    direction *
    (currentPrice - position.entryPrice) *
    position.quantity *
    position.leverage;
  const pnlPct = (pnl / position.margin) * 100;
  const isProfit = pnl >= 0;

  return (
    <div
      className={cn(
        "rounded-md border p-3 transition-colors",
        isProfit
          ? "border-neon-green/30 bg-neon-green/5"
          : "border-neon-red/30 bg-neon-red/5",
      )}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
        <div className="flex items-center gap-2">
          <span className="font-display font-bold text-base text-foreground">
            {position.symbol.replace("USDT", "")}
          </span>
          <Badge
            className={cn(
              "font-mono text-[10px]",
              position.side === "long"
                ? "bg-neon-green/20 text-neon-green border-neon-green/40"
                : "bg-neon-red/20 text-neon-red border-neon-red/40",
            )}
          >
            {position.side === "long" ? (
              <TrendingUp className="h-2.5 w-2.5 mr-0.5" />
            ) : (
              <TrendingDown className="h-2.5 w-2.5 mr-0.5" />
            )}
            {position.side.toUpperCase()} {position.leverage}x
          </Badge>
          <span className="font-mono text-[10px] uppercase text-muted-foreground">
            {position.productType}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right">
            <div
              className={cn(
                "font-display font-bold text-base",
                isProfit ? "text-neon-green" : "text-neon-red",
              )}
            >
              {isProfit ? "+" : ""}
              {formatUSD(pnl)}
            </div>
            <div
              className={cn(
                "font-mono text-[10px]",
                isProfit ? "text-neon-green/80" : "text-neon-red/80",
              )}
            >
              {isProfit ? "+" : ""}
              {pnlPct.toFixed(2)}%
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={onClose}
            disabled={isClosing}
            className="h-7 px-2 font-mono text-[10px]"
          >
            {isClosing ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <X className="h-3 w-3 mr-0.5" />
            )}
            Close
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] font-mono">
        <div>
          <span className="text-muted-foreground">진입가</span>
          <div className="text-foreground">${formatPrice(position.entryPrice)}</div>
        </div>
        <div>
          <span className="text-muted-foreground">현재가</span>
          <div className="text-foreground">${formatPrice(currentPrice)}</div>
        </div>
        <div>
          <span className="text-muted-foreground">수량</span>
          <div className="text-foreground">{position.quantity}</div>
        </div>
        <div>
          <span className="text-muted-foreground">청산가</span>
          <div className="text-neon-orange">
            ${formatPrice(position.liquidationPrice ?? 0)}
          </div>
        </div>
      </div>
    </div>
  );
}
