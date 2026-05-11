import { HudPanel } from "@/components/HudPanel";
import { CharterFooter } from "@/components/strategies/CharterFooter";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import {
  ArrowRight,
  BarChart2,
  BarChart3,
  Database,
  Loader2,
  Waves,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  TrackerLayer,
  TrackerModifier,
} from "@tradelab/backend/router";
import type { LucideIcon } from "lucide-react";

/**
 * /trackers — 3-Layer Tracker Hub 메인 인덱스.
 *
 * Layer 별 카드 + 시간 척도 다이어그램으로 BBDX 헌장의 멀티 타임프레임 구조를
 * 한눈에 보여준다. 7차원 온체인은 별도 카드.
 */

type LayerMeta = {
  layer: TrackerLayer;
  title: string;
  subtitle: string;
  scale: string;
  dims: string;
  icon: LucideIcon;
  route: string;
  rowBars: number;
  rowSegments: { width: number; gap: number }[]; // Tailwind grid 단위로 표현되는 시간 척도
};

const LAYERS: LayerMeta[] = [
  {
    layer: "macro",
    title: "Macro Tracker",
    subtitle: "Layer 3 — 수개월~수년 거시 컨텍스트",
    scale: "수개월 ~ 수년",
    dims: "6차원",
    icon: BarChart2,
    route: "/trackers/macro",
    rowBars: 1,
    rowSegments: [{ width: 100, gap: 0 }],
  },
  {
    layer: "wave",
    title: "Wave Tracker",
    subtitle: "Layer 2 — 며칠~몇주 파동",
    scale: "며칠 ~ 몇주",
    dims: "3·5차원",
    icon: Waves,
    route: "/trackers/wave",
    rowBars: 3,
    rowSegments: [
      { width: 28, gap: 6 },
      { width: 18, gap: 6 },
      { width: 24, gap: 0 },
    ],
  },
  {
    layer: "signal",
    title: "Signal Tracker",
    subtitle: "Layer 1 — 4H 캔들 단위 진입 트리거",
    scale: "4H 캔들",
    dims: "1·2·3·4차원",
    icon: BarChart3,
    route: "/trackers/signal",
    rowBars: 24,
    rowSegments: [], // 캔들 그리드는 따로 렌더
  },
];

function TimeScaleDiagram() {
  return (
    <div className="space-y-3 font-mono">
      {LAYERS.map((l) => (
        <div key={l.layer} className="flex items-center gap-3">
          <div className="w-24 shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">
            {l.layer === "macro" ? "Layer 3" : l.layer === "wave" ? "Layer 2" : "Layer 1"}
          </div>
          <div className="flex-1 flex items-center gap-[3px] h-3">
            {l.layer === "signal" ? (
              // 캔들 단위 — 촘촘한 막대 24개
              Array.from({ length: 24 }).map((_, i) => (
                <div
                  key={i}
                  className="flex-1 h-full bg-neon-pink/60 rounded-[1px]"
                />
              ))
            ) : l.layer === "wave" ? (
              // 파동 — 굵은 segment 몇 개
              <>
                <div className="h-full bg-neon-cyan/70 rounded-sm" style={{ width: "28%" }} />
                <div className="w-[6%]" />
                <div className="h-full bg-neon-cyan/70 rounded-sm" style={{ width: "18%" }} />
                <div className="w-[6%]" />
                <div className="h-full bg-neon-cyan/70 rounded-sm" style={{ width: "24%" }} />
                <div className="flex-1" />
              </>
            ) : (
              // 매크로 — 한 줄 통째
              <div className="h-full w-full bg-neon-green/60 rounded-sm" />
            )}
          </div>
          <div className="w-32 shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground text-right">
            {l.scale}
          </div>
        </div>
      ))}
    </div>
  );
}

function LayerCard({
  meta,
  modifierCount,
  isLoading,
}: {
  meta: LayerMeta;
  modifierCount: number;
  isLoading: boolean;
}) {
  const [, setLocation] = useLocation();
  const Icon = meta.icon;
  return (
    <button
      type="button"
      onClick={() => setLocation(meta.route)}
      className="text-left"
    >
      <HudPanel
        variant="highlight"
        className={cn(
          "h-full transition-all cursor-pointer",
          "hover:border-neon-pink/60 hover:shadow-[0_0_24px_rgba(255,46,160,0.15)]"
        )}
      >
        <div className="flex flex-col gap-3 min-h-[180px]">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <Icon className="h-5 w-5 text-neon-cyan" />
              <h3 className="font-display text-base font-bold tracking-wider uppercase text-neon-pink glow-pink">
                {meta.title}
              </h3>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground/60" />
          </div>
          <p className="text-xs font-mono text-muted-foreground">
            {meta.subtitle}
          </p>
          <div className="flex items-center gap-1.5 flex-wrap mt-auto">
            <Badge
              variant="outline"
              className="font-mono text-[9px] border-neon-cyan/40 text-neon-cyan"
            >
              {meta.dims}
            </Badge>
            <Badge
              variant="outline"
              className="font-mono text-[9px] border-neon-green/40 text-neon-green"
            >
              {isLoading ? "..." : `${modifierCount} modifiers`}
            </Badge>
          </div>
          <div className="text-[10px] font-mono text-muted-foreground/70 uppercase tracking-wider">
            시간 척도 · {meta.scale}
          </div>
        </div>
      </HudPanel>
    </button>
  );
}

export default function TrackersIndex() {
  const [, setLocation] = useLocation();
  const { data, isLoading } = trpc.taxonomy.list.useQuery();

  const counts: Record<TrackerLayer, number> = {
    signal: 0,
    wave: 0,
    macro: 0,
    onchain: 0,
  };
  if (data) {
    for (const m of data as readonly TrackerModifier[]) {
      counts[m.layer] = (counts[m.layer] ?? 0) + 1;
    }
  }

  return (
    <div className="space-y-4">
      <HudPanel variant="highlight">
        <div className="flex flex-col gap-2 mb-4">
          <h1 className="font-display text-2xl font-bold tracking-wider uppercase text-neon-pink glow-pink">
            3-Layer Tracker Hub
          </h1>
          <p className="font-mono text-xs text-muted-foreground">
            BBDX 헌장의 멀티 타임프레임 modifier 구조
          </p>
        </div>

        <div className="rounded-sm border border-border/40 bg-background/40 p-3 mb-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Tradelab 의 모든 modifier 는 시간 척도에 따라 세 Layer 로 분리된다.
            각 Layer 는 서로 독립된 입력을 BBDX 시그널의 신뢰도 multiplier 로만 합산
            (헌장 규칙 3). 단독으로 매매 신호를 발행하는 modifier 는 존재하지 않는다.
          </p>
        </div>

        {/* 시간 척도 다이어그램 */}
        <div className="rounded-sm border border-border/40 bg-background/60 p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="font-display text-xs font-bold tracking-wider uppercase text-neon-cyan">
              Time Scale
            </span>
            {isLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          </div>
          <TimeScaleDiagram />
        </div>

        {/* Layer 카드 그리드 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {LAYERS.map((meta) => (
            <LayerCard
              key={meta.layer}
              meta={meta}
              modifierCount={counts[meta.layer]}
              isLoading={isLoading}
            />
          ))}
        </div>

        {/* Onchain 별도 카드 (7차원) */}
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setLocation("/onchain")}
            className="text-left w-full"
          >
            <HudPanel className="hover:border-neon-pink/60 hover:shadow-[0_0_24px_rgba(255,46,160,0.15)] transition-all cursor-pointer">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-neon-cyan" />
                    <h3 className="font-display text-sm font-bold tracking-wider uppercase text-neon-pink glow-pink">
                      Onchain Tracker
                    </h3>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <Badge
                      variant="outline"
                      className="font-mono text-[9px] border-neon-cyan/40 text-neon-cyan"
                    >
                      7차원 온체인
                    </Badge>
                    <Badge
                      variant="outline"
                      className="font-mono text-[9px] border-neon-cyan/40 text-neon-cyan"
                    >
                      별도 Layer
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                    Coinbase Premium · SSR · 7차원 modifier 합산 → BBDX 진입/EXIT 가중치.
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground/60 shrink-0 mt-1" />
              </div>
            </HudPanel>
          </button>
        </div>
      </HudPanel>

      <CharterFooter />
    </div>
  );
}
