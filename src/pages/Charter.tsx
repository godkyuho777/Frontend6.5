/**
 * Charter / Vision — Tradelab 의 *왜* 를 한 페이지에 담는 비전 문서.
 *
 * 7-차원 헌장 + 3 헌장 규칙 + 3 Layer 시간 척도 다이어그램 + lookahead-free 약속.
 * 데이터: `trpc.taxonomy.list` — 백엔드 SSoT 의 modifier 분포를 자동 표시.
 *
 * 이전 IA (Tracker Hub) 의 시간 척도 다이어그램 SVG 패턴을 본 페이지로 이관.
 */

import { useMemo } from "react";
import { HudPanel } from "@/components/HudPanel";
import { CharterFooter } from "@/components/strategies/CharterFooter";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  Activity,
  BarChart3,
  Box,
  Database,
  Gauge,
  Layers,
  Loader2,
  Ruler,
  Sparkles,
  TrendingUp,
  Waves,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type {
  TrackerLayer,
  TrackerModifier,
} from "@tradelab/backend/router";

// ── 7-차원 메타 ───────────────────────────────────────────────
const DIMENSIONS: Array<{
  id: number;
  name: string;
  icon: LucideIcon;
  examples: string;
  blurb: string;
}> = [
  {
    id: 1,
    name: "모멘텀",
    icon: Activity,
    examples: "RSI · MACD",
    blurb: "가격 변화율과 추세 강도를 측정. 과매수·과매도 + divergence 로 reversal 확률 가늠.",
  },
  {
    id: 2,
    name: "변동성",
    icon: Gauge,
    examples: "Bollinger Band · ATR",
    blurb: "표준편차 기반 변동성 밴드. 위치(BB) + 폭(squeeze) 으로 breakout 타이밍 결정.",
  },
  {
    id: 3,
    name: "추세",
    icon: TrendingUp,
    examples: "ADX",
    blurb: "방향성 강도 측정. ADX > 25 = 추세장, +DI/-DI 로 추세 방향 확인.",
  },
  {
    id: 4,
    name: "거래량",
    icon: BarChart3,
    examples: "Volume Ratio",
    blurb: "참여도 + 매수/매도 압력. EMA50 baseline 대비 비율로 진위 검증.",
  },
  {
    id: 5,
    name: "구조",
    icon: Box,
    examples: "Fibonacci",
    blurb: "가격 구조와 핵심 레벨. 피보나치 retracement 로 zone 식별.",
  },
  {
    id: 6,
    name: "매크로",
    icon: BarChart3,
    examples: "SOFR · Yield · DXY",
    blurb: "거시 유동성·금리·달러 컨텍스트.",
  },
  {
    id: 7,
    name: "온체인",
    icon: Database,
    examples: "Coinbase Premium · SSR · Whale",
    blurb: "온체인 자금 흐름. 거래소 프리미엄, stablecoin supply ratio, 고래 행위로 sentiment 보강.",
  },
];

// ── 3 헌장 규칙 ──────────────────────────────────────────────
const CHARTER_RULES = [
  {
    id: "R1",
    title: "차원 중복 금지",
    desc: "한 차원에 여러 modifier 가 있어도 측정 각도가 서로 달라야 한다. RSI 와 MACD 는 둘 다 모멘텀이지만 RSI 는 절대 레벨, MACD 는 EMA 차이의 변화율로 다른 각도를 본다.",
  },
  {
    id: "R2",
    title: "백테스트로 알파 검증",
    desc: "임계값과 multiplier 는 추정으로 정하지 않는다. Lookahead-free 백테스트의 calibration (BETA → Production) 을 통과한 modifier 만 진입 결정에 합산된다.",
  },
  {
    id: "R3",
    title: "단독 시그널 금지 (Modifier-Only)",
    desc: "온체인·매크로·구조 등 보조 차원은 BBDX 시그널의 신뢰도 multiplier (0.30~1.40) 로만 작동한다. 단독 매매 신호를 발행하는 modifier 는 존재하지 않는다.",
  },
];

// ── 3 Layer 시간 척도 ─────────────────────────────────────────
const LAYER_META: Record<
  Exclude<TrackerLayer, "onchain">,
  { label: string; scale: string; barColor: string; pattern: "single" | "wave" | "candle" }
> = {
  macro: {
    label: "Layer 3 — Macro",
    scale: "수개월 ~ 수년",
    barColor: "bg-neon-green/60",
    pattern: "single",
  },
  wave: {
    label: "Layer 2 — Wave",
    scale: "며칠 ~ 몇주",
    barColor: "bg-neon-cyan/70",
    pattern: "wave",
  },
  signal: {
    label: "Layer 1 — Signal",
    scale: "4H 캔들",
    barColor: "bg-neon-pink/60",
    pattern: "candle",
  },
};

const DIM_ICON: Record<number, LucideIcon> = {
  1: Activity,
  2: Gauge,
  3: TrendingUp,
  4: BarChart3,
  5: Box,
  6: BarChart3,
  7: Database,
};

function TimeScaleDiagram() {
  return (
    <div className="space-y-3 font-mono">
      {(Object.keys(LAYER_META) as Array<Exclude<TrackerLayer, "onchain">>).map(
        (layer) => {
          const meta = LAYER_META[layer];
          return (
            <div key={layer} className="flex items-center gap-3">
              <div className="w-32 shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">
                {meta.label}
              </div>
              <div className="flex-1 flex items-center gap-[3px] h-3">
                {meta.pattern === "candle" ? (
                  Array.from({ length: 24 }).map((_, i) => (
                    <div
                      key={i}
                      className={cn("flex-1 h-full rounded-[1px]", meta.barColor)}
                    />
                  ))
                ) : meta.pattern === "wave" ? (
                  <>
                    <div className={cn("h-full rounded-sm", meta.barColor)} style={{ width: "28%" }} />
                    <div className="w-[6%]" />
                    <div className={cn("h-full rounded-sm", meta.barColor)} style={{ width: "18%" }} />
                    <div className="w-[6%]" />
                    <div className={cn("h-full rounded-sm", meta.barColor)} style={{ width: "24%" }} />
                    <div className="flex-1" />
                  </>
                ) : (
                  <div className={cn("h-full w-full rounded-sm", meta.barColor)} />
                )}
              </div>
              <div className="w-28 shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground text-right">
                {meta.scale}
              </div>
            </div>
          );
        },
      )}
    </div>
  );
}

// ── Layer-별 modifier 박스 ───────────────────────────────────
function LayerModifiers({
  layer,
  modifiers,
}: {
  layer: Exclude<TrackerLayer, "onchain">;
  modifiers: readonly TrackerModifier[];
}) {
  const meta = LAYER_META[layer];
  const items = modifiers.filter((m) => m.layer === layer);
  return (
    <div className="hud-frame p-3">
      <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-2">
        {meta.label} · {meta.scale}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.length === 0 ? (
          <span className="text-[11px] text-muted-foreground/70 font-mono">없음</span>
        ) : (
          items.map((m) => (
            <Badge
              key={m.slug}
              variant="outline"
              className={cn(
                "font-mono text-[10px]",
                m.status === "active"
                  ? "border-neon-green/40 text-neon-green"
                  : m.status === "beta"
                    ? "border-orange-400/60 text-orange-300"
                    : m.status === "planned"
                      ? "border-muted-foreground/40 text-muted-foreground"
                      : "border-neon-cyan/40 text-neon-cyan"
              )}
            >
              {m.displayName}
            </Badge>
          ))
        )}
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────
export default function Charter() {
  const { data, isLoading } = trpc.taxonomy.list.useQuery();

  // 7-차원 별 modifier grouping
  const byDimension = useMemo(() => {
    const map: Record<number, TrackerModifier[]> = {};
    if (!data) return map;
    for (const m of data as readonly TrackerModifier[]) {
      for (const d of m.dimensions) {
        if (!map[d]) map[d] = [];
        map[d].push(m);
      }
    }
    return map;
  }, [data]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-8">
      {/* Hero */}
      <HudPanel variant="highlight">
        <div className="flex flex-col gap-4 py-4">
          <div className="flex items-center gap-3">
            <Sparkles className="h-7 w-7 text-neon-pink" />
            <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-wider uppercase text-neon-pink glow-pink">
              우리는 7-차원만 본다
            </h1>
          </div>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-3xl">
            Tradelab 은 모멘텀·변동성·추세·거래량·구조·매크로·온체인 — 일곱 차원만
            바라본다. 각 차원은 서로 다른 각도로 시장을 측정하며, BBDX 진입 룰
            (RSI+BB+ADX 3-path) 의 신뢰도를 가중하는 multiplier 로만 작동한다.
            단독으로 매매 신호를 발행하는 modifier 는 존재하지 않는다.
          </p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="font-mono text-[10px] border-neon-cyan/40 text-neon-cyan">
              CHARTER · 단일 진실 소스
            </Badge>
            <Badge variant="outline" className="font-mono text-[10px] border-neon-green/40 text-neon-green">
              LOOKAHEAD-FREE
            </Badge>
            <Badge variant="outline" className="font-mono text-[10px] border-neon-pink/40 text-neon-pink">
              MODIFIER-ONLY (R3)
            </Badge>
          </div>
        </div>
      </HudPanel>

      {/* 7-차원 grid */}
      <HudPanel
        title="7 Dimensions"
        subtitle="헌장 1~7 차원 — 측정 각도가 서로 다른 독립 입력"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {DIMENSIONS.map((d) => {
            const Icon = d.icon;
            const count = (byDimension[d.id] ?? []).length;
            return (
              <div key={d.id} className="hud-frame p-3 h-full">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="h-4 w-4 text-neon-cyan" />
                  <span className="font-display text-xs font-bold tracking-wider uppercase text-neon-pink">
                    {d.id}차원 · {d.name}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed mb-2">
                  {d.blurb}
                </p>
                <div className="flex items-center justify-between gap-2 mt-auto">
                  <span className="font-mono text-[10px] text-muted-foreground/80 uppercase tracking-wider">
                    {d.examples}
                  </span>
                  {!isLoading && (
                    <Badge
                      variant="outline"
                      className="font-mono text-[9px] border-neon-green/40 text-neon-green shrink-0"
                    >
                      {count} modifier
                    </Badge>
                  )}
                  {isLoading && (
                    <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </HudPanel>

      {/* 3 헌장 규칙 */}
      <HudPanel
        title="Charter Rules"
        subtitle="모든 modifier 가 따라야 할 3 규칙 — 위반 시 부팅 거부"
        variant="highlight"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {CHARTER_RULES.map((r) => (
            <div key={r.id} className="hud-frame p-4">
              <div className="flex items-center gap-2 mb-2">
                <Badge
                  variant="outline"
                  className="font-mono text-[10px] border-neon-pink/40 text-neon-pink"
                >
                  {r.id}
                </Badge>
                <span className="font-display text-sm font-bold tracking-wider uppercase text-neon-cyan">
                  {r.title}
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {r.desc}
              </p>
            </div>
          ))}
        </div>
      </HudPanel>

      {/* 3 Layer 시간 척도 */}
      <HudPanel
        title="Time Scale · 3 Layers"
        subtitle="modifier 는 시간 척도에 따라 Signal/Wave/Macro 로 분류"
      >
        <div className="space-y-4">
          <div className="rounded-sm border border-border/40 bg-background/60 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Layers className="h-4 w-4 text-neon-cyan" />
              <span className="font-display text-xs font-bold tracking-wider uppercase text-neon-cyan">
                Time Scale Diagram
              </span>
              {isLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
            </div>
            <TimeScaleDiagram />
          </div>

          {!isLoading && data && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {(["signal", "wave", "macro"] as const).map((layer) => (
                <LayerModifiers
                  key={layer}
                  layer={layer}
                  modifiers={data as readonly TrackerModifier[]}
                />
              ))}
            </div>
          )}
        </div>
      </HudPanel>

      {/* Lookahead-free 약속 */}
      <HudPanel
        title="Lookahead-Free 약속"
        subtitle="백테스트 i 시점 결정에 i 이전 데이터만 사용 — 미래 누설 금지"
      >
        <div className="flex items-start gap-3">
          <Ruler className="h-5 w-5 text-neon-cyan mt-0.5 shrink-0" />
          <div className="flex-1 space-y-2 text-xs text-muted-foreground leading-relaxed">
            <p>
              <code className="font-mono text-[11px] text-neon-pink">signal-extractor.ts</code>{" "}
              는 백테스트 재생 시 i 시점 캔들의 결정에 i+1 이후 데이터를 절대
              참조하지 않는다. 모든 임계값·multiplier 는 lookahead-free 검증을
              통과한 calibration 결과만 production 에 반영된다.
            </p>
            <p className="text-[11px] text-muted-foreground/80">
              calibration 워크플로우: BETA (개발/검증) → Production (실시간 시그널 합산).
              백테스트 결과는 `/backtest` 페이지에서 확인.
            </p>
          </div>
        </div>
      </HudPanel>

      <CharterFooter />
    </div>
  );
}
