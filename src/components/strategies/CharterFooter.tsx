import { HudPanel } from "@/components/HudPanel";
import { Badge } from "@/components/ui/badge";
import { Info } from "lucide-react";

/**
 * 6개 modifier 페이지 공통 footer — 헌장 규칙 3 면책.
 */
export function CharterFooter({
  isBeta = false,
  extraNote,
}: {
  isBeta?: boolean;
  extraNote?: string;
}) {
  return (
    <HudPanel className="mt-6">
      <div className="flex items-start gap-3">
        <Info className="h-4 w-4 text-neon-cyan mt-0.5 shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-display text-xs font-bold tracking-wider uppercase text-neon-cyan">
              헌장 규칙 3 — Modifier Only
            </span>
            <Badge
              variant="outline"
              className="font-mono text-[9px] border-neon-cyan/40 text-neon-cyan"
            >
              CHARTER
            </Badge>
            {isBeta && (
              <Badge
                variant="outline"
                className="font-mono text-[9px] border-orange-400/60 text-orange-300 bg-orange-500/10"
              >
                BETA — calibration 미완
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            본 modifier 는 BBDX 시그널의{" "}
            <span className="text-neon-cyan font-mono">
              신뢰도 multiplier (0.30~1.40)
            </span>{" "}
            로만 작동. 단독 매매 신호 발행 X. (Tradelab 헌장 규칙 3 — Modifier Only)
          </p>
          <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
            현재 임계값은 임시 calibration — 백테스트 엔진 결과로 후속 갱신
            예정. v6.5 머지 후 EntryDecision 곱셈 체인에 정식 통합.
          </p>
          {extraNote && (
            <p className="text-[11px] text-orange-300/80 leading-relaxed">
              {extraNote}
            </p>
          )}
        </div>
      </div>
    </HudPanel>
  );
}
