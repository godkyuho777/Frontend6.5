/**
 * MultiTFTrendPanel — Trend Analysis Engine v2.0 (명세서 §4 ~ §10) UI
 *
 * `src/lib/trend-analysis.ts` 의 13 함수를 다음 흐름으로 호출:
 *   1H/4H/1D/1W 캔들 fetch (useCoinDetail × 4)
 *   → analyzeTimeframeTrend(candles, tf, label) × 4 (단일 TF 분석)
 *   → synthesizeMultiTFTrend(trends) (멀티 TF 종합, 가중치 1/2/3/4)
 *   → 화면에 종합 방향 + 강도 + 신뢰도 + 정렬도 + per-TF breakdown 렌더
 *
 * 명세서 §4 의 12-step 계산 로직 모두 포함:
 *   ATR 동적 임계값 / 스윙 포인트 (지수 가중) / 추세선 피팅 (가중 최소자승) /
 *   EMA 배열 / ADX / 거래량 / HH/HL / 4차 확인 / 브레이크아웃 / 7단계 phase
 *
 * 헌장 규칙 3 준수: 단독 시그널 X, BBDX 보조 컨텍스트로만 표시.
 */

import { useMemo } from "react";
import { TrendingUp, TrendingDown, Minus, Activity, Zap, AlertTriangle } from "lucide-react";
import { useCoinDetail } from "@/hooks/useMarketData";
import {
  analyzeTimeframeTrend,
  synthesizeMultiTFTrend,
  type TimeframeTrend,
  type TrendDirection,
  type TrendPhase,
  type MultiTFTrendAnalysis,
} from "@/lib/trend-analysis";
import { cn } from "@/lib/utils";

interface Props {
  symbol: string;
  className?: string;
}

const TF_CONFIG = [
  { tf: "1h" as const, label: "1H", count: 200 },
  { tf: "4h" as const, label: "4H", count: 200 },
  { tf: "1d" as const, label: "1D", count: 120 },
  { tf: "1w" as const, label: "1W", count: 80 },
];

const PHASE_LABEL: Record<TrendPhase, { ko: string; tone: "bull" | "bear" | "neutral" }> = {
  STRONG_BULLISH: { ko: "강한 상승", tone: "bull" },
  BULLISH: { ko: "상승", tone: "bull" },
  BULLISH_WEAKENING: { ko: "상승 약화", tone: "neutral" },
  SIDEWAYS: { ko: "횡보", tone: "neutral" },
  BEARISH_WEAKENING: { ko: "하락 약화", tone: "neutral" },
  BEARISH: { ko: "하락", tone: "bear" },
  STRONG_BEARISH: { ko: "강한 하락", tone: "bear" },
};

const ALIGNMENT_LABEL: Record<MultiTFTrendAnalysis["alignment"], { ko: string; tone: string }> = {
  ALIGNED_BULL: { ko: "전 TF 강세 정렬", tone: "text-emerald-400" },
  ALIGNED_BEAR: { ko: "전 TF 약세 정렬", tone: "text-red-400" },
  DIVERGENT: { ko: "TF간 다이버전스", tone: "text-orange-400" },
  MIXED: { ko: "혼합 신호", tone: "text-muted-foreground" },
};

function dirIcon(dir: TrendDirection, size = "h-4 w-4") {
  if (dir === "BULLISH") return <TrendingUp className={cn(size, "text-emerald-400")} />;
  if (dir === "BEARISH") return <TrendingDown className={cn(size, "text-red-400")} />;
  return <Minus className={cn(size, "text-muted-foreground")} />;
}

function dirColor(dir: TrendDirection): string {
  if (dir === "BULLISH") return "text-emerald-400";
  if (dir === "BEARISH") return "text-red-400";
  return "text-muted-foreground";
}

export default function MultiTFTrendPanel({ symbol, className }: Props) {
  // 4개 TF 동시 fetch (각각 별도 useCoinDetail 호출)
  const tf1h = useCoinDetail(symbol, "1h", 200);
  const tf4h = useCoinDetail(symbol, "4h", 200);
  const tf1d = useCoinDetail(symbol, "1d", 120);
  const tf1w = useCoinDetail(symbol, "1w", 80);

  const isLoading =
    tf1h.isLoading || tf4h.isLoading || tf1d.isLoading || tf1w.isLoading;

  // 명세서 §4.2 ~ §4.11 의 단일 TF 분석 4개 + §7 ~ §8 의 멀티 TF 종합
  const analysis: MultiTFTrendAnalysis | null = useMemo(() => {
    const sets = [
      { data: tf1h.data, ...TF_CONFIG[0] },
      { data: tf4h.data, ...TF_CONFIG[1] },
      { data: tf1d.data, ...TF_CONFIG[2] },
      { data: tf1w.data, ...TF_CONFIG[3] },
    ];
    const trends: TimeframeTrend[] = [];
    for (const s of sets) {
      if (!s.data?.candles || s.data.candles.length < 20) continue;
      try {
        const t = analyzeTimeframeTrend(s.data.candles, s.tf, s.label);
        trends.push(t);
      } catch {
        // skip on error
      }
    }
    if (trends.length === 0) return null;
    return synthesizeMultiTFTrend(trends);
  }, [tf1h.data, tf4h.data, tf1d.data, tf1w.data]);

  // ─── Loading state ─────────────────────────────────────────────────
  if (isLoading && !analysis) {
    return (
      <div className={cn("p-4 rounded-sm border border-border/30 bg-card/40 animate-pulse", className)}>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Activity className="h-4 w-4 animate-pulse" />
          <span className="text-xs font-mono">멀티 TF 추세선 분석 중…</span>
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className={cn("p-4 rounded-sm border border-border/30 bg-card/40", className)}>
        <div className="flex items-center gap-2 text-muted-foreground">
          <AlertTriangle className="h-4 w-4" />
          <span className="text-xs font-mono">데이터 부족 (최소 20캔들 필요)</span>
        </div>
      </div>
    );
  }

  const overallPhase = PHASE_LABEL[analysis.overallPhase];
  const alignment = ALIGNMENT_LABEL[analysis.alignment];
  const isBull = analysis.overallDirection === "BULLISH";
  const isBear = analysis.overallDirection === "BEARISH";

  const overallTone = isBull
    ? "border-emerald-500/40 bg-emerald-500/5"
    : isBear
    ? "border-red-500/40 bg-red-500/5"
    : "border-neon-cyan/30 bg-neon-cyan/5";

  return (
    <div className={cn("space-y-3", className)}>
      {/* Header */}
      <div className="flex items-center justify-between text-[10px] font-mono">
        <span className="text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Zap className="h-3 w-3" />
          Trend Analysis Engine v2.0 (멀티 TF + 추세선 + EMA + ADX)
        </span>
        <span className="px-1.5 py-0.5 rounded-sm border border-neon-pink/30 bg-neon-pink/5 text-neon-pink">
          4 TF 종합
        </span>
      </div>

      {/* 종합 카드 */}
      <div className={cn("p-3 rounded-sm border", overallTone)}>
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            {dirIcon(analysis.overallDirection, "h-5 w-5")}
            <div>
              <div className={cn("text-base font-display font-bold", dirColor(analysis.overallDirection))}>
                {overallPhase.ko}
              </div>
              <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">
                {analysis.overallPhase}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className={cn("text-2xl font-display font-bold", dirColor(analysis.overallDirection))}>
              {analysis.overallStrength}
              <span className="text-xs text-muted-foreground font-mono">/100</span>
            </div>
            <div className="text-[9px] font-mono text-muted-foreground">
              신뢰도 {analysis.confidence}%
            </div>
          </div>
        </div>

        {/* 강도 바 */}
        <div className="h-1.5 rounded-full bg-card/50 overflow-hidden mb-2">
          <div
            className={cn(
              "h-full transition-all",
              isBull ? "bg-emerald-400" : isBear ? "bg-red-400" : "bg-neon-cyan",
            )}
            style={{ width: `${analysis.overallStrength}%` }}
          />
        </div>

        {/* 정렬도 */}
        <div className={cn("text-[10px] font-mono", alignment.tone)}>
          {alignment.ko}
        </div>

        {/* 예측 텍스트 (한글) */}
        {analysis.predictionKo && (
          <div className="mt-2 pt-2 border-t border-border/30 text-[10px] font-mono text-foreground leading-relaxed">
            {analysis.predictionKo}
          </div>
        )}
      </div>

      {/* Per-TF breakdown */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {analysis.trends.map((t) => (
          <TfCard key={t.timeframe} trend={t} />
        ))}
      </div>

      {/* 헌장 규칙 3 면책 */}
      <div className="flex items-start gap-1.5 text-[9px] font-mono text-muted-foreground/70 leading-relaxed">
        <AlertTriangle className="h-2.5 w-2.5 mt-0.5 shrink-0" />
        <span>
          단독 진입 신호 X — BBDX (RSI/BB/ADX) 시그널의 보조 컨텍스트.
          TF 가중치 1H=1 / 4H=2 / 1D=3 / 1W=4. 가중 최소자승 추세선 + 4차 확인 (추세선·EMA·ADX·HH/HL).
        </span>
      </div>
    </div>
  );
}

// ─── Per-TF 카드 ─────────────────────────────────────────────────────

function TfCard({ trend }: { trend: TimeframeTrend }) {
  const phase = PHASE_LABEL[trend.phase];
  const isBull = trend.direction === "BULLISH";
  const isBear = trend.direction === "BEARISH";
  const tone = isBull
    ? "border-emerald-500/30 bg-emerald-500/5"
    : isBear
    ? "border-red-500/30 bg-red-500/5"
    : "border-border/30 bg-card/30";

  return (
    <div className={cn("p-2 rounded-sm border", tone)}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-mono font-bold text-foreground">
          {trend.label}
        </span>
        {dirIcon(trend.direction, "h-3 w-3")}
      </div>
      <div className={cn("text-sm font-display font-bold", dirColor(trend.direction))}>
        {trend.strength}
        <span className="text-[9px] text-muted-foreground font-mono">/100</span>
      </div>
      <div className="text-[8px] font-mono text-muted-foreground mt-0.5">
        {phase.ko}
      </div>

      {/* 추세선 정보 */}
      <div className="mt-1.5 pt-1.5 border-t border-border/20 space-y-0.5 text-[8px] font-mono">
        {trend.supportLine && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">지지선</span>
            <span className={cn(trend.supportLine.slopePct > 0 ? "text-emerald-300" : "text-red-300")}>
              {trend.supportLine.slopePct >= 0 ? "+" : ""}
              {trend.supportLine.slopePct.toFixed(3)}%
            </span>
          </div>
        )}
        {trend.resistanceLine && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">저항선</span>
            <span className={cn(trend.resistanceLine.slopePct > 0 ? "text-emerald-300" : "text-red-300")}>
              {trend.resistanceLine.slopePct >= 0 ? "+" : ""}
              {trend.resistanceLine.slopePct.toFixed(3)}%
            </span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">ADX</span>
          <span className={cn(trend.adxTrending ? "text-emerald-300" : "text-muted-foreground")}>
            {trend.adxValue.toFixed(1)}
            {trend.adxTrending && " ★"}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">EMA</span>
          <span
            className={cn(
              trend.emaAlignment.state === "BULLISH_ALIGNED" || trend.emaAlignment.state === "GOLDEN_CROSS"
                ? "text-emerald-300"
                : trend.emaAlignment.state === "BEARISH_ALIGNED" || trend.emaAlignment.state === "DEATH_CROSS"
                ? "text-red-300"
                : "text-muted-foreground",
            )}
          >
            {trend.emaAlignment.state.replace(/_/g, " ").toLowerCase()}
          </span>
        </div>
        {trend.breakout.detected && (
          <div className={cn(
            "flex items-center justify-between",
            trend.breakout.type === "BULLISH_BREAKOUT" ? "text-emerald-400" : "text-red-400",
          )}>
            <span>브레이크아웃</span>
            <span>{trend.breakout.confidence}%</span>
          </div>
        )}
      </div>
    </div>
  );
}
