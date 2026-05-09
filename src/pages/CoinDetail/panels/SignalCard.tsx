/**
 * SignalCard — 우측 상단 패널.
 *
 * useCoinSignal 결과를 받아: path 라벨, 신뢰도 progress, entry/stop, size,
 * 7-차원 chip (forward-compat). v6.5 머지 후 dimensions 가 채워지면 자동 표시.
 */

import { HudPanel } from "@/components/HudPanel";
import { cn } from "@/lib/utils";
import type { CoinSignal } from "../hooks/useCoinSignal";
import { VwapMultChip } from "@/pages/Vwap/VwapDetailPanels";

interface SignalCardProps {
  signal: CoinSignal | null;
  /** v6.5 — VWAP BBDX multiplier (`trpc.vwap.detail.vwapMult`). 미정의 시 "n/a" chip */
  vwapMult?: number;
}

const DIMENSION_LABELS = [
  "BBDX",
  "PTRN",
  "STRC",
  "VOL",
  "PRES",
  "ONCH",
  "MACR",
];

export function SignalCard({ signal, vwapMult }: SignalCardProps) {
  if (!signal) {
    return (
      <HudPanel
        title="Signal"
        subtitle="LIVE BBDX"
        headerRight={<VwapMultChip vwapMult={vwapMult} />}
      >
        <p className="font-mono text-xs text-muted-foreground py-4">
          시그널 데이터 없음
        </p>
      </HudPanel>
    );
  }

  const path = signal.entry?.path ?? "—";
  const reasons = signal.entry?.reasons ?? [];
  const confidence = signal.finalConfidence;
  const hasDims = !!signal.dimensions;

  return (
    <HudPanel
      title="Signal"
      subtitle={signal.entry ? "BBDX ENTRY DETECTED" : "NO ENTRY"}
      variant={signal.entry ? "highlight" : "default"}
      headerRight={<VwapMultChip vwapMult={vwapMult} />}
    >
      <div className="space-y-3">
        {/* Path label */}
        <div>
          <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
            Path
          </div>
          <div className="font-display text-2xl font-bold tracking-wider text-neon-cyan">
            {signal.entry ? `LONG • ${path}` : "—"}
          </div>
          {signal.isFallingKnife && (
            <div className="font-mono text-[10px] text-neon-red mt-1">
              ✗ FALLING KNIFE — entry blocked
            </div>
          )}
        </div>

        {/* Confidence bar */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
              Confidence
            </span>
            <span className="font-mono text-xs text-neon-cyan">
              {confidence.toFixed(0)} / 100
            </span>
          </div>
          <div className="h-1.5 bg-muted/30 rounded-sm overflow-hidden">
            <div
              className={cn(
                "h-full transition-all",
                confidence >= 70
                  ? "bg-neon-green"
                  : confidence >= 40
                    ? "bg-neon-yellow"
                    : "bg-muted-foreground/40"
              )}
              style={{ width: `${confidence}%` }}
            />
          </div>
        </div>

        {/* Entry / Stop / Size */}
        <div className="grid grid-cols-3 gap-2">
          <div>
            <div className="font-mono text-[9px] text-muted-foreground uppercase">
              Entry
            </div>
            <div className="font-mono text-xs text-foreground">
              ${signal.price.toFixed(signal.price < 1 ? 6 : 2)}
            </div>
          </div>
          <div>
            <div className="font-mono text-[9px] text-muted-foreground uppercase">
              Stop
            </div>
            <div className="font-mono text-xs text-neon-red">
              ${signal.stopLoss.toFixed(signal.stopLoss < 1 ? 6 : 2)}
            </div>
          </div>
          <div>
            <div className="font-mono text-[9px] text-muted-foreground uppercase">
              Size
            </div>
            <div className="font-mono text-xs text-neon-cyan">
              ×{signal.sizeFactor.toFixed(2)}
            </div>
          </div>
        </div>

        {/* 7-dimension chips */}
        <div>
          <div className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider mb-1">
            7-Dimension Check
          </div>
          <div className="flex flex-wrap gap-1">
            {DIMENSION_LABELS.map((label, i) => {
              // 현재 (v6.1): 1~5 (BBDX/PTRN/STRC/VOL/PRES) 만 evaluable
              const isLegacyDim = i < 5;
              const isOnchainOrMacro = i >= 5;
              const dimValue = hasDims
                ? (signal.dimensions as any)?.[Object.keys(signal.dimensions ?? {})[i]]
                : null;
              const passed = hasDims
                ? dimValue != null && dimValue > 0.5
                : isLegacyDim && !!signal.entry;
              return (
                <span
                  key={label}
                  className={cn(
                    "font-mono text-[9px] px-1.5 py-0.5 rounded-sm border",
                    !hasDims && isOnchainOrMacro
                      ? "border-muted/30 text-muted-foreground/40"
                      : passed
                        ? "border-neon-green/40 text-neon-green bg-neon-green/5"
                        : "border-border/30 text-muted-foreground"
                  )}
                  title={
                    !hasDims && isOnchainOrMacro
                      ? "v6.5 머지 후 활성화 (현재는 modifier-only)"
                      : undefined
                  }
                >
                  {passed ? "✓" : "·"}
                  {label}
                </span>
              );
            })}
          </div>
        </div>

        {/* Reasons */}
        {reasons.length > 0 && (
          <div>
            <div className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider mb-1">
              Reasons
            </div>
            <ul className="space-y-0.5">
              {reasons.slice(0, 4).map((r, i) => (
                <li
                  key={i}
                  className="font-mono text-[10px] text-foreground/80"
                >
                  • {r}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </HudPanel>
  );
}
