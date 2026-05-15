import { Clock } from "lucide-react";

import { HudPanel } from "@/components/HudPanel";
import { cn } from "@/lib/utils";
import type { MacroLayer } from "@shared/macro-types";
import {
  REGIME_RULEBOOK,
  type MacroRegimeDescriptor,
} from "@shared/macro-indicator-types";
import type { MacroIndicatorStatus } from "@/hooks/useMacroIndicator";

function fmtAge(hours: number | null): string {
  if (hours == null || !Number.isFinite(hours)) return "—";
  if (hours < 1) return `${(hours * 60).toFixed(0)}min ago`;
  if (hours < 24) return `${hours.toFixed(1)}h ago`;
  return `${(hours / 24).toFixed(1)}d ago`;
}

interface MacroRegimeCardProps {
  layer: MacroLayer | null;
  status: MacroIndicatorStatus;
  ageHours: number | null;
  freshnessMult: number | null;
}

export function MacroRegimeCard({
  layer,
  status,
  ageHours,
  freshnessMult,
}: MacroRegimeCardProps) {
  const regimeKey = layer?.regime ?? "neutral";
  const desc =
    REGIME_RULEBOOK.find(r => r.key === regimeKey) ?? REGIME_RULEBOOK[2];
  const isStub = status === "stub" || layer == null;
  const isStale = status === "stale";

  return (
    <HudPanel
      title="Current Regime"
      subtitle="MACRO_v2 § score → regime → multiplier"
    >
      <div className="space-y-3">
        {/* Big regime badge */}
        <div
          className={cn(
            "rounded-lg border p-4 flex items-center justify-between flex-wrap gap-3",
            desc.bgClass,
          )}
        >
          <div>
            <div className="font-mono text-[10px] text-muted-foreground tracking-wider">
              regime
            </div>
            <div
              className={cn(
                "font-display text-3xl font-bold inline-flex items-center gap-2 mt-0.5",
                desc.textClass,
              )}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: desc.oklch }}
              />
              {desc.label}
            </div>
            {isStub && (
              <div className="font-mono text-[10px] text-orange-300/80 mt-1">
                STUB (default = NEUTRAL · FRED 미설정)
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="font-mono text-[10px] text-muted-foreground tracking-wider">
              multiplier
            </div>
            <div className={cn("font-display text-3xl font-bold", desc.textClass)}>
              ×{desc.multiplier.toFixed(2)}
            </div>
          </div>
        </div>

        {/* 한국어 설명 */}
        <div className="rounded-md bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground leading-relaxed">
            {desc.description}
          </p>
        </div>

        {/* Freshness row */}
        <div
          className={cn(
            "rounded-md p-2 flex items-center gap-3 font-mono text-[10px]",
            isStale ? "bg-yellow-500/10 border border-yellow-500/30" : "bg-card",
          )}
        >
          <Clock
            className={cn("h-3.5 w-3.5", isStale ? "text-neon-yellow" : "text-primary")}
          />
          <span className="text-muted-foreground">데이터 경과:</span>
          <span className={isStale ? "text-neon-yellow" : "text-foreground"}>
            {fmtAge(ageHours)}
          </span>
          <span className="text-muted-foreground">· freshness</span>
          <span className={isStale ? "text-neon-yellow" : "text-primary"}>
            ×{freshnessMult == null ? "—" : freshnessMult.toFixed(2)}
          </span>
        </div>

        {/* 5단계 룰북 미니 표 */}
        <div className="grid grid-cols-5 gap-1">
          {REGIME_RULEBOOK.map(r => (
            <RegimeChip key={r.key} descriptor={r} active={r.key === regimeKey} />
          ))}
        </div>
      </div>
    </HudPanel>
  );
}

function RegimeChip({
  descriptor,
  active,
}: {
  descriptor: MacroRegimeDescriptor;
  active: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-sm border p-1.5 text-center transition",
        active
          ? cn(descriptor.bgClass, descriptor.textClass, "ring-1 ring-foreground/20")
          : "border-foreground/10 text-muted-foreground/60 bg-muted/10",
      )}
    >
      <div className="font-mono text-[9px] tracking-wider">{descriptor.label}</div>
      <div
        className={cn(
          "font-display text-[11px] font-bold",
          active ? descriptor.textClass : "text-muted-foreground/50",
        )}
      >
        ×{descriptor.multiplier.toFixed(2)}
      </div>
    </div>
  );
}
