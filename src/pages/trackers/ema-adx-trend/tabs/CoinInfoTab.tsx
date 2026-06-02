/**
 * 코인 정보 탭 — 사용자 요청 (2026-05-11) 신규 6번째 탭.
 *
 * 각 코인별 용도 / 목적 / 비전을 정리. 데이터는 frontend 정적 모듈
 * (data/coin-info.ts) 에서 import. 시장 메트릭은 본 탭과 무관 (다른 탭 책임).
 */

import { HudPanel } from "@/components/HudPanel";
import { Badge } from "@/components/ui/badge";
import { getCoinInfo } from "../data/coin-info";
import { ExternalLink, Sparkles, Target, Compass, Wrench, Zap } from "lucide-react";

export interface CoinInfoTabProps {
  symbol: string;
}

export function CoinInfoTab({ symbol }: CoinInfoTabProps) {
  const info = getCoinInfo(symbol);

  return (
    <div className="space-y-4">
      {/* 상단 — 정식 명칭 + 카테고리 + tagline */}
      <HudPanel
        title={info.name}
        subtitle={info.category}
        variant="highlight"
      >
        <div className="space-y-3">
          <div className="flex items-start gap-2">
            <Sparkles className="h-4 w-4 mt-0.5 text-neon-cyan shrink-0" />
            <p className="font-mono text-sm text-foreground/90 leading-relaxed">
              {info.tagline}
            </p>
          </div>
          {info.website && (
            <div className="pt-2 border-t border-border/20">
              <a
                href={info.website}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[11px] text-neon-cyan hover:text-neon-pink inline-flex items-center gap-1"
              >
                <ExternalLink className="h-3 w-3" />
                {info.website.replace(/^https?:\/\//, "")}
              </a>
            </div>
          )}
        </div>
      </HudPanel>

      {/* 용도 / 목적 */}
      <HudPanel
        title="용도 / 목적"
        subtitle="이 코인이 해결하는 문제"
      >
        <div className="flex items-start gap-2">
          <Target className="h-4 w-4 mt-1 text-neon-yellow shrink-0" />
          <p className="font-mono text-xs text-foreground/90 leading-relaxed">
            {info.purpose}
          </p>
        </div>
      </HudPanel>

      {/* 비전 */}
      <HudPanel
        title="비전"
        subtitle="장기 목표 / 생태계 위치"
      >
        <div className="flex items-start gap-2">
          <Compass className="h-4 w-4 mt-1 text-neon-pink shrink-0" />
          <p className="font-mono text-xs text-foreground/90 leading-relaxed">
            {info.vision}
          </p>
        </div>
      </HudPanel>

      {/* 활용 사례 */}
      {info.useCases.length > 0 && (
        <HudPanel
          title="주요 활용 사례"
          subtitle={`활용 사례 · ${info.useCases.length}개`}
        >
          <ul className="space-y-2">
            {info.useCases.map((u, i) => (
              <li
                key={i}
                className="flex items-start gap-2 font-mono text-xs text-foreground/90"
              >
                <Zap className="h-3 w-3 mt-1 text-neon-green shrink-0" />
                <span>{u}</span>
              </li>
            ))}
          </ul>
        </HudPanel>
      )}

      {/* 핵심 기술 (선택) */}
      {info.techHighlights && info.techHighlights.length > 0 && (
        <HudPanel
          title="핵심 기술 / 차별점"
          subtitle="기술 요약"
        >
          <div className="flex items-start gap-2">
            <Wrench className="h-4 w-4 mt-1 text-neon-cyan shrink-0" />
            <div className="flex flex-wrap gap-2">
              {info.techHighlights.map((t, i) => (
                <Badge
                  key={i}
                  className="font-mono text-[10px] bg-neon-cyan/10 text-neon-cyan border-neon-cyan/40 hover:bg-neon-cyan/15"
                >
                  {t}
                </Badge>
              ))}
            </div>
          </div>
        </HudPanel>
      )}

      {/* Footer note */}
      <p className="font-mono text-[10px] text-muted-foreground/60 text-center pt-2">
        💡 본 정보는 정적 메타 데이터입니다. 시세·메트릭은 다른 탭을 참조하세요.
        새 코인 정보 추가는 frontend `data/coin-info.ts` 파일 갱신으로 즉시 반영됩니다.
      </p>
    </div>
  );
}
