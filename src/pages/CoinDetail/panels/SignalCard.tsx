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
import { WeightSourceBadge } from "@/components/strategies/WeightSourceBadge";

interface SignalCardProps {
  signal: CoinSignal | null;
  /** v6.5 — VWAP BBDX multiplier (`trpc.vwap.detail.vwapMult`). 미정의 시 "n/a" chip */
  vwapMult?: number;
  /** v6.5+ — Trend Analysis v2.0 BBDX multiplier (`trpc.trend.analyze.waveMult`).
   *  미정의 시 "n/a" chip. 헌장 규칙 3 — modifier-only. */
  waveMult?: number;
  /** v6.6 — WeightSourceBadge 표시용. v6.6 활성 + signal.entry 있을 때만 표시 */
  symbol?: string;
  tf?: string;
  showWeightBadge?: boolean;
  /** LONG ↔ SHORT 충돌 시 카드 흐림 */
  conflict?: boolean;
}

/**
 * WaveMult chip — VwapMultChip 와 동일 패턴.
 * > 1.05 → 녹색 "+N%", 0.95~1.05 → 회색 "neutral", < 0.95 → 빨강 "-N%".
 * 헌장 규칙 3 — Wave Alignment 는 BBDX final_confidence 곱셈 multiplier 로만 사용.
 */
function WaveMultChip({ waveMult }: { waveMult: number | undefined }) {
  if (waveMult == null || !Number.isFinite(waveMult)) {
    return (
      <span
        className="font-mono text-[10px] px-1.5 py-0.5 rounded-sm border border-border/30 text-muted-foreground"
        title="Wave Alignment multiplier 데이터 없음"
      >
        WAVE n/a
      </span>
    );
  }
  const pct = (waveMult - 1) * 100;
  const isPos = waveMult > 1.05;
  const isNeg = waveMult < 0.95;
  const cls = isPos
    ? "border-neon-green/40 text-neon-green bg-neon-green/5"
    : isNeg
      ? "border-neon-red/40 text-neon-red bg-neon-red/5"
      : "border-border/30 text-muted-foreground";
  const label = isPos
    ? `WAVE +${pct.toFixed(0)}%`
    : isNeg
      ? `WAVE ${pct.toFixed(0)}%`
      : "WAVE neutral";
  return (
    <span
      className={cn(
        "font-mono text-[10px] px-1.5 py-0.5 rounded-sm border",
        cls
      )}
      title={`헌장 규칙 3 — Wave Alignment 는 BBDX 진입 신뢰도 multiplier 로 통합. (현재 ${waveMult.toFixed(2)}, 0.30~1.30 범위)`}
    >
      {label}
    </span>
  );
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

export function SignalCard({
  signal,
  vwapMult,
  waveMult,
  symbol,
  tf,
  showWeightBadge = false,
  conflict = false,
}: SignalCardProps) {
  if (!signal) {
    return (
      <HudPanel
        title="Signal"
        subtitle="LIVE BBDX"
        headerRight={
          <div className="flex items-center gap-1">
            <VwapMultChip vwapMult={vwapMult} />
            <WaveMultChip waveMult={waveMult} />
          </div>
        }
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
  const longPath = signal.entry?.path;

  return (
    <HudPanel
      title="Signal"
      subtitle={
        conflict
          ? "CONFLICT — 방향 불명"
          : signal.entry
            ? "BBDX ENTRY DETECTED"
            : "NO ENTRY"
      }
      variant={conflict ? "default" : signal.entry ? "highlight" : "default"}
      headerRight={
        <div className="flex items-center gap-1">
          <VwapMultChip vwapMult={vwapMult} />
          <WaveMultChip waveMult={waveMult} />
          {showWeightBadge && longPath && symbol && tf && (
            <WeightSourceBadge
              symbol={symbol}
              tf={tf}
              path={longPath}
              side="long"
              compact
            />
          )}
        </div>
      }
    >
      <div className={cn("space-y-3", conflict && "opacity-40")}>
        {/* Path label */}
        <div>
          <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
            Path
          </div>
          <div className="font-display text-2xl font-bold tracking-wider text-neon-cyan">
            {signal.entry ? `LONG • ${path}` : "—"}
          </div>
          {conflict && (
            <div className="font-mono text-[10px] text-muted-foreground mt-1">
              SHORT 시그널 동시 발생 — 시장 방향 불명, 진입 차단
            </div>
          )}
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
