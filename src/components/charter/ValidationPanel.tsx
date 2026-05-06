import { cn } from "@/lib/utils";
import {
  CHARTER_DIMENSIONS,
  CHARTER_DIMENSION_LABELS,
  type CharterValidationResult,
} from "@/lib/charter-types";

interface ValidationPanelProps {
  result: CharterValidationResult;
  className?: string;
}

const RULE_LABELS: Record<1 | 2 | 3, string> = {
  1: "Rule 1 — dimension duplicate",
  2: "Rule 2 — backtest alpha",
  3: "Rule 3 — no standalone signal",
};

export function ValidationPanel({ result, className }: ValidationPanelProps) {
  const ruleStatus = (rule: 1 | 2 | 3) =>
    result.violations.filter((v) => v.rule === rule).length === 0;

  return (
    <div
      className={cn(
        "rounded-sm border border-border/50 bg-card/60 p-3 font-mono text-xs",
        className
      )}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-muted-foreground">
          Charter {result.charterVersion} · {result.strategy}
        </span>
        <span
          className={cn(
            "rounded-sm border px-1.5 py-0.5 text-[10px] uppercase",
            result.passed
              ? "border-neon-green/40 text-neon-green"
              : "border-neon-yellow/40 text-neon-yellow"
          )}
        >
          {result.passed ? "✓ pass" : "⚠ partial"}
        </span>
      </div>

      <div className="mb-3 space-y-1">
        {([1, 2, 3] as const).map((rule) => {
          const ok = ruleStatus(rule);
          const violations = result.violations.filter((v) => v.rule === rule);
          return (
            <div key={rule}>
              <div
                className={cn(
                  "flex items-center gap-2",
                  ok ? "text-neon-green" : "text-neon-red"
                )}
              >
                <span aria-hidden="true">{ok ? "✓" : "✗"}</span>
                <span>{RULE_LABELS[rule]}</span>
              </div>
              {violations.map((v, i) => (
                <div
                  key={i}
                  className="ml-5 text-[11px] leading-tight text-muted-foreground"
                >
                  – {v.message}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      <div className="mb-2 text-muted-foreground">
        7-dimension coverage: {result.coverage.covered}/{result.coverage.total}
      </div>
      <div className="space-y-0.5">
        {CHARTER_DIMENSIONS.map((dim) => {
          const indicators = result.dimensionsCovered[dim];
          const hasCoverage = indicators.length > 0;
          return (
            <div
              key={dim}
              className={cn(
                "flex justify-between gap-2",
                hasCoverage ? "text-foreground" : "text-neon-yellow"
              )}
            >
              <span className="flex items-center gap-1">
                <span aria-hidden="true">{hasCoverage ? "✓" : "⚠"}</span>
                {CHARTER_DIMENSION_LABELS[dim]}
              </span>
              <span className="truncate text-right text-muted-foreground">
                {hasCoverage ? indicators.join(", ") : "absent"}
              </span>
            </div>
          );
        })}
      </div>

      {result.missingDimensions.length > 0 && (
        <div className="mt-3 border-t border-border/40 pt-2 text-muted-foreground">
          <div className="mb-1 text-[11px] uppercase tracking-wide">
            Recommended additions
          </div>
          {result.missingDimensions.map((m) => (
            <div key={m.dimension} className="text-[11px]">
              · {m.ko}: try {m.suggested.join(" or ")}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
