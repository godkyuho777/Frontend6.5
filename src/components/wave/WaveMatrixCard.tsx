/**
 * Wave Matrix + Sentiment Composite — 종합 카드
 *
 * 명세서 WAVE_SENTIMENT_MATRIX.md §7 UI 그대로:
 *   1. Fear & Greed Gauge (compositeScore 0~100 + 분류)
 *   2. Wave Matrix Panel  (4 신호 + 종합 편향 + 신뢰도 + 시장 단계)
 *   3. Sentiment Detail   (분석 근거 5~8개)
 *
 * 백엔드: trpc.wave.combined({ symbol })
 */

import { trpc } from "@/lib/trpc";
import { HudPanel } from "@/components/HudPanel";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Loader2,
  TrendingDown,
  TrendingUp,
  Minus,
  Brain,
  Compass,
  Zap,
  Globe,
  Shield,
  ShieldAlert,
} from "lucide-react";

interface Props {
  symbol?: string;
}

const SIGNAL_COLOR = {
  bullish: { text: "text-neon-green", bg: "bg-neon-green/15", border: "border-neon-green/40", emoji: "🟢" },
  bearish: { text: "text-neon-red", bg: "bg-neon-red/15", border: "border-neon-red/40", emoji: "🔴" },
  neutral: { text: "text-neon-yellow", bg: "bg-neon-yellow/15", border: "border-neon-yellow/40", emoji: "🟡" },
} as const;

// v4.2 Macro Stance — 거시 스탠스 5단계.
// Tailwind 정적 분석을 위해 explicit class strings.
const MACRO_STANCE_META = {
  RISK_ON: {
    icon: "🚀",
    title: "RISK ON",
    cardClass: "border-neon-green/40 bg-neon-green/10",
    textClass: "text-neon-green",
    badgeClass: "bg-neon-green/20 text-neon-green border-neon-green/50",
  },
  NEUTRAL_BULL: {
    icon: "📈",
    title: "NEUTRAL BULL",
    cardClass: "border-neon-cyan/40 bg-neon-cyan/10",
    textClass: "text-neon-cyan",
    badgeClass: "bg-neon-cyan/20 text-neon-cyan border-neon-cyan/50",
  },
  NEUTRAL: {
    icon: "🟡",
    title: "NEUTRAL",
    cardClass: "border-neon-yellow/40 bg-neon-yellow/10",
    textClass: "text-neon-yellow",
    badgeClass: "bg-neon-yellow/20 text-neon-yellow border-neon-yellow/50",
  },
  NEUTRAL_BEAR: {
    icon: "📉",
    title: "NEUTRAL BEAR",
    cardClass: "border-orange-400/40 bg-orange-400/10",
    textClass: "text-orange-400",
    badgeClass: "bg-orange-400/20 text-orange-400 border-orange-400/50",
  },
  RISK_OFF: {
    icon: "⚠️",
    title: "RISK OFF",
    cardClass: "border-neon-red/40 bg-neon-red/10",
    textClass: "text-neon-red",
    badgeClass: "bg-neon-red/20 text-neon-red border-neon-red/50",
  },
  DEFENSIVE: {
    icon: "🛡️",
    title: "DEFENSIVE",
    cardClass: "border-neon-red/60 bg-neon-red/15",
    textClass: "text-neon-red",
    badgeClass: "bg-neon-red/25 text-neon-red border-neon-red/60",
  },
} as const;

type MacroStanceKey = keyof typeof MACRO_STANCE_META;

function MacroStanceIcon({ stance }: { stance: MacroStanceKey }) {
  if (stance === "DEFENSIVE") return <Shield className="h-5 w-5" />;
  if (stance === "RISK_OFF") return <ShieldAlert className="h-5 w-5" />;
  if (stance === "RISK_ON") return <TrendingUp className="h-5 w-5" />;
  if (stance === "NEUTRAL_BULL") return <TrendingUp className="h-4 w-4" />;
  if (stance === "NEUTRAL_BEAR") return <TrendingDown className="h-4 w-4" />;
  return <Globe className="h-5 w-5" />;
}

const PHASE_META = {
  ACCUMULATION: { label: "축적 (Accumulation)", color: "text-neon-cyan", desc: "공포 + OI 증가 → 스마트머니 매집 중" },
  HEATING: { label: "가열 (Heating)", color: "text-neon-green", desc: "탐욕 + OI 증가 → 상승 모멘텀 가속" },
  DISTRIBUTION: { label: "분산 (Distribution)", color: "text-neon-yellow", desc: "탐욕 + OI 감소 → 고점 부근 이익 실현" },
  PANIC: { label: "공포 (Panic)", color: "text-neon-red", desc: "공포 + OI 감소 → 패닉셀 진행 중" },
} as const;

const FNG_META = {
  EXTREME_FEAR: { label: "극도의 공포", color: "text-neon-green", desc: "매집 기회" },
  FEAR: { label: "공포", color: "text-neon-cyan", desc: "바닥 탐색 중" },
  NEUTRAL: { label: "중립", color: "text-muted-foreground", desc: "방향성 약함" },
  GREED: { label: "탐욕", color: "text-neon-yellow", desc: "과열 주의" },
  EXTREME_GREED: { label: "극도의 탐욕", color: "text-neon-red", desc: "분산 매도 고려" },
} as const;

function fmtPct(v: number, decimals = 2): string {
  return `${v >= 0 ? "+" : ""}${v.toFixed(decimals)}%`;
}

function SignalRow({
  label,
  value,
  signal,
}: {
  label: string;
  value: string;
  signal: "bullish" | "bearish" | "neutral";
}) {
  const c = SIGNAL_COLOR[signal];
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/20 last:border-0">
      <div className="flex items-center gap-2">
        <span className="text-base" aria-hidden>{c.emoji}</span>
        <span className="font-mono text-[11px] text-muted-foreground uppercase tracking-wider">
          {label}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-foreground">{value}</span>
        <span
          className={cn(
            "font-mono text-[10px] px-2 py-0.5 rounded-sm border uppercase tracking-wider font-bold",
            c.text,
            c.bg,
            c.border
          )}
        >
          {signal}
        </span>
      </div>
    </div>
  );
}

export function WaveMatrixCard({ symbol = "BTCUSDT" }: Props) {
  const { data, isLoading, error } = trpc.wave.combined.useQuery(
    { symbol },
    { staleTime: 60_000, refetchOnWindowFocus: false }
  );

  if (isLoading) {
    return (
      <HudPanel title="웨이브 트래커 — 투자심리 & 매트릭스" subtitle="4개 신호 불러오는 중...">
        <div className="flex items-center justify-center py-8 gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-neon-pink" />
          <span className="font-mono text-xs text-muted-foreground">
            Fear&Greed + 글로벌 시장 + Bybit OI/Funding + L/S 호출 중...
          </span>
        </div>
      </HudPanel>
    );
  }

  if (error || !data) {
    return (
      <HudPanel title="웨이브 트래커 — 오류" variant="danger">
        <div className="flex items-center gap-2 py-4">
          <AlertTriangle className="h-4 w-4 text-neon-red" />
          <span className="font-mono text-xs text-neon-red">
            {String(error?.message ?? "데이터 없음")}
          </span>
        </div>
      </HudPanel>
    );
  }

  const { sentiment, matrix } = data;
  const fngClass = FNG_META[sentiment.compositeLabel];
  const phaseMeta = PHASE_META[sentiment.marketPhase];
  const biasColor = SIGNAL_COLOR[matrix.overallBias];
  const BiasIcon =
    matrix.overallBias === "bullish"
      ? TrendingUp
      : matrix.overallBias === "bearish"
        ? TrendingDown
        : Minus;

  // FnG gauge 위치 (0~100 → 백분율)
  const fngPct = sentiment.compositeScore;

  // v4.2 — macroStance / isTie / counts 는 백엔드 v4.2 에서 추가됨.
  // 구버전 응답 호환을 위해 optional 처리.
  const macroStance =
    (matrix as any).macroStance as
      | {
          stance: MacroStanceKey;
          label: string;
          description: string;
          recommendedAction: string;
          stanceConfidence: number;
        }
      | undefined;
  const isTie = (matrix as any).isTie as boolean | undefined;
  const bullishCount = (matrix as any).bullishCount as number | undefined;
  const bearishCount = (matrix as any).bearishCount as number | undefined;

  // v4.3 Phase C — multi-period 필드
  const oiChange7d = (matrix as any).oiChange7d as number | undefined;
  const fundingAvg7d = (matrix as any).fundingAvg7d as number | undefined;
  const fundingTrend7d = (matrix as any).fundingTrend7d as
    | "rising"
    | "falling"
    | "flat"
    | undefined;
  const oiDivergence = (matrix as any).oiDivergence as
    | "BULL_REVERSAL"
    | "BEAR_REVERSAL"
    | "BULL_ACCEL"
    | "BEAR_ACCEL"
    | "CHOPPY"
    | undefined;
  const oiDivergenceKo = (matrix as any).oiDivergenceKo as string | undefined;

  // v4.3 Phase D — prediction action + source health
  const recommendedAction = (matrix as any).recommendedAction as
    | string
    | undefined;
  const sourceHealth = (data as any).sourceHealth as
    | {
        fearGreed: { status: "live" | "stale" | "fallback"; ageSec: number };
        globalMarket: { status: "live" | "stale" | "fallback"; ageSec: number };
        bybitDerivatives: { status: "live" | "stale" | "fallback"; ageSec: number };
        bybitLongShort: { status: "live" | "stale" | "fallback"; ageSec: number };
        healthScore: number;
      }
    | undefined;

  // 헬퍼들
  const sourceColor = (s?: "live" | "stale" | "fallback") =>
    s === "live"
      ? "text-neon-green"
      : s === "stale"
        ? "text-neon-yellow"
        : "text-neon-red";
  const sourceDot = (s?: "live" | "stale" | "fallback") =>
    s === "live" ? "🟢" : s === "stale" ? "🟡" : "🔴";
  const ageStr = (sec: number) =>
    sec >= Number.MAX_SAFE_INTEGER / 2
      ? "—"
      : sec < 60
        ? `${sec}s`
        : sec < 3600
          ? `${Math.floor(sec / 60)}m`
          : `${Math.floor(sec / 3600)}h`;

  // OI Divergence 메타
  const DIVERGENCE_META: Record<
    NonNullable<typeof oiDivergence>,
    { label: string; cls: string }
  > = {
    BULL_REVERSAL: { label: "BULL REVERSAL", cls: "text-neon-green border-neon-green/50 bg-neon-green/10" },
    BEAR_REVERSAL: { label: "BEAR REVERSAL", cls: "text-neon-red border-neon-red/50 bg-neon-red/10" },
    BULL_ACCEL: { label: "BULL ACCEL", cls: "text-neon-green border-neon-green/50 bg-neon-green/15" },
    BEAR_ACCEL: { label: "BEAR ACCEL", cls: "text-neon-red border-neon-red/50 bg-neon-red/15" },
    CHOPPY: { label: "CHOPPY", cls: "text-muted-foreground border-border/40 bg-card/30" },
  };

  return (
    <div className="space-y-3">
      {/* ── -1. Source Health (v4.3 Phase D) ─────────────────── */}
      {sourceHealth && (
        <div className="flex items-center gap-2 flex-wrap text-[10px] font-mono px-3 py-2 rounded-sm border border-border/30 bg-card/30">
          <span className="text-muted-foreground uppercase tracking-wider">
            데이터 소스:
          </span>
          <span className={cn("flex items-center gap-1", sourceColor(sourceHealth.fearGreed.status))}>
            {sourceDot(sourceHealth.fearGreed.status)} F&G ({ageStr(sourceHealth.fearGreed.ageSec)})
          </span>
          <span className={cn("flex items-center gap-1", sourceColor(sourceHealth.globalMarket.status))}>
            {sourceDot(sourceHealth.globalMarket.status)} Global ({ageStr(sourceHealth.globalMarket.ageSec)})
          </span>
          <span className={cn("flex items-center gap-1", sourceColor(sourceHealth.bybitDerivatives.status))}>
            {sourceDot(sourceHealth.bybitDerivatives.status)} Bybit OI ({ageStr(sourceHealth.bybitDerivatives.ageSec)})
          </span>
          <span className={cn("flex items-center gap-1", sourceColor(sourceHealth.bybitLongShort.status))}>
            {sourceDot(sourceHealth.bybitLongShort.status)} L/S ({ageStr(sourceHealth.bybitLongShort.ageSec)})
          </span>
          <span className="ml-auto text-muted-foreground">
            상태 {sourceHealth.healthScore}/4
          </span>
        </div>
      )}

      {/* ── 0. Macro Stance (v4.2 — 거시 스탠스 신설) ─────── */}
      {macroStance && (
        <div
          className={cn(
            "rounded-sm border p-4 flex items-start gap-3",
            MACRO_STANCE_META[macroStance.stance].cardClass
          )}
        >
          <div
            className={cn(
              "shrink-0 mt-0.5",
              MACRO_STANCE_META[macroStance.stance].textClass
            )}
          >
            <MacroStanceIcon stance={macroStance.stance} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-1.5">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "font-display text-base font-bold tracking-wider uppercase",
                    MACRO_STANCE_META[macroStance.stance].textClass
                  )}
                >
                  거시 스탠스: {MACRO_STANCE_META[macroStance.stance].title}
                </span>
                <span aria-hidden className="text-base">
                  {MACRO_STANCE_META[macroStance.stance].icon}
                </span>
              </div>
              <span
                className={cn(
                  "font-mono text-[10px] px-2 py-0.5 rounded-sm border uppercase tracking-wider font-bold",
                  MACRO_STANCE_META[macroStance.stance].badgeClass
                )}
              >
                스탠스 신뢰도 {macroStance.stanceConfidence}%
              </span>
            </div>
            <div className="font-mono text-xs text-foreground/90 leading-relaxed mb-1.5">
              {macroStance.label} — {macroStance.description}
            </div>
            <div className="font-mono text-[11px] text-foreground/70 leading-relaxed border-t border-border/20 pt-1.5">
              <span className="text-muted-foreground">권장 액션:</span>{" "}
              {macroStance.recommendedAction}
            </div>
          </div>
        </div>
      )}

      {/* ── 1. Fear & Greed Gauge ─────────────────────── */}
      <HudPanel
        title="Fear & Greed Index"
        subtitle="ALTERNATIVE.ME · 24시간(일봉) 기준"
        variant="highlight"
      >
        <div className="space-y-3">
          <div className="flex items-baseline justify-between flex-wrap gap-2">
            <div className={cn("font-display text-3xl font-bold tracking-wide", fngClass.color)}>
              {sentiment.compositeScore}
            </div>
            <div className="text-right">
              <div className={cn("font-display text-base font-bold tracking-wider", fngClass.color)}>
                {fngClass.label}
              </div>
              <div className="font-mono text-[11px] text-muted-foreground">{fngClass.desc}</div>
            </div>
          </div>
          {/* 게이지 바 */}
          <div className="relative h-2 bg-gradient-to-r from-neon-red via-neon-yellow to-neon-green rounded-sm">
            <div
              className="absolute top-1/2 -translate-y-1/2 h-4 w-1 bg-foreground border border-background"
              style={{ left: `${fngPct}%` }}
            />
          </div>
          <div className="flex justify-between font-mono text-[9px] text-muted-foreground">
            <span>0 공포</span>
            <span>50 중립</span>
            <span>100 탐욕</span>
          </div>
          <div className="flex items-center gap-2 pt-2 border-t border-border/20">
            <Compass className={cn("h-4 w-4", phaseMeta.color)} />
            <div className="flex-1">
              <div className={cn("font-display text-xs font-bold tracking-wider", phaseMeta.color)}>
                시장 단계: {phaseMeta.label}
              </div>
              <div className="font-mono text-[10px] text-muted-foreground">{phaseMeta.desc}</div>
            </div>
          </div>
        </div>
      </HudPanel>

      {/* ── 2. Wave Matrix Panel ───────────────────────── */}
      <HudPanel
        title="웨이브 매트릭스"
        subtitle="4-신호 컨플루언스 · 24h 기준"
        variant={matrix.overallBias === "neutral" ? "default" : "highlight"}
      >
        <div className="space-y-1">
          <SignalRow
            label="OI 변화"
            value={fmtPct(matrix.oiChangeRate)}
            signal={matrix.oiSignal}
          />
          <SignalRow
            label="F&G"
            value={`${matrix.fearGreedValue}/100`}
            signal={matrix.sentimentSignal}
          />
          <SignalRow
            label="Funding"
            value={fmtPct(matrix.fundingRateAvg, 4)}
            signal={matrix.fundingSignal}
          />
          <SignalRow
            label="L/S 비율"
            value={`${matrix.longRatio.toFixed(1)}% / ${matrix.shortRatio.toFixed(1)}%`}
            signal={matrix.lsSignal}
          />
        </div>

        {/* 종합 편향 + 신뢰도 (v4.2 — symmetric, tie 처리) */}
        <div className={cn(
          "mt-3 p-3 rounded-sm border space-y-2",
          isTie ? "bg-neon-yellow/10 border-neon-yellow/40" : biasColor.bg,
          isTie ? "" : biasColor.border
        )}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <BiasIcon className={cn("h-5 w-5", isTie ? "text-neon-yellow" : biasColor.text)} />
              <span className={cn(
                "font-display text-base font-bold tracking-wider",
                isTie ? "text-neon-yellow" : biasColor.text,
              )}>
                {isTie
                  ? "신호 미정 (TIE)"
                  : `종합 편향: ${matrix.overallBias.toUpperCase()}`}
              </span>
              {/* v4.2 — vote count badge */}
              {bullishCount != null && bearishCount != null && (
                <span className="font-mono text-[10px] text-muted-foreground bg-background/40 px-2 py-0.5 rounded-sm border border-border/30">
                  🟢 {bullishCount} / 🔴 {bearishCount} / 🟡 {4 - bullishCount - bearishCount}
                </span>
              )}
            </div>
            <div className="text-right">
              <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                신뢰도 {isTie && <span className="text-neon-yellow">(tied)</span>}
              </div>
              <div className={cn(
                "font-display text-xl font-bold",
                isTie ? "text-neon-yellow" : biasColor.text,
              )}>
                {matrix.confidence}%
              </div>
            </div>
          </div>
          {/* 신뢰도 바 */}
          <div className="h-1.5 bg-muted/30 rounded-sm overflow-hidden">
            <div
              className={cn(
                "h-full transition-all",
                isTie ? "bg-neon-yellow" :
                matrix.overallBias === "bullish" ? "bg-neon-green" :
                matrix.overallBias === "bearish" ? "bg-neon-red" :
                "bg-neon-yellow"
              )}
              style={{ width: `${matrix.confidence}%` }}
            />
          </div>
          <p className="font-mono text-[11px] text-foreground leading-relaxed pt-1">
            {matrix.predictionKo}
          </p>
          {/* v4.3 Phase D — 권장 액션 카드 */}
          {recommendedAction && (
            <div className="mt-2 pt-2 border-t border-border/20">
              <div className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">
                권장 액션
              </div>
              <p className="font-mono text-[11px] text-foreground/90 leading-relaxed">
                {recommendedAction}
              </p>
            </div>
          )}
        </div>

        {/* v4.3 Phase C — OI Divergence + 7d Multi-period 뱃지 */}
        {(oiDivergence || oiChange7d != null || fundingTrend7d) && (
          <div className="mt-3 p-2 bg-background/40 border border-border/30 rounded-sm space-y-1.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider">
                멀티-기간 (v4.3)
              </span>
              {oiDivergence && oiDivergence !== "CHOPPY" && (
                <span
                  className={cn(
                    "font-mono text-[10px] px-2 py-0.5 rounded-sm border uppercase tracking-wider font-bold",
                    DIVERGENCE_META[oiDivergence].cls
                  )}
                >
                  {DIVERGENCE_META[oiDivergence].label}
                </span>
              )}
              {oiChange7d != null && (
                <span className="font-mono text-[10px] text-muted-foreground">
                  OI 7d: <span className={cn(
                    "font-bold",
                    oiChange7d > 5 ? "text-neon-green" :
                    oiChange7d < -5 ? "text-neon-red" :
                    "text-foreground/80",
                  )}>{oiChange7d >= 0 ? "+" : ""}{oiChange7d.toFixed(1)}%</span>
                </span>
              )}
              {fundingTrend7d && fundingTrend7d !== "flat" && fundingAvg7d != null && (
                <span className="font-mono text-[10px] text-muted-foreground">
                  Funding 7d avg: <span className={cn(
                    "font-bold",
                    fundingAvg7d > 0.005 ? "text-neon-green" :
                    fundingAvg7d < -0.005 ? "text-neon-red" :
                    "text-foreground/80",
                  )}>
                    {fundingAvg7d >= 0 ? "+" : ""}{fundingAvg7d.toFixed(4)}% {fundingTrend7d === "rising" ? "↑" : "↓"}
                  </span>
                </span>
              )}
            </div>
            {oiDivergenceKo && (
              <p className="font-mono text-[10px] text-foreground/70 leading-relaxed">
                {oiDivergenceKo}
              </p>
            )}
          </div>
        )}

        {/* OI 복합 해석 */}
        <div className="mt-3 p-2 bg-background/40 border border-border/30 rounded-sm">
          <div className="flex items-center gap-1.5 mb-1">
            <Zap className="h-3 w-3 text-neon-cyan" />
            <span className="font-mono text-[9px] text-neon-cyan uppercase tracking-wider">
              OI 복합 해석 (v4.1)
            </span>
          </div>
          <p className="font-mono text-[11px] text-foreground/90 leading-relaxed">
            {matrix.oiInterpretation}
          </p>
        </div>
      </HudPanel>

      {/* ── 3. Sentiment Detail ────────────────────────── */}
      <HudPanel
        title="투자심리 상세"
        subtitle="종합 분석 세부"
      >
        <div className="space-y-1.5">
          {sentiment.reasons.map((r, i) => (
            <div key={i} className="flex gap-2 font-mono text-[11px] text-foreground leading-relaxed">
              <Brain className="h-3.5 w-3.5 mt-0.5 shrink-0 text-neon-pink" />
              <span>{r}</span>
            </div>
          ))}
        </div>
        {/* 수치 표기 (v4.1) */}
        <div className="mt-3 pt-3 border-t border-border/20 grid grid-cols-2 md:grid-cols-3 gap-2 font-mono text-[10px]">
          <Stat label="OI 24h" value={fmtPct(matrix.oiChangeRate)} />
          <Stat label="F&G" value={`${matrix.fearGreedValue}/100`} />
          <Stat label="Funding" value={fmtPct(matrix.fundingRateAvg, 4)} />
          <Stat label="Long" value={`${matrix.longRatio.toFixed(1)}%`} />
          <Stat label="Short" value={`${matrix.shortRatio.toFixed(1)}%`} />
          <Stat label="가격 24h" value={fmtPct(matrix.priceChange24h)} />
        </div>
      </HudPanel>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <div className="text-muted-foreground uppercase tracking-wider text-[9px]">{label}</div>
      <div className="text-foreground font-bold">{value}</div>
    </div>
  );
}
