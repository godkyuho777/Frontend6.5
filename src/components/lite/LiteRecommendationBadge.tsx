/**
 * LiteRecommendationBadge — 추천 라벨 chip
 *
 * STRONG_BUY 🟢 강한 매수 추천
 * BUY        🟢 매수 추천
 * WATCH      🟡 관찰
 * HOLD       ⚪ 지금은 추천 없음
 * SELL       🟡 매도 고려
 * STRONG_SELL🔴 강한 매도
 * SHORT      🟠 공매도 추천 (검증 단계 — 백테스트 alpha 미입증)
 * STRONG_SHORT🔻 강한 공매도 (검증 단계)
 * BLOCKED    ⚪ 지금은 추천 없음 (보호)
 *
 * (다-2) 2026-05-10: SHORT 라벨에 "검증 단계" 시각 표시.
 *   `(가)` SHORT 백테스트 결과 winRate 37.0%, Sharpe -0.17, PF 0.66 →
 *   알파 미입증. 사용자에게 production 신뢰도 X 명시.
 */

import { cn } from "@/lib/utils";

type Recommendation =
  | "STRONG_BUY"
  | "BUY"
  | "WATCH"
  | "HOLD"
  | "SELL"
  | "STRONG_SELL"
  | "SHORT"
  | "STRONG_SHORT"
  | "BLOCKED";

interface Props {
  recommendation: Recommendation;
  label?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  /**
   * 검증 단계 표시 — true 시 라벨 옆에 "(검증중)" 작은 배지.
   * 기본 false. SHORT/STRONG_SHORT 는 자동으로 표시.
   */
  showBetaTag?: boolean;
}

/** 자동 beta 표시 — alpha 미입증 라벨 (다-2 2026-05-10). */
const AUTO_BETA: ReadonlySet<Recommendation> = new Set(["SHORT", "STRONG_SHORT"]);

const STYLE: Record<Recommendation, { emoji: string; color: string; bg: string; text: string; default: string }> = {
  STRONG_BUY: {
    emoji: "🟢",
    color: "border-neon-green/50",
    bg: "bg-neon-green/15",
    text: "text-neon-green",
    default: "강한 매수 추천",
  },
  BUY: {
    emoji: "🟢",
    color: "border-neon-green/40",
    bg: "bg-neon-green/10",
    text: "text-neon-green",
    default: "매수 추천",
  },
  WATCH: {
    emoji: "👀",
    color: "border-neon-yellow/40",
    bg: "bg-neon-yellow/10",
    text: "text-neon-yellow",
    default: "관찰",
  },
  HOLD: {
    emoji: "⚪",
    color: "border-border/40",
    bg: "bg-muted/30",
    text: "text-muted-foreground",
    default: "지금은 추천 없음",
  },
  SELL: {
    emoji: "🟡",
    color: "border-neon-yellow/40",
    bg: "bg-neon-yellow/10",
    text: "text-neon-yellow",
    default: "매도 고려",
  },
  STRONG_SELL: {
    emoji: "🔴",
    color: "border-neon-red/50",
    bg: "bg-neon-red/15",
    text: "text-neon-red",
    default: "강한 매도",
  },
  SHORT: {
    emoji: "🟠",
    color: "border-neon-orange/40",
    bg: "bg-neon-orange/10",
    text: "text-neon-orange",
    default: "공매도 추천",
  },
  STRONG_SHORT: {
    emoji: "🔻",
    color: "border-neon-red/50",
    bg: "bg-neon-red/15",
    text: "text-neon-red",
    default: "강한 공매도",
  },
  BLOCKED: {
    emoji: "🛡",
    color: "border-border/40",
    bg: "bg-muted/30",
    text: "text-muted-foreground",
    default: "지금은 추천 없음",
  },
};

const SIZE: Record<Required<Props>["size"], string> = {
  sm: "px-2 py-0.5 text-[10px] gap-1",
  md: "px-3 py-1 text-xs gap-1.5",
  lg: "px-4 py-1.5 text-sm gap-2",
};

export function LiteRecommendationBadge({
  recommendation,
  label,
  size = "md",
  className,
  showBetaTag,
}: Props) {
  const s = STYLE[recommendation];
  const showBeta = showBetaTag ?? AUTO_BETA.has(recommendation);
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={cn(
          "inline-flex items-center font-display font-bold tracking-wider rounded-full border",
          SIZE[size],
          s.color,
          s.bg,
          s.text,
          className,
        )}
      >
        <span aria-hidden>{s.emoji}</span>
        <span>{label ?? s.default}</span>
      </span>
      {showBeta && (
        <span
          title="이 신호는 백테스트 alpha 미입증 단계 — 참고용으로만 사용."
          className="inline-flex items-center px-1.5 py-0.5 rounded-sm border border-neon-yellow/40 bg-neon-yellow/10 text-neon-yellow font-mono text-[9px] uppercase tracking-wider"
        >
          검증중
        </span>
      )}
    </span>
  );
}
