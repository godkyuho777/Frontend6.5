import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface MultiplierChipProps {
  multiplier: number;
  size?: "sm" | "lg";
  showTooltip?: boolean;
}

/**
 * BBDX confidence multiplier 시각화.
 * 1.0 = neutral (회색), > 1.0 = 강화 (초록), < 1.0 = 약화 (빨강).
 *
 * 헌장 규칙 3 (modifier-only): 단독 시그널 X — 항상 BBDX base × multiplier.
 */
export function MultiplierChip({
  multiplier,
  size = "sm",
  showTooltip = true,
}: MultiplierChipProps) {
  const safe = Number.isFinite(multiplier) ? multiplier : 1.0;
  const pct = (safe - 1.0) * 100;
  const isNeutral = Math.abs(pct) < 0.5;
  const isPositive = pct >= 0.5;

  const sizeClasses =
    size === "lg"
      ? "px-4 py-2 text-2xl font-bold gap-2"
      : "px-2 py-1 text-sm font-semibold gap-1";

  const colorClasses = isNeutral
    ? "border-muted-foreground/30 bg-muted/20 text-muted-foreground"
    : isPositive
      ? "border-neon-green/50 bg-neon-green/10 text-neon-green"
      : "border-neon-red/50 bg-neon-red/10 text-neon-red";

  const sign = pct >= 0 ? "+" : "";
  const label = isNeutral
    ? "NEUTRAL"
    : `${sign}${pct.toFixed(1)}%`;

  const chip = (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border font-mono uppercase tracking-wider",
        sizeClasses,
        colorClasses
      )}
    >
      <span>×{safe.toFixed(2)}</span>
      <span className="opacity-70">{label}</span>
    </span>
  );

  if (!showTooltip) return chip;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{chip}</TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs">
        <p className="text-xs">
          BBDX confidence multiplier — 헌장 규칙 3.
        </p>
        <p className="text-[10px] text-muted-foreground mt-1">
          single 시그널 발행 X. BBDX base 점수에 곱해져 최종 confidence 산출.
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
