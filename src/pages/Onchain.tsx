/**
 * Onchain Data Page (Tradelab 7번 차원)
 *
 * BBDX 시그널의 가중치로 작동하는 7개 modifier 시각화.
 *   exchange_netflow / whale_alert / ssr / coinbase_premium /
 *   etf_flow / miner_outflow / lth_supply
 *
 * 명세서 ONCHAIN_INTEGRATION.md §5 UI 그대로:
 *   [regime 뱃지] [총점 바] + 7-modifier breakdown + BBDX multiplier 미리보기.
 *
 * 헌장 규칙 3 — 단독 시그널 X, 가중치 표시만.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { HudPanel } from "@/components/HudPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TOP_COINS } from "@shared/types";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Loader2,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  XCircle,
  Zap,
} from "lucide-react";

// ─── Static metadata for the 7 modifiers ──────────────────────────

const MODIFIER_META: Record<
  string,
  { label: string; description: string; bullishDesc: string; bearishDesc: string }
> = {
  exchange_netflow: {
    label: "Exchange Netflow",
    description: "거래소 순유입/유출 (24h, z-score)",
    bullishDesc: "거래소에서 빠짐 = 콜드월렛 이동 = 매도 의도 X",
    bearishDesc: "거래소로 들어옴 = 매도 준비",
  },
  whale_alert: {
    label: "Whale Alert",
    description: "$10M+ 단일 송금 (12h)",
    bullishDesc: "거래소 → 미상 = 장기 보유 의도",
    bearishDesc: "미상 → 거래소 = 매도 준비",
  },
  ssr: {
    label: "SSR",
    description: "Stablecoin Supply Ratio (BTC 시총 / 스테이블 시총)",
    bullishDesc: "낮은 SSR = 매수 대기 자금 풍부 = 바닥 신호",
    bearishDesc: "높은 SSR = 매수 여력 부족 = 천장 신호",
  },
  coinbase_premium: {
    label: "Coinbase Premium",
    description: "(Coinbase USD / Bybit USDT) - 1",
    bullishDesc: "양수 = 미국 기관 매수 우위",
    bearishDesc: "음수 = 미국 기관 매도 우위",
  },
  etf_flow: {
    label: "ETF Flow",
    description: "BTC/ETH 스팟 ETF 순유입 (3 영업일 누적)",
    bullishDesc: "유입 = 강한 매수 압력",
    bearishDesc: "유출 = 매도 압력",
  },
  miner_outflow: {
    label: "Miner Outflow",
    description: "채굴자 → 거래소·OTC (BTC, 7일 z-score)",
    bullishDesc: "감소 = 채굴자 holding",
    bearishDesc: "증가 = 채굴자 매도 압력",
  },
  lth_supply: {
    label: "LTH Supply",
    description: "Long-Term Holder (155일+ 보유) 30일 변화",
    bullishDesc: "축적 = 분배 단계 X",
    bearishDesc: "감소 = 천장 신호",
  },
};

const REGIME_META: Record<
  string,
  { label: string; color: string; bg: string; border: string; icon: typeof TrendingUp }
> = {
  strong_accumulation: {
    label: "STRONG ACCUMULATION",
    color: "text-neon-green glow-green",
    bg: "bg-neon-green/10",
    border: "border-neon-green/40",
    icon: TrendingUp,
  },
  accumulation: {
    label: "ACCUMULATION",
    color: "text-neon-green",
    bg: "bg-neon-green/5",
    border: "border-neon-green/30",
    icon: TrendingUp,
  },
  neutral: {
    label: "NEUTRAL",
    color: "text-muted-foreground",
    bg: "bg-muted/10",
    border: "border-border/40",
    icon: Database,
  },
  distribution: {
    label: "DISTRIBUTION",
    color: "text-neon-red",
    bg: "bg-neon-red/5",
    border: "border-neon-red/30",
    icon: TrendingDown,
  },
  strong_distribution: {
    label: "STRONG DISTRIBUTION",
    color: "text-neon-red glow-red",
    bg: "bg-neon-red/10",
    border: "border-neon-red/40",
    icon: TrendingDown,
  },
};

// ─── Helpers ──────────────────────────────────────────────────────

function statusIcon(status: string) {
  if (status === "ok") return <CheckCircle2 className="h-3.5 w-3.5 text-neon-green" />;
  if (status === "stub") return <Database className="h-3.5 w-3.5 text-muted-foreground/60" />;
  return <XCircle className="h-3.5 w-3.5 text-neon-red" />;
}

function valueColor(v: number): string {
  if (v > 0) return "text-neon-green";
  if (v < 0) return "text-neon-red";
  return "text-muted-foreground";
}

function fmtValue(v: number): string {
  if (v === 0) return "0.00";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}`;
}

// ─── Page ─────────────────────────────────────────────────────────

export default function Onchain() {
  const [symbolInput, setSymbolInput] = useState("BTCUSDT");
  const [symbol, setSymbol] = useState("BTCUSDT");
  // BBDX simulation params (so users can see how onchain affects entry strength)
  const [baseStrength, setBaseStrength] = useState(72);
  const [path, setPath] = useState<"BB:Mean" | "BB:Snap" | "BB:Riding">("BB:Mean");

  const scoreQuery = trpc.onchain.score.useQuery(
    { symbol },
    { staleTime: 60_000, refetchOnWindowFocus: false }
  );

  const entryQuery = trpc.onchain.applyToEntry.useQuery(
    { symbol, baseStrength, path },
    { staleTime: 60_000, refetchOnWindowFocus: false }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = symbolInput.trim().toUpperCase();
    if (t) setSymbol(t.endsWith("USDT") ? t : `${t}USDT`);
  };

  const data = scoreQuery.data;
  const adjusted = entryQuery.data?.adjusted;
  const isLoading = scoreQuery.isLoading || entryQuery.isLoading;
  const regime = data ? REGIME_META[data.regime] : null;
  const RegimeIcon = regime?.icon ?? Database;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-wider text-neon-pink glow-pink flex items-center gap-3">
            <Database className="h-6 w-6" />
            ONCHAIN DATA
          </h1>
          <p className="font-mono text-xs text-muted-foreground mt-1">
            7-DIMENSION MODIFIERS · BBDX WEIGHTING ONLY · 단독 시그널 X
          </p>
        </div>
        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-1.5 bg-card/50 border border-border/30 rounded-sm px-2 py-1"
        >
          <Input
            value={symbolInput}
            onChange={(e) => setSymbolInput(e.target.value)}
            list="onchain-symbols"
            className="h-6 w-32 px-1 font-mono text-[10px] bg-background/50 border-border/30"
            placeholder="Symbol"
          />
          <datalist id="onchain-symbols">
            {TOP_COINS.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          <Button
            type="submit"
            size="sm"
            variant="outline"
            className="h-6 px-2 font-mono text-[10px] border-neon-cyan/30 text-neon-cyan hover:bg-neon-cyan/10"
          >
            FETCH
          </Button>
        </form>
      </div>

      {/* Loading */}
      {isLoading && !data && (
        <HudPanel title="Loading">
          <div className="flex items-center justify-center py-8 gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-neon-pink" />
            <span className="font-mono text-xs text-muted-foreground">
              7개 modifier 호출 중...
            </span>
          </div>
        </HudPanel>
      )}

      {scoreQuery.error && (
        <HudPanel title="Error" variant="danger">
          <div className="flex items-center gap-2 py-4">
            <AlertTriangle className="h-4 w-4 text-neon-red" />
            <span className="font-mono text-xs text-neon-red">
              {String(scoreQuery.error.message ?? scoreQuery.error)}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => scoreQuery.refetch()}
              className="ml-auto h-6 border-neon-cyan/30 text-neon-cyan hover:bg-neon-cyan/10 font-mono text-[10px]"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              RETRY
            </Button>
          </div>
        </HudPanel>
      )}

      {data && regime && (
        <>
          {/* Regime + Score (overall) */}
          <HudPanel
            title="Onchain Regime"
            subtitle={`${data.symbol} · 계산: ${new Date(data.computedAt).toLocaleString("ko-KR")}`}
            variant="highlight"
          >
            <div className={cn("border rounded-sm p-4 space-y-3", regime.bg, regime.border)}>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <RegimeIcon className={cn("h-6 w-6", regime.color)} />
                  <div>
                    <div className={cn("font-display text-lg font-bold tracking-wider", regime.color)}>
                      {regime.label}
                    </div>
                    <div className="font-mono text-[10px] text-muted-foreground">
                      score = sum(modifiers) / 1.4 · clamp(-1, +1)
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider">
                    Score
                  </div>
                  <div className={cn("font-display text-3xl font-bold", valueColor(data.score))}>
                    {fmtValue(data.score)}
                  </div>
                </div>
              </div>
              {/* Score bar (-1 ~ +1) */}
              <div className="relative h-2 bg-muted/30 rounded-sm overflow-hidden">
                {/* Center line */}
                <div className="absolute top-0 bottom-0 left-1/2 w-px bg-border/60" />
                {/* Filled portion */}
                <div
                  className={cn(
                    "absolute top-0 bottom-0 transition-all",
                    data.score >= 0 ? "bg-neon-green" : "bg-neon-red"
                  )}
                  style={{
                    left: data.score >= 0 ? "50%" : `${50 + data.score * 50}%`,
                    width: `${Math.abs(data.score) * 50}%`,
                  }}
                />
              </div>
              <div className="flex items-center justify-between font-mono text-[9px] text-muted-foreground">
                <span>-1.0 strong distribution</span>
                <span>0 neutral</span>
                <span>+1.0 strong accumulation</span>
              </div>
            </div>
          </HudPanel>

          {/* 7-modifier breakdown */}
          <HudPanel
            title="Modifier Breakdown"
            subtitle="각 modifier 는 -0.25 ~ +0.20 범위. status=ok 는 진짜 데이터, stub 은 키 미설정"
          >
            <div className="space-y-1.5">
              {data.modifiers.map((m) => {
                const meta = MODIFIER_META[m.key] ?? {
                  label: m.key,
                  description: "",
                  bullishDesc: "",
                  bearishDesc: "",
                };
                return (
                  <div
                    key={m.key}
                    className={cn(
                      "border rounded-sm px-3 py-2 grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2 items-center transition-colors",
                      m.value > 0
                        ? "bg-neon-green/5 border-neon-green/20"
                        : m.value < 0
                          ? "bg-neon-red/5 border-neon-red/20"
                          : "bg-background/30 border-border/30"
                    )}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        {statusIcon(m.status)}
                        <span className="font-display text-xs tracking-wider text-foreground">
                          {meta.label}
                        </span>
                        <span
                          className={cn(
                            "font-mono text-[9px] px-1.5 py-0.5 rounded-sm uppercase tracking-wider border",
                            m.status === "ok"
                              ? "border-neon-green/30 text-neon-green"
                              : m.status === "stub"
                                ? "border-muted/40 text-muted-foreground"
                                : "border-neon-red/30 text-neon-red"
                          )}
                        >
                          {m.status}
                        </span>
                      </div>
                      <div className="font-mono text-[10px] text-muted-foreground/80">
                        {meta.description}
                      </div>
                      <div className="font-mono text-[10px] text-foreground">
                        {m.detail}
                      </div>
                    </div>
                    <div className="text-right md:px-3">
                      <div className={cn("font-display text-lg font-bold", valueColor(m.value))}>
                        {fmtValue(m.value)}
                      </div>
                      <div className="font-mono text-[9px] text-muted-foreground">
                        / -0.25~+0.20
                      </div>
                    </div>
                    <div className="font-mono text-[9px] text-muted-foreground/70 text-right max-w-[150px]">
                      <div>↑ {meta.bullishDesc}</div>
                      <div>↓ {meta.bearishDesc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </HudPanel>

          {/* BBDX multiplier preview */}
          {adjusted && (
            <HudPanel
              title="BBDX × Onchain"
              subtitle="진입 가중치 시뮬레이터 (헌장 규칙 3 — 단독 X, 가중치 O)"
            >
              <div className="grid grid-cols-1 md:grid-cols-[2fr_3fr] gap-4">
                {/* Inputs */}
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                      Base Strength (BBDX 0~100)
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={baseStrength}
                      onChange={(e) => setBaseStrength(Number(e.target.value))}
                      className="w-full accent-neon-cyan"
                    />
                    <div className="font-display text-lg font-bold text-neon-cyan">
                      {baseStrength}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                      Path
                    </label>
                    <div className="flex items-center gap-1">
                      {(["BB:Mean", "BB:Snap", "BB:Riding"] as const).map((p) => (
                        <button
                          key={p}
                          onClick={() => setPath(p)}
                          className={cn(
                            "font-mono text-[10px] px-2 py-1 rounded-sm transition-all border",
                            path === p
                              ? "bg-neon-cyan/20 text-neon-cyan border-neon-cyan/40"
                              : "text-muted-foreground border-border/30 hover:border-neon-cyan/30"
                          )}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                    <div className="font-mono text-[9px] text-muted-foreground">
                      {path === "BB:Riding"
                        ? "추세 추종 — strong_distribution 환경에서도 차단 X"
                        : "평균회귀 — strong_distribution 환경에서 자본 보호 차단"}
                    </div>
                  </div>
                </div>

                {/* Result */}
                <div className="bg-background/40 border border-border/30 rounded-sm p-3 space-y-2">
                  {adjusted.blocked ? (
                    <>
                      <div className="flex items-center gap-2 text-neon-red">
                        <XCircle className="h-5 w-5" />
                        <span className="font-display text-sm tracking-wider">
                          ENTRY BLOCKED
                        </span>
                      </div>
                      <p className="font-mono text-[11px] text-neon-red/90">
                        {adjusted.blockReason}
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 text-neon-cyan">
                        <Zap className="h-5 w-5" />
                        <span className="font-display text-sm tracking-wider">
                          ENTRY ALLOWED
                        </span>
                      </div>
                      <div className="font-mono text-[11px] text-foreground space-y-0.5">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Base Strength</span>
                          <span>{adjusted.baseStrength.toFixed(1)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Onchain Multiplier</span>
                          <span className={valueColor(adjusted.multiplier - 1)}>
                            ×{adjusted.multiplier.toFixed(3)}
                          </span>
                        </div>
                        <div className="flex justify-between border-t border-border/30 pt-1 mt-1">
                          <span className="text-muted-foreground">Final Strength</span>
                          <span className="font-bold text-neon-cyan">
                            {adjusted.finalStrength.toFixed(1)}
                            {adjusted.finalStrength === 100 && " (capped)"}
                          </span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </HudPanel>
          )}

          {/* Disclaimer */}
          <div className="bg-yellow-300/5 border border-yellow-300/30 rounded-sm px-3 py-2 font-mono text-[10px] text-yellow-300/80 flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5" />
            ⚠️ 백테스트 통계. 미래 보장 X. 자기책임. 온체인 점수는 BBDX 시그널의
            가중치로만 사용되며 단독 매매 신호로 사용하지 마세요.
          </div>
        </>
      )}
    </div>
  );
}
