import { HudPanel } from "@/components/HudPanel";
import { Badge } from "@/components/ui/badge";
import { CharterFooter } from "@/components/strategies/CharterFooter";
import { ModifierCard } from "@/components/trackers/ModifierCard";
import { trpc } from "@/lib/trpc";
import { Loader2, AlertCircle } from "lucide-react";
import type { TrackerLayer, TrackerModifier } from "@tradelab/backend/router";

/**
 * 3-Layer Tracker Hub 공통 컴포넌트.
 *
 * Signal/Wave/Macro Hub 가 본 컴포넌트를 다른 메타로 호출하여 일관된 UI 를 유지.
 * 자식이 modifier 카드 그리드 아래에 추가 카드를 넣고 싶으면 `extraSlot` 사용.
 */

export interface TrackerHubProps {
  layer: TrackerLayer;
  title: string;
  subtitle: string;
  explanation: string;
  /** 헌장 차원 뱃지 (예: "1·2·3·4 차원 커버") */
  dimensionBadge: string;
  /** 카드 그리드 아래 추가 영역 (Wave/Macro Hub 의 legacy 카드 등) */
  extraSlot?: React.ReactNode;
}

export function TrackerHub({
  layer,
  title,
  subtitle,
  explanation,
  dimensionBadge,
  extraSlot,
}: TrackerHubProps) {
  const { data, isLoading, error } = trpc.taxonomy.byLayer.useQuery({ layer });

  return (
    <div className="space-y-4">
      <HudPanel variant="highlight">
        {/* Header */}
        <div className="flex flex-col gap-2 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-display text-2xl font-bold tracking-wider uppercase text-neon-pink glow-pink">
              {title}
            </h1>
            <Badge
              variant="outline"
              className="font-mono text-[10px] border-neon-cyan/40 text-neon-cyan"
            >
              {dimensionBadge}
            </Badge>
          </div>
          <p className="font-mono text-xs text-muted-foreground">{subtitle}</p>
        </div>

        {/* Explanation */}
        <div className="rounded-sm border border-border/40 bg-background/40 p-3 mb-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {explanation}
          </p>
        </div>

        {/* Modifier Grid */}
        {isLoading && (
          <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground font-mono text-xs">
            <Loader2 className="h-4 w-4 animate-spin" />
            modifier 목록 로드 중...
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-sm border border-neon-red/40 bg-neon-red/5 p-3 text-xs text-neon-red font-mono">
            <AlertCircle className="h-4 w-4" />
            taxonomy 로드 실패 — {error.message}
          </div>
        )}

        {!isLoading && !error && data && data.length === 0 && (
          <div className="rounded-sm border border-border/40 bg-background/40 p-6 text-center text-muted-foreground font-mono text-xs">
            등록된 modifier 가 없습니다.
          </div>
        )}

        {!isLoading && !error && data && data.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.map((m: TrackerModifier) => (
              <ModifierCard key={m.slug} modifier={m} />
            ))}
          </div>
        )}

        {/* Hub 별 추가 슬롯 (legacy 카드, 외부 링크 등) */}
        {extraSlot && <div className="mt-4">{extraSlot}</div>}
      </HudPanel>

      <CharterFooter />
    </div>
  );
}
