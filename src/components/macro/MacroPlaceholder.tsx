import { HudPanel } from "@/components/HudPanel";
import { CharterFooter } from "@/components/strategies/CharterFooter";
import { Badge } from "@/components/ui/badge";
import { Construction } from "lucide-react";

/**
 * Macro Liquidity Tracker — placeholder 페이지 공통 컴포넌트.
 *
 * 백엔드 FRED 통합 전, 사이드바에서 진입 가능한 메뉴 항목의 임시 본문.
 * 헌장 stub-first 원칙: 데이터 미연결 상태를 명확히 표시하고
 * "예상 가용 시점" + "데이터 소스 (예정)" 을 사용자에게 정직하게 노출.
 */

export interface MacroPlaceholderProps {
  title: string;
  /** 헌장 차원 라벨 (예 "6차원 매크로") */
  dimension: string;
  /** 향후 통합될 데이터 소스 표기 */
  source: string;
  /** 예상 가용 분기 — "2026 Q3" 형태 */
  expectedQuarter: string;
  /** 짧은 본문 설명 (한국어 OK) */
  description: string;
}

export function MacroPlaceholder({
  title,
  dimension,
  source,
  expectedQuarter,
  description,
}: MacroPlaceholderProps) {
  return (
    <div className="space-y-4 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
              {title}
            </h1>
            <Badge variant="outline" className="font-mono text-[10px]">
              {dimension}
            </Badge>
            <Badge
              variant="outline"
              className="font-mono text-[10px] border-orange-400/60 text-orange-300 bg-orange-500/10"
            >
              COMING SOON
            </Badge>
          </div>
          <p className="text-xs font-mono text-muted-foreground mt-1">
            Macro liquidity tracker · placeholder
          </p>
        </div>
      </div>

      <HudPanel variant="highlight">
        <div className="flex items-start gap-3">
          <Construction className="h-5 w-5 text-primary mt-1 shrink-0" />
          <div className="flex-1 space-y-3">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {description}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="hud-frame p-3">
                <div className="font-mono text-[10px] text-muted-foreground tracking-wider mb-1">
                  예상 가용 시점
                </div>
                <div className="font-display text-lg font-bold text-foreground">
                  {expectedQuarter}
                </div>
              </div>
              <div className="hud-frame p-3">
                <div className="font-mono text-[10px] text-muted-foreground tracking-wider mb-1">
                  데이터 소스 (예정)
                </div>
                <div className="font-mono text-xs text-primary break-all">
                  {source}
                </div>
              </div>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="font-mono text-[11px] text-muted-foreground leading-relaxed">
                본 modifier 는 헌장 규칙 3 (modifier-only) 에 따라 BBDX 시그널의
                신뢰도 multiplier 로만 작동합니다. 단독 매매 신호 발행 X. 현재는
                백엔드 데이터 통합 + 임계값 calibration 대기 중.
              </p>
            </div>
          </div>
        </div>
      </HudPanel>

      <CharterFooter />
    </div>
  );
}
