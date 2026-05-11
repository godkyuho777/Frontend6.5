import { HudPanel } from "@/components/HudPanel";
import { Badge } from "@/components/ui/badge";
import { TrackerHub } from "@/components/trackers/TrackerHub";
import { useLocation } from "wouter";
import { ArrowRight, TrendingUp, Waves } from "lucide-react";

/**
 * Layer 2 — Wave Tracker Hub.
 *
 * 며칠~몇주 파동 단위. 5차원 구조 + 3차원 추세(파동) modifier.
 * 기존 Wave Sentiment / Trend Analysis 페이지도 같은 Layer 에 속하므로
 * taxonomy 외 정적 카드로 추가 표시.
 */
export default function WaveTrackerHub() {
  const [, setLocation] = useLocation();

  const legacyCards = (
    <div className="space-y-2">
      <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        Wave Analysis · Legacy 페이지
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setLocation("/wave/sentiment")}
          className="text-left"
        >
          <HudPanel className="hover:border-neon-pink/60 hover:shadow-[0_0_24px_rgba(255,46,160,0.15)] transition-all cursor-pointer h-full">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Waves className="h-4 w-4 text-neon-cyan" />
                  <h3 className="font-display text-sm font-bold tracking-wider uppercase text-neon-pink glow-pink">
                    Wave Sentiment & Matrix
                  </h3>
                </div>
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  <Badge
                    variant="outline"
                    className="font-mono text-[9px] border-neon-cyan/40 text-neon-cyan"
                  >
                    3·5차원
                  </Badge>
                  <Badge
                    variant="outline"
                    className="font-mono text-[9px] border-muted-foreground/40 text-muted-foreground"
                  >
                    LEGACY · ACTIVE
                  </Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                  파동 sentiment 매트릭스 — 멀티 TF 정렬 + 강도 시각화.
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground/60 shrink-0" />
            </div>
          </HudPanel>
        </button>

        <button
          type="button"
          onClick={() => setLocation("/wave/trend")}
          className="text-left"
        >
          <HudPanel className="hover:border-neon-pink/60 hover:shadow-[0_0_24px_rgba(255,46,160,0.15)] transition-all cursor-pointer h-full">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-neon-cyan" />
                  <h3 className="font-display text-sm font-bold tracking-wider uppercase text-neon-pink glow-pink">
                    Trend Analysis
                  </h3>
                </div>
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  <Badge
                    variant="outline"
                    className="font-mono text-[9px] border-neon-cyan/40 text-neon-cyan"
                  >
                    3차원
                  </Badge>
                  <Badge
                    variant="outline"
                    className="font-mono text-[9px] border-muted-foreground/40 text-muted-foreground"
                  >
                    LEGACY · ACTIVE
                  </Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                  v2.0 멀티 TF 추세 분석 엔진 (~700줄) — 파동 추세 통합 뷰.
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground/60 shrink-0" />
            </div>
          </HudPanel>
        </button>
      </div>
    </div>
  );

  return (
    <TrackerHub
      layer="wave"
      title="Wave Tracker"
      subtitle="Layer 2 — 며칠~몇주 파동 단위"
      dimensionBadge="3·5 차원 커버"
      explanation={
        "5차원 구조 + 3차원 추세(파동). " +
        "단일 캔들이 아닌 파동 흐름을 측정. " +
        "기존 Wave Sentiment / Trend Analysis 도 이 Layer 에 포함."
      }
      extraSlot={legacyCards}
    />
  );
}
