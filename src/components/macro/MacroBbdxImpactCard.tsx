import { ArrowRight, Calculator } from "lucide-react";

import { HudPanel } from "@/components/HudPanel";
import { cn } from "@/lib/utils";
import type { MacroLayer } from "@shared/macro-types";
import {
  REGIME_RULEBOOK,
  type MacroRegimeDescriptor,
} from "@shared/macro-indicator-types";
import type { MacroIndicatorStatus } from "@/hooks/useMacroIndicator";

/**
 * BBDX 영향 시뮬레이션 카드.
 *  - 현재 macro multiplier 가 곱셈 체인에서 어떻게 BBDX 점수를 조정하는지 표 형식 시각화.
 *  - 다른 regime 으로 전환했을 때의 simulated final_score 미리보기.
 *
 * 가정: base BBDX score = 65, other_dims_mult = 1.00 (단순화).
 *       실제 EntryDecision 은 signal + wave + onchain 등 다차원 곱셈.
 */
interface MacroBbdxImpactCardProps {
  layer: MacroLayer | null;
  status: MacroIndicatorStatus;
}

const BASE_SCORE = 65;
const OTHER_DIMS_MULT = 1.0;

function calcFinal(
  baseScore: number,
  macroMult: number,
  freshnessMult: number,
  othersMult: number,
): number {
  // freshness 가 base 가 1 일 때 multiplier 효과 약화 (mult - 1)*freshness 모델
  const effective = 1 + (macroMult - 1) * freshnessMult;
  return baseScore * effective * othersMult;
}

export function MacroBbdxImpactCard({
  layer,
  status,
}: MacroBbdxImpactCardProps) {
  const currentMult = layer?.multiplier ?? 1.0;
  const freshnessMult = layer?.freshness_mult ?? 1.0;
  const currentRegime =
    REGIME_RULEBOOK.find(r => r.key === (layer?.regime ?? "neutral")) ??
    REGIME_RULEBOOK[2];

  const finalScore = calcFinal(
    BASE_SCORE,
    currentMult,
    freshnessMult,
    OTHER_DIMS_MULT,
  );

  const isStub = status === "stub" || layer == null;
  const variant = currentMult < 0.7 ? "danger" : "default";

  return (
    <HudPanel
      title="BBDX Impact Simulator"
      subtitle="헌장 R3 — modifier-only · 곱셈 체인"
      variant={variant}
    >
      <div className="space-y-4">
        {/* 곱셈 체인 시각화 */}
        <div className="hud-frame p-3">
          <div className="font-mono text-[10px] text-muted-foreground tracking-wider mb-2">
            현재 곱셈 체인 (예시: base score = {BASE_SCORE})
          </div>
          <div className="flex flex-wrap items-center gap-2 font-mono text-sm">
            <span className="rounded-md bg-muted/40 px-2 py-1 text-foreground">
              {BASE_SCORE}
            </span>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <span
              className={cn(
                "rounded-md px-2 py-1 font-bold",
                currentRegime.bgClass,
                currentRegime.textClass,
              )}
            >
              ×{currentMult.toFixed(2)} (macro)
            </span>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <span className="rounded-md bg-muted/40 px-2 py-1 text-muted-foreground">
              ×{freshnessMult.toFixed(2)} (fresh)
            </span>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <span className="rounded-md bg-muted/40 px-2 py-1 text-muted-foreground">
              ×{OTHER_DIMS_MULT.toFixed(2)} (others)
            </span>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <span
              className={cn(
                "rounded-md px-2 py-1 font-bold",
                finalScore < BASE_SCORE
                  ? "bg-red-500/15 text-red-400"
                  : finalScore > BASE_SCORE
                    ? "bg-emerald-500/15 text-neon-green"
                    : "bg-muted/40 text-foreground",
              )}
            >
              {finalScore.toFixed(1)}
            </span>
          </div>
          {isStub && (
            <div className="font-mono text-[10px] text-orange-300/80 mt-2">
              STUB — multiplier 1.00 default. 실데이터 진입 후 실제 값 표시.
            </div>
          )}
        </div>

        {/* 5단계 시뮬레이터 */}
        <div>
          <div className="font-mono text-[10px] text-muted-foreground tracking-wider mb-2 flex items-center gap-1.5">
            <Calculator className="h-3 w-3" />
            regime 전환 시 final score 시뮬레이션 (base {BASE_SCORE})
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
            {REGIME_RULEBOOK.map(r => (
              <SimulatorChip
                key={r.key}
                descriptor={r}
                baseScore={BASE_SCORE}
                freshnessMult={freshnessMult}
                isCurrent={r.key === (layer?.regime ?? "neutral")}
              />
            ))}
          </div>
        </div>

        {/* 면책 */}
        <div className="rounded-md bg-muted/30 p-2">
          <div className="font-mono text-[10px] text-muted-foreground leading-relaxed">
            본 시뮬레이터는 단일 차원 (macro) 의 효과만 표시. 실제 EntryDecision
            은 signal × wave × structure × volatility × volume × macro ×
            onchain 의 7차원 곱셈입니다. 헌장 R3 — macro 단독으로는 entry 결정
            X.
          </div>
        </div>
      </div>
    </HudPanel>
  );
}

function SimulatorChip({
  descriptor,
  baseScore,
  freshnessMult,
  isCurrent,
}: {
  descriptor: MacroRegimeDescriptor;
  baseScore: number;
  freshnessMult: number;
  isCurrent: boolean;
}) {
  const simulated = calcFinal(
    baseScore,
    descriptor.multiplier,
    freshnessMult,
    OTHER_DIMS_MULT,
  );
  return (
    <div
      className={cn(
        "rounded-md border p-2 text-center transition",
        isCurrent
          ? cn(descriptor.bgClass, "ring-1 ring-foreground/30")
          : "border-foreground/10 bg-card",
      )}
    >
      <div
        className={cn(
          "font-mono text-[9px] tracking-wider",
          isCurrent ? descriptor.textClass : "text-muted-foreground",
        )}
      >
        {descriptor.label}
      </div>
      <div
        className={cn(
          "font-display text-base font-bold mt-0.5",
          isCurrent ? descriptor.textClass : "text-muted-foreground/70",
        )}
      >
        {simulated.toFixed(1)}
      </div>
      <div className="font-mono text-[9px] text-muted-foreground/70">
        ×{descriptor.multiplier.toFixed(2)}
      </div>
      {isCurrent && (
        <div
          className={cn(
            "font-mono text-[9px] mt-0.5",
            descriptor.textClass,
          )}
        >
          ← 현재
        </div>
      )}
    </div>
  );
}
