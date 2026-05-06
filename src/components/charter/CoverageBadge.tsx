import { cn } from "@/lib/utils";
import type { CharterValidationResult } from "@/lib/charter-types";

interface CoverageBadgeProps {
  result: CharterValidationResult;
  className?: string;
  /** Show "rule X/Y/Z" violation count when any. */
  showViolations?: boolean;
}

export function CoverageBadge({
  result,
  className,
  showViolations = true,
}: CoverageBadgeProps) {
  const { covered, total } = result.coverage;
  const fullCoverage = covered === total;
  const hasViolations = result.violations.some(
    (v) => v.severity === "blocking" || v.severity === "critical"
  );

  const tone = fullCoverage && !hasViolations
    ? "ok"
    : hasViolations
      ? "danger"
      : "warning";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide",
        tone === "ok" && "border-neon-green/40 text-neon-green bg-neon-green/5",
        tone === "warning" &&
          "border-neon-yellow/40 text-neon-yellow bg-neon-yellow/5",
        tone === "danger" && "border-neon-red/40 text-neon-red bg-neon-red/5",
        className
      )}
      title={`Charter ${result.charterVersion} — ${result.strategy}`}
    >
      <span aria-hidden="true">
        {tone === "ok" ? "✓" : tone === "warning" ? "⚠" : "✕"}
      </span>
      <span>
        {covered}/{total} dim
      </span>
      {showViolations && result.violations.length > 0 && (
        <span className="opacity-70">· {result.violations.length} viol</span>
      )}
    </span>
  );
}
