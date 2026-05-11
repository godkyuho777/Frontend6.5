import { HudPanel } from "@/components/HudPanel";
import { CharterFooter } from "@/components/strategies/CharterFooter";
import { MultiplierChip } from "@/components/strategies/MultiplierChip";
import { StatusBadge } from "@/components/strategies/StatusBadge";
import {
  StrategyHeader,
  type StrategyTf,
} from "@/components/strategies/StrategyHeader";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { useState } from "react";

const ZONE_META: Record<
  string,
  {
    label: string;
    color: string;
    bg: string;
    border: string;
    desc: string;
  }
> = {
  sell_side_liq: {
    label: "SELL-SIDE LIQ GRAB",
    color: "text-neon-green",
    bg: "bg-neon-green/15",
    border: "border-neon-green/50",
    desc: "swing low 살짝 깬 후 회복 — LONG 약가산 (×1.05)",
  },
  buy_side_liq: {
    label: "BUY-SIDE LIQ GRAB",
    color: "text-neon-red",
    bg: "bg-neon-red/15",
    border: "border-neon-red/50",
    desc: "swing high wick 후 회복 실패 — LONG 약차감 (×0.95)",
  },
  none: {
    label: "NO ZONE",
    color: "text-muted-foreground",
    bg: "bg-muted/20",
    border: "border-muted-foreground/30",
    desc: "유동성 sweep 미감지 — 중립",
  },
};

export default function OrderBlock() {
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [tf, setTf] = useState<StrategyTf>("4h");

  const query = trpc.modifiers.orderBlock.useQuery(
    { symbol, tf },
    {
      enabled: !!symbol,
      staleTime: 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    }
  );

  const result = query.data;
  const zoneKey = result?.zoneType ?? "none";
  const meta = ZONE_META[zoneKey];

  return (
    <div className="space-y-4 max-w-5xl">
      <StrategyHeader
        title="Order Block"
        subtitle="ICT/SMC heuristic — swing liquidity sweep 탐지 (5차원 structure)"
        dimension={5}
        symbol={symbol}
        tf={tf}
        onSymbolChange={setSymbol}
        onTfChange={setTf}
        isBeta
      />

      {query.isLoading && (
        <HudPanel>
          <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="font-mono text-xs">Detecting order block…</span>
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
            title="Liquidity Zone"
            subtitle={`${symbol} · ${tf} · ICT/SMC heuristic`}
            variant="highlight"
            headerRight={
              <StatusBadge status={result.status} errorDetail={result.errorDetail} />
            }
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                  Multiplier
                </div>
                <MultiplierChip multiplier={result.multiplier} size="lg" />
                <p className="text-[11px] text-muted-foreground font-mono">
                  max ±5% — 보수적 가중 (학파 합의 미완)
                </p>
              </div>

              <div className="space-y-2">
                <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                  Zone Type
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

              <div className="space-y-2">
                <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                  Pivot Price
                </div>
                <div className="font-mono text-lg text-neon-cyan">
                  {result.pivotPrice == null
                    ? "—"
                    : `$${result.pivotPrice.toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                      })}`}
                </div>
                <p className="text-[11px] text-muted-foreground font-mono">
                  swing 기준점 (디버깅 용)
                </p>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-border/30">
              <p className="text-xs text-muted-foreground font-mono">
                <span className="text-neon-cyan">REASON:</span> {result.reason}
              </p>
            </div>
          </HudPanel>

          <HudPanel
            title="Heuristic Logic"
            subtitle="명세서 §4 — ICT/SMC 단순 휴리스틱"
            variant="default"
          >
            <ol className="space-y-2 text-xs text-muted-foreground font-mono list-decimal list-inside">
              <li>
                직전 N(20) 캔들에서 swing low / swing high 탐지 (5-bar fractal).
              </li>
              <li>
                <span className="text-neon-green">Sell-side liq grab</span> —
                현재 캔들이 swing low 를 살짝 깬 후 회복 (close &gt; swing low) →
                LONG 약가산 (×1.05).
              </li>
              <li>
                <span className="text-neon-red">Buy-side liq grab</span> —
                현재 캔들이 swing high 위로 wick 후 회복 실패 (close &lt; swing
                high) → LONG 약차감 (×0.95).
              </li>
              <li>그 외 → neutral (×1.00).</li>
            </ol>
            <p className="mt-3 pt-3 border-t border-border/30 text-[11px] text-orange-300/80 font-mono">
              ICT/SMC 학파는 정량화 합의가 미완료 — 본 modifier 는 영향력을
              max ±5% 로 제한. 백테스트로 알파 검증 후 가중치 조정 예정.
            </p>
          </HudPanel>
        </>
      )}

      <CharterFooter
        isBeta
        extraNote="Order Block 은 5차원 structure modifier — Fibonacci/Trendline 과 같은 차원이지만 측정 각도 다름 (확정 레벨 vs 유동성 sweep)."
      />
    </div>
  );
}
