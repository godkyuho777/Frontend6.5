import { HudPanel } from "@/components/HudPanel";
import { CharterFooter } from "@/components/strategies/CharterFooter";
import { MultiplierChip } from "@/components/strategies/MultiplierChip";
import { StatusBadge } from "@/components/strategies/StatusBadge";
import {
  StrategyHeader,
  type StrategyTf,
} from "@/components/strategies/StrategyHeader";
import { TrackerBreadcrumb } from "@/components/trackers/TrackerBreadcrumb";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { useState } from "react";

const REGIME_META: Record<
  string,
  { label: string; color: string; bg: string; border: string; desc: string }
> = {
  long_extreme: {
    label: "LONG EXTREME",
    color: "text-neon-red",
    bg: "bg-neon-red/15",
    border: "border-neon-red/50",
    desc: "rate > +0.001 — LONG 과열, 청산 위험",
  },
  long_elevated: {
    label: "LONG ELEVATED",
    color: "text-rose-300",
    bg: "bg-rose-500/15",
    border: "border-rose-500/40",
    desc: "rate > +0.0005 — LONG 다소 과열",
  },
  neutral: {
    label: "NEUTRAL",
    color: "text-muted-foreground",
    bg: "bg-muted/20",
    border: "border-muted-foreground/30",
    desc: "균형 — multiplier 1.0",
  },
  short_elevated: {
    label: "SHORT ELEVATED",
    color: "text-emerald-300",
    bg: "bg-emerald-500/15",
    border: "border-emerald-500/40",
    desc: "rate < -0.0005 — short 다소 우세, 스퀴즈 가능",
  },
  short_extreme: {
    label: "SHORT EXTREME",
    color: "text-neon-green",
    bg: "bg-neon-green/15",
    border: "border-neon-green/50",
    desc: "rate < -0.001 — short 과밀, LONG 스퀴즈 유리",
  },
};

// 게이지 임계값 (8h funding rate)
const RATE_MIN = -0.0015;
const RATE_MAX = 0.0015;

function rateToPct(rate: number): number {
  const clamped = Math.max(RATE_MIN, Math.min(RATE_MAX, rate));
  return ((clamped - RATE_MIN) / (RATE_MAX - RATE_MIN)) * 100;
}

export default function FundingExtreme() {
  const [symbol, setSymbol] = useState("BTCUSDT");
  // tf 는 사용하지 않지만 헤더 일관성 위해 유지
  const [tf, setTf] = useState<StrategyTf>("4h");

  const query = trpc.modifiers.fundingExtreme.useQuery(
    { symbol },
    {
      enabled: !!symbol,
      staleTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    }
  );

  const result = query.data;
  const meta = result ? REGIME_META[result.regime] : null;
  const isSpotOnly = result?.status === "stub";

  return (
    <div className="space-y-4 max-w-5xl">
      <TrackerBreadcrumb
        layer="macro"
        modifierName="Funding Extreme"
        dimensions={[6]}
      />
      <StrategyHeader
        title="Funding Extreme"
        subtitle="Bybit V5 perp funding rate 8h 기준 5단계 regime — 6차원 macro"
        dimension={6}
        symbol={symbol}
        tf={tf}
        onSymbolChange={setSymbol}
        onTfChange={setTf}
      />

      {query.isLoading && (
        <HudPanel>
          <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="font-mono text-xs">Fetching funding rate…</span>
          </div>
        </HudPanel>
      )}

      {query.isError && (
        <HudPanel variant="danger">
          <p className="text-xs text-neon-red font-mono">
            Error: {query.error.message}
          </p>
        </HudPanel>
      )}

      {result && meta && (
        <>
          <HudPanel
            title="Funding Regime"
            subtitle={`${symbol} · 8h perp funding`}
            variant={isSpotOnly ? "default" : "highlight"}
            headerRight={
              <StatusBadge status={result.status} errorDetail={result.errorDetail} />
            }
          >
            {isSpotOnly ? (
              <div className="text-center py-6 space-y-2">
                <p className="text-sm text-muted-foreground font-mono">
                  이 코인은 perp 미상장 — 펀딩비 데이터 N/A
                </p>
                <p className="text-xs text-muted-foreground/70 font-mono">
                  multiplier = 1.0 (영향 없음)
                </p>
                <div className="pt-2">
                  <MultiplierChip multiplier={result.multiplier} size="lg" />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                    Funding Rate (8h)
                  </div>
                  <div
                    className={cn(
                      "font-display text-3xl font-bold tracking-wider",
                      result.fundingRate > 0
                        ? "text-neon-red"
                        : result.fundingRate < 0
                          ? "text-neon-green"
                          : "text-muted-foreground"
                    )}
                  >
                    {result.fundingRate >= 0 ? "+" : ""}
                    {(result.fundingRate * 100).toFixed(4)}%
                  </div>
                  <p className="text-[11px] text-muted-foreground font-mono">
                    raw rate: {result.fundingRate.toExponential(4)}
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                    Multiplier
                  </div>
                  <MultiplierChip multiplier={result.multiplier} size="lg" />
                </div>

                <div className="space-y-2">
                  <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                    Regime
                  </div>
                  <span
                    className={cn(
                      "inline-flex items-center px-3 py-2 border rounded-sm font-display text-sm font-bold tracking-wider",
                      meta.color,
                      meta.bg,
                      meta.border
                    )}
                  >
                    {meta.label}
                  </span>
                  <p className="text-[11px] text-muted-foreground font-mono">
                    {meta.desc}
                  </p>
                </div>
              </div>
            )}

            <div className="mt-4 pt-3 border-t border-border/30">
              <p className="text-xs text-muted-foreground font-mono">
                <span className="text-neon-cyan">REASON:</span> {result.reason}
              </p>
            </div>
          </HudPanel>

          {!isSpotOnly && (
            <HudPanel
              title="Regime Gauge"
              subtitle="-0.15% ~ +0.15% range, 현재 위치"
            >
              <div className="space-y-3">
                <div className="relative h-6 w-full rounded-sm overflow-hidden border border-border/40">
                  <div className="absolute inset-0 flex">
                    <div className="flex-1 bg-neon-green/40" />
                    <div className="flex-1 bg-emerald-500/30" />
                    <div className="flex-1 bg-muted/40" />
                    <div className="flex-1 bg-rose-500/30" />
                    <div className="flex-1 bg-neon-red/40" />
                  </div>
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-neon-cyan shadow-[0_0_8px_oklch(0.7_0.2_200)]"
                    style={{
                      left: `${rateToPct(result.fundingRate)}%`,
                    }}
                  />
                </div>
                <div className="grid grid-cols-5 text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                  <span className="text-center">short ext</span>
                  <span className="text-center">short elev</span>
                  <span className="text-center">neutral</span>
                  <span className="text-center">long elev</span>
                  <span className="text-center">long ext</span>
                </div>
                <p className="text-[11px] text-muted-foreground font-mono text-center">
                  현재 rate{" "}
                  <span className="text-neon-cyan">
                    {(result.fundingRate * 100).toFixed(4)}%
                  </span>{" "}
                  → regime{" "}
                  <span className={meta.color}>{meta.label}</span>
                </p>
              </div>
            </HudPanel>
          )}

          <HudPanel title="Threshold Map" subtitle="8h rate → multiplier 매핑">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-2 text-[11px] font-mono">
              {(
                [
                  ["short_extreme", "< -0.001", "1.20 ×"],
                  ["short_elevated", "< -0.0005", "1.10 ×"],
                  ["neutral", "-0.0005~+0.0005", "1.00 ×"],
                  ["long_elevated", "> +0.0005", "0.92 ×"],
                  ["long_extreme", "> +0.001", "0.85 ×"],
                ] as const
              ).map(([key, range, mult]) => {
                const m = REGIME_META[key];
                const isCurrent = result.regime === key;
                return (
                  <div
                    key={key}
                    className={cn(
                      "p-2 border rounded-sm",
                      isCurrent
                        ? `${m.bg} ${m.border}`
                        : "border-border/30 bg-card/20 opacity-60"
                    )}
                  >
                    <div className={cn("font-display text-[11px] uppercase", m.color)}>
                      {m.label}
                    </div>
                    <div className="text-foreground mt-1 text-[10px]">{range}</div>
                    <div className="text-muted-foreground text-[10px]">{mult}</div>
                  </div>
                );
              })}
            </div>
          </HudPanel>
        </>
      )}

      <CharterFooter />
    </div>
  );
}
