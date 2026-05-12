/**
 * ShortSignalCard — BBDX v6.6 SHORT 진입 시그널 패널.
 *
 * trpc.bbdxV66.current 응답의 `short` 필드 (V66ShortResult) 를 표시.
 * LONG SignalCard 와 시각적으로 짝을 이루되 빨강 톤 + 공매도 면책 명시.
 *
 * 헌장 R3 (modifier-only): SHORT 도 BBDX 차원 안 — 단독 시그널 X. SHORT 결과는
 * v6.5 BBDX 코어 (decideShortEntry) 통과 + calibrated weight × threshold 통과한
 * 시그널만.
 *
 * SHORT STOP LOSS (BBDX_v66_PERP §5.1): min(bbUpper × 1.03, entry × 1.02).
 * 백엔드 `shortStop` 필드를 우선 사용하되 fallback 으로 indicators 기반 공식.
 */

import { HudPanel } from "@/components/HudPanel";
import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";
import { WeightSourceBadge } from "@/components/strategies/WeightSourceBadge";

/** V66ShortResult 의 subset — 본 카드가 사용하는 필드만 명시.
 *  ShortEntryDecision 은 entryPrice/stopLoss 필드 없음 → entry 가격은
 *  별도 candle 의 close 가 필요하지만 본 카드는 백엔드 meta 에 의존.
 */
interface ShortSignalCardProps {
  symbol: string;
  tf: string;
  /** trpc.bbdxV66.current 의 short 필드 — V66ShortResult | null */
  short:
    | {
        triggered: boolean;
        path?: "NUM" | "PTN" | "BB";
        finalScore: number;
        thresholdUsed: number;
        baseStrength: number;
        weightsUsed: {
          momentum: number;
          position: number;
          trend: number;
          volume: number;
          action: number;
        };
        weightsSource: "self_backtest" | "external" | "default";
        thresholdSource: "self_backtest" | "external" | "default";
        shortStop: number | null;
        reasons: string[];
        meta: Record<string, unknown>;
      }
    | null;
  /** LONG ↔ SHORT 충돌 시 양쪽 카드 흐림 */
  conflict?: boolean;
  /** v6.6 미활성 / SHORT flag off — placeholder note */
  inactiveNote?: string;
}

const WEIGHT_KEYS: Array<{
  key: "momentum" | "position" | "trend" | "volume" | "action";
  label: string;
}> = [
  { key: "momentum", label: "MOM" },
  { key: "position", label: "POS" },
  { key: "trend", label: "TRD" },
  { key: "volume", label: "VOL" },
  { key: "action", label: "ACT" },
];

export function ShortSignalCard({
  symbol,
  tf,
  short,
  conflict = false,
  inactiveNote,
}: ShortSignalCardProps) {
  // v6.6 미활성 / SHORT 비활성 — placeholder
  if (inactiveNote) {
    return (
      <HudPanel
        title="Short Signal"
        subtitle="v6.6 BBDX SHORT"
        variant="default"
      >
        <p className="font-mono text-[11px] text-muted-foreground py-3">
          {inactiveNote}
        </p>
      </HudPanel>
    );
  }

  // SHORT 데이터 없음 또는 미발생
  if (!short || !short.triggered) {
    return (
      <HudPanel
        title="Short Signal"
        subtitle="v6.6 BBDX SHORT"
        variant="default"
      >
        <p className="font-mono text-[11px] text-muted-foreground py-3">
          SHORT 진입 시그널 미발생
        </p>
        {short && (
          <p className="font-mono text-[10px] text-muted-foreground/70 mt-1">
            base={short.baseStrength.toFixed(1)} / threshold=
            {short.thresholdUsed.toFixed(1)}
          </p>
        )}
      </HudPanel>
    );
  }

  const path = short.path ?? "—";
  // entry price 는 meta 에 들어있을 수 있음 (백엔드 evaluate 의사코드 §2.4)
  const entryPriceRaw = short.meta?.["entryPrice"];
  const entryPrice =
    typeof entryPriceRaw === "number" ? entryPriceRaw : null;
  const stopLoss = short.shortStop;

  return (
    <HudPanel
      title="Short Signal"
      subtitle={conflict ? "CONFLICT — 방향 불명" : "BBDX v6.6 SHORT ENTRY"}
      variant={conflict ? "default" : "danger"}
      headerRight={
        short.path ? (
          <WeightSourceBadge
            symbol={symbol}
            tf={tf}
            path={short.path}
            side="short"
            compact
          />
        ) : undefined
      }
    >
      <div className={cn("space-y-3", conflict && "opacity-40")}>
        {/* Path label */}
        <div>
          <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
            Path
          </div>
          <div className="font-display text-2xl font-bold tracking-wider text-neon-red">
            SHORT • {path}
          </div>
          {conflict && (
            <div className="font-mono text-[10px] text-muted-foreground mt-1">
              LONG 시그널 동시 발생 — 시장 방향 불명, 진입 차단
            </div>
          )}
        </div>

        {/* Score bar (finalScore vs thresholdUsed) */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
              Score / Threshold
            </span>
            <span className="font-mono text-xs text-neon-red">
              {short.finalScore.toFixed(1)} / {short.thresholdUsed.toFixed(1)}
            </span>
          </div>
          <div className="h-1.5 bg-muted/30 rounded-sm overflow-hidden relative">
            <div
              className="h-full bg-neon-red transition-all"
              style={{
                width: `${Math.min(100, (short.finalScore / Math.max(short.thresholdUsed, 1)) * 100)}%`,
              }}
            />
            {/* threshold marker */}
            <div
              className="absolute top-0 bottom-0 w-px bg-neon-yellow"
              style={{
                left: `${Math.min(100, (short.thresholdUsed / Math.max(short.finalScore, short.thresholdUsed)) * 100)}%`,
              }}
              title={`Calibrated threshold ${short.thresholdUsed.toFixed(1)} (source: ${short.thresholdSource})`}
            />
          </div>
          <div className="font-mono text-[9px] text-muted-foreground mt-0.5">
            base={short.baseStrength.toFixed(1)} · threshold src=
            {short.thresholdSource}
          </div>
        </div>

        {/* Entry / Stop */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="font-mono text-[9px] text-muted-foreground uppercase">
              Entry
            </div>
            <div className="font-mono text-xs text-foreground">
              {entryPrice != null
                ? `$${entryPrice < 1 ? entryPrice.toFixed(6) : entryPrice.toFixed(2)}`
                : "—"}
            </div>
          </div>
          <div>
            <div className="font-mono text-[9px] text-muted-foreground uppercase">
              SHORT STOP
            </div>
            <div className="font-mono text-xs text-neon-red">
              {stopLoss != null
                ? `$${stopLoss < 1 ? stopLoss.toFixed(6) : stopLoss.toFixed(2)}`
                : "—"}
              <span className="text-[9px] text-muted-foreground ml-1">
                (bbU×1.03)
              </span>
            </div>
          </div>
        </div>

        {/* 5 modifier multiplier chips */}
        <div>
          <div className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider mb-1">
            Weights (calibrated, source={short.weightsSource})
          </div>
          <div className="flex flex-wrap gap-1">
            {WEIGHT_KEYS.map(({ key, label }) => {
              const w = short.weightsUsed[key];
              const pct = (w * 100).toFixed(0);
              return (
                <span
                  key={key}
                  className="font-mono text-[9px] px-1.5 py-0.5 rounded-sm border border-neon-red/30 text-neon-red bg-neon-red/5"
                  title={`${key} weight = ${w.toFixed(3)}`}
                >
                  {label} {pct}%
                </span>
              );
            })}
          </div>
        </div>

        {/* Reasons */}
        {short.reasons.length > 0 && (
          <div>
            <div className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider mb-1">
              Reasons
            </div>
            <ul className="space-y-0.5">
              {short.reasons.slice(0, 4).map((r, i) => (
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

        {/* SHORT 면책 */}
        <div className="border-t border-neon-red/20 pt-2 mt-2">
          <div className="flex items-start gap-1.5">
            <AlertTriangle className="h-3 w-3 text-neon-yellow shrink-0 mt-0.5" />
            <p className="font-mono text-[9px] text-muted-foreground leading-relaxed">
              공매도는 추가 위험을 수반. Perp 마켓 가정 시 펀딩비 + 강제 청산
              위험. 가중치 출처가 default 인 경우 검토 후 진입 권장.
            </p>
          </div>
        </div>
      </div>
    </HudPanel>
  );
}
