/**
 * LiteRiskGauge — 5단계 색상 게이지 + 라벨.
 *
 * very_low 🟢 매우 낮음
 * low      🟢 낮음
 * medium   🟡 보통
 * high     🟠 높음
 * very_high🔴 매우 높음
 */

import { cn } from "@/lib/utils";

type RiskLevel = "very_low" | "low" | "medium" | "high" | "very_high";

interface Props {
  level: RiskLevel;
  label?: string;
  showLabel?: boolean;
  className?: string;
}

const LEVEL_INDEX: Record<RiskLevel, number> = {
  very_low: 1,
  low: 2,
  medium: 3,
  high: 4,
  very_high: 5,
};

const FILL_COLOR: Record<RiskLevel, string> = {
  very_low: "bg-neon-green",
  low: "bg-neon-green/70",
  medium: "bg-neon-yellow",
  high: "bg-neon-orange",
  very_high: "bg-neon-red",
};

const TEXT_COLOR: Record<RiskLevel, string> = {
  very_low: "text-neon-green",
  low: "text-neon-green",
  medium: "text-neon-yellow",
  high: "text-neon-orange",
  very_high: "text-neon-red",
};

const DEFAULT_LABEL: Record<RiskLevel, string> = {
  very_low: "매우 낮음",
  low: "낮음",
  medium: "보통",
  high: "높음",
  very_high: "매우 높음",
};

export function LiteRiskGauge({
  level,
  label,
  showLabel = true,
  className,
}: Props) {
  const index = LEVEL_INDEX[level];
  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          위험도
        </span>
        {showLabel && (
          <span className={cn("font-display text-xs font-bold", TEXT_COLOR[level])}>
            {label ?? DEFAULT_LABEL[level]}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors",
              i <= index ? FILL_COLOR[level] : "bg-muted/40"
            )}
          />
        ))}
      </div>
    </div>
  );
}
