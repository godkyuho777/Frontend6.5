import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { riskBandMeta, bandFromScore, type RiskBand } from "./riskBandMeta";

interface RiskBadgeProps {
  /** 0-100, 높을수록 위험. undefined 이면 — 표시. */
  score?: number;
  /** 백엔드가 내려준 band. 없으면 score 로 파생. */
  band?: RiskBand;
  className?: string;
}

/**
 * 테이블 셀용 컴팩트 리스크 표시 — Home.tsx 의 signalStrength 막대(~1017-1051)를
 * 미러한 얇은 색상 막대 + 숫자 점수. band 별 색상은 riskBandMeta 단일 소스 사용.
 *
 * score 미정 시 — 렌더. Tooltip 으로 band 라벨(안정/주의/경계/위험) +
 * "리스크 점수 (0-100, 높을수록 위험)" 안내.
 */
export function RiskBadge({ score, band, className }: RiskBadgeProps) {
  // score 가 없으면 placeholder.
  if (score === undefined || score === null || Number.isNaN(score)) {
    return (
      <span className={cn("font-sans text-xs text-muted-foreground", className)}>
        —
      </span>
    );
  }

  const effectiveBand: RiskBand = band ?? bandFromScore(score);
  const meta = riskBandMeta(effectiveBand);
  const clamped = Math.min(100, Math.max(0, score));

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "flex items-center justify-start gap-2",
            className
          )}
        >
          <div className="h-1.5 w-10 overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full transition-all", meta.fillClass)}
              style={{ width: `${clamped}%` }}
            />
          </div>
          <span className={cn("w-8 text-left font-sans text-xs", meta.textClass)}>
            {Math.round(score)}
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <div className="flex flex-col gap-0.5">
          <span className={cn("font-sans text-xs font-bold", meta.textClass)}>
            {meta.label}
          </span>
          <span className="font-sans text-[10px] text-muted-foreground">
            리스크 점수 (0-100, 높을수록 위험)
          </span>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

export default RiskBadge;
