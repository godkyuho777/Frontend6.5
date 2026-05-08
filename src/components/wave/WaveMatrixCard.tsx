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
} from "lucide-react";

interface Props {
  symbol?: string;
}

const SIGNAL_COLOR = {
  bullish: { text: "text-neon-green", bg: "bg-neon-green/15", border: "border-neon-green/40", emoji: "🟢" },
  bearish: { text: "text-neon-red", bg: "bg-neon-red/15", border: "border-neon-red/40", emoji: "🔴" },
  neutral: { text: "text-neon-yellow", bg: "bg-neon-yellow/15", border: "border-neon-yellow/40", emoji: "🟡" },
} as const;

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
      <HudPanel title="Wave Tracker — Sentiment & Matrix" subtitle="loading 4 signals...">
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
      <HudPanel title="Wave Tracker — Error" variant="danger">
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

  return (
    <div className="space-y-3">
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
        title="Wave Matrix"
        subtitle="4-SIGNAL CONFLUENCE · 24h 기준"
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
            label="L/S Ratio"
            value={`${matrix.longRatio.toFixed(1)}% / ${matrix.shortRatio.toFixed(1)}%`}
            signal={matrix.lsSignal}
          />
        </div>

        {/* 종합 편향 + 신뢰도 */}
        <div className={cn(
          "mt-3 p-3 rounded-sm border space-y-2",
          biasColor.bg,
          biasColor.border
        )}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <BiasIcon className={cn("h-5 w-5", biasColor.text)} />
              <span className={cn("font-display text-base font-bold tracking-wider", biasColor.text)}>
                종합 편향: {matrix.overallBias.toUpperCase()}
              </span>
            </div>
            <div className="text-right">
              <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                신뢰도
              </div>
              <div className={cn("font-display text-xl font-bold", biasColor.text)}>
                {matrix.confidence}%
              </div>
            </div>
          </div>
          {/* 신뢰도 바 */}
          <div className="h-1.5 bg-muted/30 rounded-sm overflow-hidden">
            <div
              className={cn(
                "h-full transition-all",
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
        </div>

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
        title="Sentiment Detail"
        subtitle="COMPOSITE ANALYSIS BREAKDOWN"
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
          <Stat label="Price 24h" value={fmtPct(matrix.priceChange24h)} />
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
