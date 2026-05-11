import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { ChevronRight } from "lucide-react";
import type { TrackerLayer } from "@tradelab/backend/router";

/**
 * Tracker Breadcrumb — modifier 페이지 상단 소속/경로 표시.
 *
 * Phase 4 (Hub 재구성) — 6개 modifier 페이지 공통 헤더 위에 주입.
 * 사용자에게 "이 modifier 는 어느 Tracker Layer 의 몇 차원인지" 즉시 알림.
 *
 * 예시:
 *   Trackers › Signal Tracker › MACD Divergence
 *   [Signal Tracker — Layer 1 (4H 캔들 단위)]  [1차원 모멘텀]
 */

export interface TrackerBreadcrumbProps {
  layer: TrackerLayer;
  modifierName: string;
  dimensions: number[];
}

const LAYER_META: Record<
  TrackerLayer,
  { hubLabel: string; hubPath: string; fullLabel: string }
> = {
  signal: {
    hubLabel: "Signal Tracker",
    hubPath: "/trackers/signal",
    fullLabel: "Signal Tracker — Layer 1 (4H 캔들 단위)",
  },
  wave: {
    hubLabel: "Wave Tracker",
    hubPath: "/trackers/wave",
    fullLabel: "Wave Tracker — Layer 2 (며칠~몇주 파동)",
  },
  macro: {
    hubLabel: "Macro Tracker",
    hubPath: "/trackers/macro",
    fullLabel: "Macro Tracker — Layer 3 (수개월~수년 거시)",
  },
  onchain: {
    hubLabel: "Onchain Tracker",
    hubPath: "/onchain",
    fullLabel: "Onchain Tracker — Layer 3 (온체인 데이터)",
  },
};

const DIMENSION_NAME: Record<number, string> = {
  1: "모멘텀",
  2: "변동성",
  3: "추세",
  4: "거래량",
  5: "구조",
  6: "매크로",
  7: "온체인",
};

function dimensionLabel(dims: number[]): string {
  if (dims.length === 0) return "";
  return dims
    .map((d) => `${d}차원 ${DIMENSION_NAME[d] ?? ""}`.trim())
    .join(" · ");
}

export function TrackerBreadcrumb({
  layer,
  modifierName,
  dimensions,
}: TrackerBreadcrumbProps) {
  const meta = LAYER_META[layer];
  const dimLabel = dimensionLabel(dimensions);

  return (
    <div className="space-y-2 mb-1">
      {/* Path — wouter Link 로 Trackers / Layer Hub 이동 */}
      <nav
        aria-label="Tracker breadcrumb"
        className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/80"
      >
        <Link
          href="/trackers"
          className="hover:text-neon-cyan transition-colors"
        >
          Trackers
        </Link>
        <ChevronRight className="h-3 w-3 opacity-60" />
        <Link
          href={meta.hubPath}
          className="hover:text-neon-cyan transition-colors"
        >
          {meta.hubLabel}
        </Link>
        <ChevronRight className="h-3 w-3 opacity-60" />
        <span className="text-neon-pink/90 truncate">{modifierName}</span>
      </nav>

      {/* 소속 박스 — Layer 라벨 + 차원 라벨 */}
      <div className="flex items-center gap-2 flex-wrap rounded-sm border border-border/40 bg-background/40 px-3 py-2">
        <Badge
          variant="outline"
          className="font-mono text-[9px] border-neon-cyan/40 text-neon-cyan"
        >
          {meta.fullLabel}
        </Badge>
        {dimLabel && (
          <Badge
            variant="outline"
            className="font-mono text-[9px] border-neon-pink/40 text-neon-pink"
          >
            {dimLabel}
          </Badge>
        )}
      </div>
    </div>
  );
}
