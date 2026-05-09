/**
 * VwapDetailPanels — `trpc.vwap.detail` 응답을 4개 시각화 패널로 분해.
 *
 * 백엔드 `vwap-detail.ts` 가 한 번에 반환하는 결과 (signal/signalV2, bands,
 * volumeProfile, pullbackV2, multiTfAlignment, vwapMult, candles) 를 다음 4개
 * sub-panel 로 분리:
 *  - VwapChartPanel:      캔들 + VWAP/EMA9/±1/2/3σ 밴드 오버레이
 *  - VolumeProfilePanel:  세로 horizontal-bar (HVN/LVN/POC/Value Area)
 *  - SignalCardV2:        5-component 분해 (signalV2 우선, fallback signal)
 *  - AlignmentCard:       multi-TF 정합 + multiplier
 *  - PullbackQualityCard: Pullback v2 detected/bounceConfirmed
 *
 * 헌장 규칙 3 준수: vwapMult 표시 시 "BBDX multiplier" 라는 점 명시.
 */

import { HudPanel } from "@/components/HudPanel";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { TrendingUp, TrendingDown, Check, X as IconX } from "lucide-react";
import { useMemo } from "react";

// ---------------------------------------------------------------------------
// 타입 — 백엔드 d.ts 미러 (types-entry 에서 export 안 되어 인라인 정의)
// ---------------------------------------------------------------------------

export interface VwapBands {
  vwap: number;
  sigma: number;
  upper1: number;
  upper2: number;
  upper3: number;
  lower1: number;
  lower2: number;
  lower3: number;
}

export interface VolumeProfileBin {
  priceLow: number;
  priceHigh: number;
  volume: number;
}

export interface VolumeProfileValueArea {
  low: number;
  high: number;
  pct: number;
}

export interface VolumeProfile {
  bins: VolumeProfileBin[];
  poc: number;
  hvnList: number[];
  lvnList: number[];
  valueArea: VolumeProfileValueArea;
  totalVolume: number;
}

export interface PullbackQuality {
  detected: boolean;
  touchCandleIdx: number | null;
  bounceConfirmed: boolean;
  proximityRatio: number;
  touchedLine: "vwap" | "ema9" | null;
}

export interface VwapSignalLite {
  side: "LONG" | "SHORT";
  strength: number;
  reasons: string[];
}

export type AlignmentLevel = "aligned" | "partial" | "mixed" | "neutral";
export interface MultiTfAlignmentPerTf {
  side: "LONG" | "SHORT" | null;
  strength: number;
}
export interface MultiTfAlignment {
  tfs: ("1h" | "4h" | "1d")[];
  alignmentLevel: AlignmentLevel;
  perTf: Record<string, MultiTfAlignmentPerTf>;
  multiplier: number;
}

export interface CandleLite {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface VwapDetailLite {
  symbol: string;
  tf: "1h" | "4h" | "1d";
  candles: CandleLite[];
  vwap: number;
  ema9: number;
  bands: VwapBands;
  volumeProfile: VolumeProfile;
  pullbackV2: PullbackQuality;
  signal: VwapSignalLite | null;
  signalV2: VwapSignalLite | null;
  vwapMult: number;
  multiTfAlignment: MultiTfAlignment;
  computedAt: number;
}

// ---------------------------------------------------------------------------
// VwapMult chip — 헌장 규칙 3 (BBDX multiplier 시각화)
// ---------------------------------------------------------------------------

export function VwapMultChip({ vwapMult }: { vwapMult: number | undefined }) {
  if (vwapMult == null || !Number.isFinite(vwapMult)) {
    return (
      <span
        className="font-mono text-[10px] px-1.5 py-0.5 rounded-sm border border-border/30 text-muted-foreground"
        title="VWAP multiplier 데이터 없음"
      >
        VWAP n/a
      </span>
    );
  }
  const pct = (vwapMult - 1) * 100;
  const isPos = vwapMult > 1.05;
  const isNeg = vwapMult < 0.95;
  const cls = isPos
    ? "border-neon-green/40 text-neon-green bg-neon-green/5"
    : isNeg
      ? "border-neon-red/40 text-neon-red bg-neon-red/5"
      : "border-border/30 text-muted-foreground";
  const label = isPos
    ? `VWAP +${pct.toFixed(0)}%`
    : isNeg
      ? `VWAP ${pct.toFixed(0)}%`
      : "VWAP neutral";
  return (
    <span
      className={cn(
        "font-mono text-[10px] px-1.5 py-0.5 rounded-sm border",
        cls
      )}
      title={`헌장 규칙 3 — VWAP 시그널은 BBDX 진입 신뢰도 multiplier 로 통합. (현재 ${vwapMult.toFixed(2)}, 0.7~1.3 범위)`}
    >
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// VwapChartPanel — 캔들 + VWAP/EMA9 + ±σ 밴드
// ---------------------------------------------------------------------------

export function VwapChartPanel({ detail }: { detail: VwapDetailLite }) {
  const data = useMemo(() => {
    const { candles, bands, vwap, ema9 } = detail;
    return candles.map((c, i) => ({
      idx: i,
      ts: c.timestamp,
      close: c.close,
      vwap,
      ema9,
      upper1: bands.upper1,
      upper2: bands.upper2,
      upper3: bands.upper3,
      lower1: bands.lower1,
      lower2: bands.lower2,
      lower3: bands.lower3,
    }));
  }, [detail]);

  if (data.length === 0) {
    return (
      <p className="font-mono text-xs text-muted-foreground py-4">
        캔들 데이터 없음 — 잠시 후 다시 시도하세요.
      </p>
    );
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="oklch(0.3 0 0 / 0.3)" strokeDasharray="2 4" />
          <XAxis
            dataKey="idx"
            tick={{ fontSize: 9, fontFamily: "Share Tech Mono" }}
            stroke="oklch(0.6 0 0)"
          />
          <YAxis
            domain={["auto", "auto"]}
            tick={{ fontSize: 9, fontFamily: "Share Tech Mono" }}
            stroke="oklch(0.6 0 0)"
            width={56}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "oklch(0.18 0 0 / 0.95)",
              border: "1px solid oklch(0.4 0.15 280)",
              fontFamily: "Share Tech Mono",
              fontSize: "11px",
            }}
            labelFormatter={(v) => `Candle #${v}`}
            formatter={(v: number, name) => [
              typeof v === "number" ? v.toFixed(4) : v,
              name,
            ]}
          />
          {/* Bands — 얇은 점선 */}
          <Line
            type="monotone"
            dataKey="upper3"
            stroke="oklch(0.7 0.15 30 / 0.4)"
            strokeWidth={1}
            strokeDasharray="2 3"
            dot={false}
            isAnimationActive={false}
            name="+3σ"
          />
          <Line
            type="monotone"
            dataKey="upper2"
            stroke="oklch(0.7 0.15 30 / 0.6)"
            strokeWidth={1}
            strokeDasharray="3 3"
            dot={false}
            isAnimationActive={false}
            name="+2σ"
          />
          <Line
            type="monotone"
            dataKey="upper1"
            stroke="oklch(0.7 0.15 30 / 0.7)"
            strokeWidth={1}
            strokeDasharray="1 2"
            dot={false}
            isAnimationActive={false}
            name="+1σ"
          />
          <Line
            type="monotone"
            dataKey="lower1"
            stroke="oklch(0.7 0.15 200 / 0.7)"
            strokeWidth={1}
            strokeDasharray="1 2"
            dot={false}
            isAnimationActive={false}
            name="-1σ"
          />
          <Line
            type="monotone"
            dataKey="lower2"
            stroke="oklch(0.7 0.15 200 / 0.6)"
            strokeWidth={1}
            strokeDasharray="3 3"
            dot={false}
            isAnimationActive={false}
            name="-2σ"
          />
          <Line
            type="monotone"
            dataKey="lower3"
            stroke="oklch(0.7 0.15 200 / 0.4)"
            strokeWidth={1}
            strokeDasharray="2 3"
            dot={false}
            isAnimationActive={false}
            name="-3σ"
          />
          {/* VWAP — 노란색 실선 */}
          <Line
            type="monotone"
            dataKey="vwap"
            stroke="oklch(0.85 0.18 95)"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
            name="VWAP"
          />
          {/* EMA(9) — 청록색 실선 */}
          <Line
            type="monotone"
            dataKey="ema9"
            stroke="oklch(0.75 0.15 200)"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
            name="EMA(9)"
          />
          {/* Close — 흰색 굵은 선 (캔들 대신 단순화) */}
          <Line
            type="monotone"
            dataKey="close"
            stroke="oklch(0.95 0 0)"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
            name="Close"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// VolumeProfilePanel — 가격(Y) × 거래량(X) horizontal bar
// ---------------------------------------------------------------------------

export function VolumeProfilePanel({ profile }: { profile: VolumeProfile }) {
  if (!profile || profile.bins.length === 0) {
    return (
      <p className="font-mono text-xs text-muted-foreground py-4">
        Volume Profile 데이터 없음
      </p>
    );
  }
  const maxVol = profile.bins.reduce((m, b) => (b.volume > m ? b.volume : m), 0);
  const hvnSet = new Set(profile.hvnList);
  const lvnSet = new Set(profile.lvnList);
  const va = profile.valueArea;

  return (
    <div className="space-y-1">
      <div className="font-mono text-[10px] text-muted-foreground flex justify-between mb-2">
        <span>POC: ${profile.poc.toFixed(4)}</span>
        <span>
          HVN {profile.hvnList.length} · LVN {profile.lvnList.length}
        </span>
      </div>
      <div className="space-y-[1px]">
        {/* 가격 높은 bin 부터 표시 (위 → 아래) */}
        {[...profile.bins].reverse().map((bin, i) => {
          const mid = (bin.priceLow + bin.priceHigh) / 2;
          const widthPct = maxVol > 0 ? (bin.volume / maxVol) * 100 : 0;
          const isPoc = Math.abs(mid - profile.poc) < 1e-9;
          const isHvn = hvnSet.has(mid);
          const isLvn = lvnSet.has(mid);
          const inVA = mid >= va.low && mid <= va.high;
          return (
            <div
              key={i}
              className={cn(
                "relative flex items-center gap-2 h-4 px-1",
                inVA && "bg-neon-cyan/5"
              )}
              title={
                isPoc
                  ? "POC (Point of Control)"
                  : isHvn
                    ? "HVN (High Volume Node)"
                    : isLvn
                      ? "LVN (Low Volume Node)"
                      : undefined
              }
            >
              <span className="font-mono text-[8px] text-muted-foreground w-14 text-right shrink-0">
                ${mid.toFixed(mid < 1 ? 5 : 2)}
              </span>
              <div className="flex-1 h-3 bg-muted/10 relative overflow-hidden rounded-sm">
                <div
                  className={cn(
                    "h-full transition-all",
                    isPoc
                      ? "bg-neon-pink/80"
                      : isHvn
                        ? "bg-neon-cyan/70"
                        : isLvn
                          ? "bg-muted-foreground/20"
                          : "bg-neon-cyan/30"
                  )}
                  style={{ width: `${widthPct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      {va.pct > 0 && (
        <div className="pt-2 mt-2 border-t border-border/20 font-mono text-[9px] text-muted-foreground">
          Value Area: ${va.low.toFixed(4)} ~ ${va.high.toFixed(4)} ·{" "}
          {(va.pct * 100).toFixed(0)}%
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SignalCardV2 — 5-component 분해 표
// ---------------------------------------------------------------------------

/**
 * 5-component breakdown — 백엔드 `signalV2` 의 strength 산출 비율 (총 100):
 *   VWAP 거리   : 25
 *   EMA(9) 위치: 20
 *   EMA 되돌림  : 25 (Pullback v2 의 bounceConfirmed → 25, 단순 detected → ~12)
 *   VP 지지(HVN/POC) : 15
 *   VP 구조(LVN 위) : 15
 *
 * 백엔드는 strength 만 노출하므로, breakdown 은 UI 측에서 detail 의 보조
 * 데이터 (pullbackV2, volumeProfile) 로 추정 표시. 정확한 값을 보장하지 않음.
 */
export function SignalCardV2({ detail }: { detail: VwapDetailLite }) {
  const sig = detail.signalV2 ?? detail.signal;
  const isV2 = !!detail.signalV2;
  const totalStrength = sig?.strength ?? 0;

  // breakdown 추정 (백엔드 산식과 1:1 매칭은 아님 — 사용자에게 weighting 안내 목적)
  const components = useMemo(() => {
    const pb = detail.pullbackV2;
    const vp = detail.volumeProfile;
    const vpHasHvn = vp.hvnList.length > 0;
    const vpHasLvn = vp.lvnList.length > 0;
    return [
      {
        label: "VWAP 거리",
        weight: 25,
        score: sig ? Math.min(25, totalStrength * 0.25) : 0,
      },
      {
        label: "EMA(9) 위치",
        weight: 20,
        score: sig ? Math.min(20, totalStrength * 0.2) : 0,
      },
      {
        label: "EMA 되돌림",
        weight: 25,
        score: pb.bounceConfirmed ? 25 : pb.detected ? 12 : 0,
      },
      {
        label: "VP 지지 (HVN/POC)",
        weight: 15,
        score: vpHasHvn ? 15 : 0,
      },
      {
        label: "VP 구조 (LVN 위)",
        weight: 15,
        score: vpHasLvn ? 15 : 0,
      },
    ];
  }, [detail, sig, totalStrength]);

  return (
    <HudPanel
      title="VWAP Signal v2"
      subtitle={isV2 ? "5-COMPONENT" : "4-COMPONENT (LEGACY)"}
      variant={sig ? "highlight" : "default"}
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          {sig?.side === "LONG" ? (
            <Badge className="bg-neon-green/20 text-neon-green border-neon-green/40 font-mono text-xs px-2 py-0.5">
              <TrendingUp className="h-3 w-3 mr-0.5" />
              LONG
            </Badge>
          ) : sig?.side === "SHORT" ? (
            <Badge className="bg-neon-red/20 text-neon-red border-neon-red/40 font-mono text-xs px-2 py-0.5">
              <TrendingDown className="h-3 w-3 mr-0.5" />
              SHORT
            </Badge>
          ) : (
            <Badge className="bg-muted/30 text-muted-foreground border-border/40 font-mono text-xs px-2 py-0.5">
              NO SIGNAL
            </Badge>
          )}
          <span className="font-display text-xl font-bold text-neon-cyan">
            {totalStrength}
            <span className="text-muted-foreground text-sm">/100</span>
          </span>
        </div>

        <div className="h-1.5 bg-muted/30 rounded-sm overflow-hidden">
          <div
            className={cn(
              "h-full transition-all",
              totalStrength >= 70
                ? "bg-neon-green"
                : totalStrength >= 50
                  ? "bg-neon-yellow"
                  : "bg-neon-cyan"
            )}
            style={{ width: `${totalStrength}%` }}
          />
        </div>

        <div className="space-y-1.5">
          {components.map((c) => (
            <div key={c.label} className="flex items-center gap-2">
              <span className="font-mono text-[10px] text-muted-foreground flex-1">
                {c.label}
              </span>
              <div className="w-20 h-1 bg-muted/30 rounded-sm overflow-hidden">
                <div
                  className="h-full bg-neon-cyan/70"
                  style={{
                    width: `${(c.score / c.weight) * 100}%`,
                  }}
                />
              </div>
              <span className="font-mono text-[10px] text-foreground w-10 text-right">
                {c.score.toFixed(0)}/{c.weight}
              </span>
            </div>
          ))}
        </div>

        {sig && sig.reasons.length > 0 && (
          <div className="pt-2 border-t border-border/20">
            <ul className="space-y-0.5">
              {sig.reasons.slice(0, 5).map((r, i) => (
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

        <p className="font-mono text-[9px] text-muted-foreground/70 pt-2 border-t border-border/20 leading-relaxed">
          ⚠ 본 시그널은 BBDX 보조 차원 (multiplier-only). 단독 매매 신호 X. 헌장 규칙 3.
        </p>
      </div>
    </HudPanel>
  );
}

// ---------------------------------------------------------------------------
// AlignmentCard — Multi-TF 정합
// ---------------------------------------------------------------------------

const ALIGNMENT_BADGE: Record<AlignmentLevel, { label: string; cls: string }> = {
  aligned: {
    label: "ALIGNED",
    cls: "bg-neon-green/20 text-neon-green border-neon-green/40",
  },
  partial: {
    label: "PARTIAL",
    cls: "bg-neon-yellow/20 text-neon-yellow border-neon-yellow/40",
  },
  mixed: {
    label: "MIXED",
    cls: "bg-neon-orange/20 text-neon-pink border-neon-pink/40",
  },
  neutral: {
    label: "NEUTRAL",
    cls: "bg-muted/30 text-muted-foreground border-border/40",
  },
};

export function AlignmentCard({ alignment }: { alignment: MultiTfAlignment }) {
  const badge = ALIGNMENT_BADGE[alignment.alignmentLevel];
  return (
    <HudPanel title="Multi-TF Alignment" subtitle="1H · 4H · 1D">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Badge
            className={cn("font-mono text-xs px-2 py-0.5 border", badge.cls)}
          >
            {badge.label}
          </Badge>
          <span className="font-mono text-xs text-neon-cyan">
            ×{alignment.multiplier.toFixed(2)}
          </span>
        </div>

        <div className="space-y-1.5">
          {alignment.tfs.map((tf) => {
            const per = alignment.perTf[tf];
            const sideCls =
              per?.side === "LONG"
                ? "text-neon-green"
                : per?.side === "SHORT"
                  ? "text-neon-red"
                  : "text-muted-foreground";
            return (
              <div
                key={tf}
                className="flex items-center justify-between font-mono text-[11px]"
              >
                <span className="text-muted-foreground uppercase tracking-wider">
                  {tf}
                </span>
                <span className={cn("flex items-center gap-2", sideCls)}>
                  <span>{per?.side ?? "NEUTRAL"}</span>
                  <span className="text-foreground/60">
                    {per?.strength != null ? `${per.strength.toFixed(0)}%` : "—"}
                  </span>
                </span>
              </div>
            );
          })}
        </div>

        <p className="font-mono text-[9px] text-muted-foreground/70 pt-2 border-t border-border/20 leading-relaxed">
          1H/4H/1D VWAP 정렬 시 시그널 신뢰도 가산 (aligned ×1.15 · partial ×1.05 ·
          mixed ×0.95 · neutral ×1.00).
        </p>
      </div>
    </HudPanel>
  );
}

// ---------------------------------------------------------------------------
// PullbackQualityCard — Pullback v2
// ---------------------------------------------------------------------------

export function PullbackQualityCard({
  pullback,
}: {
  pullback: PullbackQuality;
}) {
  return (
    <HudPanel title="Pullback v2" subtitle="VWAP/EMA TOUCH + BOUNCE">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col items-center gap-1 p-2 rounded-sm border border-border/20 bg-card/40">
            {pullback.detected ? (
              <Check className="h-5 w-5 text-neon-cyan" />
            ) : (
              <IconX className="h-5 w-5 text-muted-foreground/50" />
            )}
            <span className="font-mono text-[10px] text-muted-foreground uppercase">
              Detected
            </span>
          </div>
          <div className="flex flex-col items-center gap-1 p-2 rounded-sm border border-border/20 bg-card/40">
            {pullback.bounceConfirmed ? (
              <Check className="h-5 w-5 text-neon-green" />
            ) : (
              <IconX className="h-5 w-5 text-muted-foreground/50" />
            )}
            <span className="font-mono text-[10px] text-muted-foreground uppercase">
              Bounce
            </span>
          </div>
        </div>

        <div className="space-y-1 font-mono text-[10px]">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Touched Line</span>
            <span className="text-foreground">
              {pullback.touchedLine ? pullback.touchedLine.toUpperCase() : "—"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Proximity</span>
            <span className="text-foreground">
              {(pullback.proximityRatio * 100).toFixed(1)}%
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Touch Idx</span>
            <span className="text-foreground">
              {pullback.touchCandleIdx ?? "—"}
            </span>
          </div>
        </div>

        <p className="font-mono text-[9px] text-muted-foreground/70 pt-2 border-t border-border/20 leading-relaxed">
          최근 5캔들 내 VWAP/EMA 터치 + 다음 캔들 반등 확인 시 5-component score 의
          EMA 되돌림 25점 풀로 가산.
        </p>
      </div>
    </HudPanel>
  );
}

// dummy import to keep ReferenceLine usage ready for future overlay markers
export const _refLine = ReferenceLine;
