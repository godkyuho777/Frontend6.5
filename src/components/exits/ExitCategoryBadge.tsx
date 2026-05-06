import { cn } from "@/lib/utils";
import {
  EXIT_CATEGORY_DESCRIPTION,
  EXIT_CATEGORY_LABEL,
  type ExitDecisionV63,
} from "@/lib/exit-types";

interface ExitCategoryBadgeProps {
  decision: ExitDecisionV63;
  className?: string;
  /** Show the percentage (50% / 30% / full / move) next to the label. */
  showRatio?: boolean;
}

const CATEGORY_TONE: Record<
  ExitDecisionV63["category"],
  "danger" | "warning" | "info" | "muted"
> = {
  A: "info",
  B: "danger",
  C: "muted",
  D: "warning",
  STOP: "danger",
};

export function ExitCategoryBadge({
  decision,
  className,
  showRatio = true,
}: ExitCategoryBadgeProps) {
  const tone = CATEGORY_TONE[decision.category];
  const ratioLabel = formatAction(decision);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide",
        tone === "danger" && "border-neon-red/40 text-neon-red bg-neon-red/5",
        tone === "warning" &&
          "border-neon-yellow/40 text-neon-yellow bg-neon-yellow/5",
        tone === "info" && "border-neon-cyan/40 text-neon-cyan bg-neon-cyan/5",
        tone === "muted" &&
          "border-border/60 text-muted-foreground bg-muted/30",
        className
      )}
      title={EXIT_CATEGORY_DESCRIPTION[decision.category]}
    >
      <span>EXIT-{decision.category}</span>
      <span className="opacity-70">·</span>
      <span>{EXIT_CATEGORY_LABEL[decision.category]}</span>
      {showRatio && ratioLabel && (
        <>
          <span className="opacity-70">·</span>
          <span>{ratioLabel}</span>
        </>
      )}
    </span>
  );
}

function formatAction(decision: ExitDecisionV63): string {
  if (decision.action === "move_stop") return "stop";
  if (decision.action === "full_exit") return "full";
  if (decision.action === "partial_exit") {
    const pct = Math.round(decision.ratio * 100);
    return `${pct}%`;
  }
  return "";
}
