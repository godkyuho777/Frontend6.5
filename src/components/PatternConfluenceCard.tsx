import type {
  PatternConfluenceSummary,
  PatternContextDetail,
  CandlePatternName,
} from "@shared/types";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Activity, AlertCircle, Info } from "lucide-react";

/**
 * PATTERN_SYSTEM_AUDIT.md 권고 적용 후 백엔드가 산출하는 합산 신뢰도를 시각화.
 *
 * 표시 항목:
 *  - 0~100 신뢰도 점수 (강세/약세 각각)
 *  - confluence 카운트 ("3개 동시 신호")
 *  - confluence 보너스 (max 0.20)
 *  - primary 패턴 이름
 *  - 컨텍스트 분해: TF base × volume mult × trend mult × age discount
 *
 * 단독 시그널 X — 헌장 규칙 3 명시 (사용자에게 "이 점수는 BBDX 가중치" 안내).
 */

const PATTERN_KO_LABEL: Record<CandlePatternName, string> = {
  engulfing: "강세 인걸핑",
  morningStar: "모닝 스타",
  threeWhiteSoldiers: "3 White Soldiers",
  hammer: "해머",
  invertedHammer: "역 해머",
  pinBar: "강세 핀바",
  doji: "도지",
  bearishEngulfing: "약세 인걸핑",
  eveningStar: "이브닝 스타",
  threeBlackCrows: "3 Black Crows",
};

const VOLUME_LABEL: Record<PatternContextDetail["volumeLabel"], { label: string; tone: string }> = {
  very_high: { label: "거래량 폭발", tone: "text-emerald-400" },
  high: { label: "거래량 강함", tone: "text-emerald-300" },
  elevated: { label: "거래량 상승", tone: "text-cyan-300" },
  normal: { label: "거래량 정상", tone: "text-muted-foreground" },
  low: { label: "거래량 부족", tone: "text-orange-400" },
};

const TREND_LABEL: Record<PatternContextDetail["trendLabel"], { label: string; tone: string }> = {
  strong_down: { label: "강한 하락 후", tone: "text-emerald-400" },
  mild_down: { label: "약한 하락 후", tone: "text-emerald-300" },
  sideways: { label: "횡보 중", tone: "text-muted-foreground" },
  mild_up: { label: "약한 상승 후", tone: "text-orange-300" },
  strong_up: { label: "강한 상승 후", tone: "text-orange-400" },
};

interface Props {
  summary: PatternConfluenceSummary | null;
  /** 강세 또는 약세 한 면만 표시 */
  variant?: "bullish" | "bearish" | "both";
  className?: string;
}

export function PatternConfluenceCard({
  summary,
  variant = "both",
  className,
}: Props) {
  if (!summary) {
    return (
      <div className={cn("p-3 rounded-sm border border-border/30 bg-card/40", className)}>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Info className="h-3.5 w-3.5" />
          <span className="text-[10px] font-sans uppercase tracking-wider">
            패턴 데이터 없음
          </span>
        </div>
      </div>
    );
  }

  const showBull = variant === "bullish" || variant === "both";
  const showBear = variant === "bearish" || variant === "both";

  return (
    <div className={cn("space-y-2", className)}>
      {/* 헤더 — TF + 헌장 면책 */}
      <div className="flex items-center justify-between text-[10px] font-sans">
        <span className="text-muted-foreground uppercase tracking-wider">
          패턴 합산 (multi + 거래량 + 추세 + TF)
        </span>
        <span className="px-1.5 py-0.5 rounded-sm border border-neon-cyan/30 bg-neon-cyan/5 text-neon-cyan">
          TF: {summary.tf.toUpperCase()}
        </span>
      </div>

      {/* 강세 카드 */}
      {showBull && (
        <DirectionPanel
          score={summary.bullishScore}
          count={summary.bullishCount}
          bonus={summary.bullishBonus}
          primaryName={summary.bullishPrimaryName}
          context={summary.bullishContext}
          direction="bullish"
        />
      )}

      {/* 약세 카드 */}
      {showBear && (
        <DirectionPanel
          score={summary.bearishScore}
          count={summary.bearishCount}
          bonus={summary.bearishBonus}
          primaryName={summary.bearishPrimaryName}
          context={summary.bearishContext}
          direction="bearish"
        />
      )}

      {/* 헌장 규칙 3 면책 */}
      <div className="flex items-start gap-1.5 text-[9px] font-sans text-muted-foreground/70 leading-relaxed">
        <AlertCircle className="h-2.5 w-2.5 mt-0.5 shrink-0" />
        <span>
          단독 진입 신호 X — BBDX (RSI/BB/ADX) 시그널 강도의 multiplier 로만 사용.
          PATTERN_SYSTEM_AUDIT v1 권고 적용 (다중 패턴 + 거래량 + 추세 컨텍스트 + TF 차등).
        </span>
      </div>
    </div>
  );
}

// ─── 단방향 (강세 or 약세) 패널 ──────────────────────────────────────────

function DirectionPanel({
  score,
  count,
  bonus,
  primaryName,
  context,
  direction,
}: {
  score: number;
  count: number;
  bonus: number;
  primaryName: CandlePatternName | null;
  context: PatternContextDetail | null;
  direction: "bullish" | "bearish";
}) {
  const isBull = direction === "bullish";
  const Icon = isBull ? TrendingUp : TrendingDown;
  const accent = isBull
    ? "border-emerald-500/30 bg-emerald-500/5"
    : "border-red-500/30 bg-red-500/5";
  const accentText = isBull ? "text-emerald-400" : "text-red-400";

  if (count === 0) {
    return (
      <div className={cn("p-2.5 rounded-sm border border-border/20 bg-card/30 opacity-60")}>
        <div className="flex items-center gap-2 text-[10px] font-sans text-muted-foreground">
          <Icon className="h-3 w-3" />
          <span>{isBull ? "강세 패턴 없음" : "약세 패턴 없음"}</span>
        </div>
      </div>
    );
  }

  const score100 = Math.round(score * 100);

  return (
    <div className={cn("p-2.5 rounded-sm border", accent)}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5">
          <Icon className={cn("h-3.5 w-3.5", accentText)} />
          <span className={cn("text-xs font-display font-bold", accentText)}>
            {isBull ? "강세 합산" : "약세 합산"}
          </span>
        </div>
        <div className={cn("text-2xl font-display font-bold", accentText)}>
          {score100}
          <span className="text-xs text-muted-foreground font-sans">/100</span>
        </div>
      </div>

      {/* 점수 바 */}
      <div className="h-1.5 rounded-full bg-card/50 overflow-hidden mb-2">
        <div
          className={cn("h-full transition-all", isBull ? "bg-emerald-400" : "bg-red-400")}
          style={{ width: `${score100}%` }}
        />
      </div>

      {/* 메타 라인: primary + count + bonus */}
      <div className="flex items-center justify-between text-[10px] font-sans mb-2">
        <span className="text-foreground">
          주 패턴:{" "}
          <span className={accentText}>
            {primaryName ? PATTERN_KO_LABEL[primaryName] : "—"}
          </span>
        </span>
        <span className="text-muted-foreground">
          {count}개 동시 신호{" "}
          {bonus > 0 && (
            <span className={accentText}>
              (+{(bonus * 100).toFixed(0)}점 confluence)
            </span>
          )}
        </span>
      </div>

      {/* 컨텍스트 분해 */}
      {context && <ContextBreakdown context={context} />}
    </div>
  );
}

// ─── 컨텍스트 분해 (base × vol × trend × age) ────────────────────────────

function ContextBreakdown({ context }: { context: PatternContextDetail }) {
  const vol = VOLUME_LABEL[context.volumeLabel];
  const trend = TREND_LABEL[context.trendLabel];
  return (
    <div className="grid grid-cols-2 gap-1.5 text-[9px] font-sans pt-1.5 border-t border-border/20">
      <ContextCell
        label="TF base"
        value={(context.base * 100).toFixed(0)}
        suffix="/100"
        tone="text-cyan-300"
        hint="TF별 기본 신뢰도"
      />
      <ContextCell
        label="× 거래량"
        value={context.volumeMultiplier.toFixed(2)}
        suffix={`× (${(context.volumeRatio).toFixed(2)}x baseline)`}
        tone={vol.tone}
        hint={vol.label}
      />
      <ContextCell
        label="× 선행 추세"
        value={context.trendMultiplier.toFixed(2)}
        suffix={`× (${(context.trendCumulativeReturn * 100).toFixed(1)}%)`}
        tone={trend.tone}
        hint={trend.label}
      />
      <ContextCell
        label="× age discount"
        value={context.ageDiscount.toFixed(2)}
        suffix="× (e^{-ago/3})"
        tone="text-muted-foreground"
        hint={`최종: ${(context.contextualStrength * 100).toFixed(0)}/100`}
      />
    </div>
  );
}

function ContextCell({
  label,
  value,
  suffix,
  tone,
  hint,
}: {
  label: string;
  value: string;
  suffix: string;
  tone: string;
  hint?: string;
}) {
  return (
    <div className="px-2 py-1 rounded-sm bg-background/40 border border-border/20">
      <div className="flex items-center justify-between gap-1">
        <span className="text-muted-foreground uppercase tracking-wider">{label}</span>
        <span className={cn("font-bold", tone)}>{value}</span>
      </div>
      <div className="text-muted-foreground/60 text-[8px]">{suffix}</div>
      {hint && (
        <div className={cn("text-[8px] mt-0.5", tone)}>{hint}</div>
      )}
    </div>
  );
}

/**
 * 사이드바/리스트용 인라인 패턴 뱃지.
 * 강세/약세 score 중 더 큰 쪽 + count 만 노출.
 */
export function PatternConfluenceBadge({
  summary,
  className,
}: {
  summary: PatternConfluenceSummary | null;
  className?: string;
}) {
  if (!summary) return null;
  const dominant = summary.bullishScore >= summary.bearishScore ? "bullish" : "bearish";
  const score = dominant === "bullish" ? summary.bullishScore : summary.bearishScore;
  const count = dominant === "bullish" ? summary.bullishCount : summary.bearishCount;
  const primary: CandlePatternName | null =
    dominant === "bullish" ? summary.bullishPrimaryName : summary.bearishPrimaryName;
  if (count === 0 || score === 0) return null;
  const score100 = Math.round(score * 100);
  const isBull = dominant === "bullish";

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm border text-[9px] font-sans",
        isBull
          ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-400"
          : "border-red-500/40 bg-red-500/5 text-red-400",
        className,
      )}
      title={`${primary ? PATTERN_KO_LABEL[primary] : ""} + ${count - 1}개 동시 신호 → ${score100}/100`}
    >
      {isBull ? <Activity className="h-2.5 w-2.5" /> : <Activity className="h-2.5 w-2.5 rotate-180" />}
      <span className="font-bold">{score100}</span>
      {count > 1 && (
        <span className="text-[8px] opacity-80">+{count - 1}</span>
      )}
    </div>
  );
}
