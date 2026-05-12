/**
 * CalibrationPanel — Phase 3 Wilson CI 권고 임계값 시각화.
 *
 * 백엔드 `runStandardCalibration(trades)` 결과를 받아 7개 표준 파라미터의
 * winRate × Wilson 95% CI bucket 분포를 화면에 그린다.
 *
 * 클라이언트 사이드 mirror — 백엔드 calibration.ts 의 알고리즘을
 * frontend 에서도 동일하게 실행하여 backtest result 즉시 분석.
 */

import { useMemo } from "react";
import { TrendingUp, TrendingDown, AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BacktestTrade } from "./TradeTable";

// ─── Wilson 95% CI (mirror of backend calibration.ts) ───────────

function wilsonScoreInterval(
  wins: number,
  total: number,
  z: number = 1.96,
): { lower: number; upper: number; point: number } {
  if (total <= 0) return { lower: 0, upper: 0, point: 0 };
  const p = wins / total;
  const denom = 1 + (z * z) / total;
  const center = p + (z * z) / (2 * total);
  const margin = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * total)) / total);
  return {
    lower: Math.max(0, (center - margin) / denom),
    upper: Math.min(1, (center + margin) / denom),
    point: p,
  };
}

interface BucketStat {
  label: string;
  lower: number;
  upper: number;
  n: number;
  wins: number;
  winRate: number;
  ciLower: number;
  ciUpper: number;
  avgReturnPct: number;
  sufficient: boolean;
}

function bucketByValue(
  trades: BacktestTrade[],
  valueOf: (t: BacktestTrade) => number | undefined | null,
  edges: number[],
): BucketStat[] {
  const out: BucketStat[] = [];
  for (let i = 0; i < edges.length - 1; i++) {
    const lo = edges[i];
    const hi = edges[i + 1];
    const isLast = i === edges.length - 2;
    const inBucket = trades.filter((t) => {
      const v = valueOf(t);
      if (v == null) return false;
      return v >= lo && (isLast ? v <= hi : v < hi);
    });
    const n = inBucket.length;
    const wins = inBucket.filter((t) => t.win).length;
    const ci = wilsonScoreInterval(wins, n);
    const totalReturn = inBucket.reduce((s, t) => s + t.returnPct, 0);
    out.push({
      label: `${lo.toFixed(2)}~${hi.toFixed(2)}`,
      lower: lo,
      upper: hi,
      n,
      wins,
      winRate: ci.point,
      ciLower: ci.lower,
      ciUpper: ci.upper,
      avgReturnPct: n > 0 ? totalReturn / n : 0,
      sufficient: n >= 20,
    });
  }
  return out;
}

interface CalibParam {
  name: string;
  label: string;
  valueOf: (t: BacktestTrade) => number | undefined | null;
  edges: number[];
  currentThreshold: number;
  direction: "min" | "max";
  dimension: number;
}

const STANDARD_PARAMS: CalibParam[] = [
  {
    name: "patternConfluenceScore",
    label: "Pattern Confluence (Phase 1, current ≥ 0.4)",
    valueOf: (t) => t.patternConfluenceScore,
    edges: [0, 0.2, 0.4, 0.5, 0.6, 0.7, 0.8, 1.0],
    currentThreshold: 0.4,
    direction: "min",
    dimension: 5,
  },
  {
    name: "rsi",
    label: "RSI (current ≤ 35 진입)",
    valueOf: (t) => t.rsi,
    edges: [25, 28, 30, 32, 35, 38, 42],
    currentThreshold: 35,
    direction: "max",
    dimension: 1,
  },
  {
    name: "adx",
    label: "ADX (current ≤ 30 진입)",
    valueOf: (t) => t.adx,
    edges: [0, 10, 15, 20, 25, 30, 40],
    currentThreshold: 30,
    direction: "max",
    dimension: 3,
  },
  {
    name: "signalStrength",
    label: "Signal Strength",
    valueOf: (t) => t.signalStrength,
    edges: [0, 30, 50, 70, 85, 100],
    currentThreshold: 50,
    direction: "min",
    dimension: 5,
  },
  {
    name: "modifiersProduct",
    label: "Modifiers Product (Phase 2 합산)",
    valueOf: (t) => t.modifiersProduct,
    edges: [0.50, 0.85, 0.95, 1.0, 1.05, 1.20, 1.45],
    currentThreshold: 1.0,
    direction: "min",
    dimension: 5,
  },
];

interface CalibResult {
  param: CalibParam;
  buckets: BucketStat[];
  recommendedThreshold: number | null;
  expectedWinRate: number | null;
  significantChange: boolean;
  sampleSufficient: boolean;
  baselineWinRate: number;
}

function calibrate(trades: BacktestTrade[], param: CalibParam): CalibResult {
  const validTrades = trades.filter((t) => param.valueOf(t) != null);
  const baselineWins = validTrades.filter((t) => t.win).length;
  const baselineWinRate =
    validTrades.length > 0 ? baselineWins / validTrades.length : 0;
  const buckets = bucketByValue(trades, param.valueOf, param.edges);
  const sampleSufficient = validTrades.length >= 100;

  let recommendedThreshold: number | null = null;
  let expectedWinRate: number | null = null;
  const sortedBuckets =
    param.direction === "min"
      ? [...buckets].sort((a, b) => a.lower - b.lower)
      : [...buckets].sort((a, b) => b.upper - a.upper);

  for (const b of sortedBuckets) {
    if (!b.sufficient) continue;
    if (b.ciLower >= baselineWinRate + 0.05) {
      recommendedThreshold = param.direction === "min" ? b.lower : b.upper;
      expectedWinRate = b.ciLower;
      break;
    }
  }

  const delta =
    recommendedThreshold != null
      ? Math.abs(recommendedThreshold - param.currentThreshold)
      : null;
  const significantChange =
    delta != null && param.currentThreshold !== 0
      ? delta / Math.abs(param.currentThreshold) >= 0.2
      : delta != null && delta >= 0.05;

  return {
    param,
    buckets,
    recommendedThreshold,
    expectedWinRate,
    significantChange,
    sampleSufficient,
    baselineWinRate,
  };
}

// ─── UI ─────────────────────────────────────────────────────────

interface Props {
  trades: BacktestTrade[];
}

export function CalibrationPanel({ trades }: Props) {
  const results = useMemo(
    () => STANDARD_PARAMS.map((p) => calibrate(trades, p)),
    [trades],
  );

  const totalTrades = trades.length;
  const baseline =
    totalTrades > 0
      ? trades.filter((t) => t.win).length / totalTrades
      : 0;

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="p-3 rounded-sm border border-neon-pink/30 bg-neon-pink/5">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-display text-sm font-bold text-neon-pink">
              v6.5 Phase 3 — Calibration Report
            </div>
            <div className="font-mono text-[10px] text-muted-foreground mt-0.5">
              Wilson 95% CI 기반 임계값 자동 도출 (헌장 규칙 2 알파 검증)
            </div>
          </div>
          <div className="text-right">
            <div className="font-display text-xl font-bold text-neon-cyan">
              {(baseline * 100).toFixed(1)}%
            </div>
            <div className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider">
              Baseline winRate
            </div>
            <div className="font-mono text-[10px] text-muted-foreground">
              n = {totalTrades}
            </div>
          </div>
        </div>
      </div>

      {/* 권고 임계 요약 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {results.map((r) => (
          <ParamCard key={r.param.name} result={r} />
        ))}
      </div>

      {/* 면책 */}
      <div className="flex items-start gap-1.5 text-[9px] font-mono text-muted-foreground/70 leading-relaxed">
        <AlertCircle className="h-2.5 w-2.5 mt-0.5 shrink-0" />
        <span>
          헌장 규칙 2 (백테스트 알파 검증): CI 하한 ≥ baseline + 5%p 인 첫 bucket 의 경계가 권고 임계.
          🚨 = current 대비 ±20% 이상 변화 (사용자 확인 필요). ✓ = 미세 조정 (자동 채택 가능).
          ⚠ = 통계적 유의성 부재 (표본 부족 또는 진짜 noise).
        </span>
      </div>
    </div>
  );
}

function ParamCard({ result }: { result: CalibResult }) {
  const r = result;
  const hasRec = r.recommendedThreshold != null;
  const Icon = hasRec
    ? r.significantChange
      ? AlertCircle
      : CheckCircle2
    : AlertCircle;

  const tone = hasRec
    ? r.significantChange
      ? "border-orange-500/40 bg-orange-500/5"
      : "border-emerald-500/40 bg-emerald-500/5"
    : "border-border/30 bg-card/30";

  const textTone = hasRec
    ? r.significantChange
      ? "text-orange-400"
      : "text-emerald-400"
    : "text-muted-foreground";

  return (
    <div className={cn("p-2.5 rounded-sm border", tone)}>
      <div className="flex items-start gap-2 mb-2">
        <Icon className={cn("h-3.5 w-3.5 shrink-0 mt-0.5", textTone)} />
        <div className="flex-1 min-w-0">
          <div className="font-mono text-[10px] font-bold text-foreground truncate">
            {r.param.name}
          </div>
          <div className="font-mono text-[9px] text-muted-foreground truncate">
            {r.param.label}
          </div>
        </div>
      </div>

      {hasRec ? (
        <>
          <div className="flex items-center justify-between text-[10px] font-mono mb-1">
            <span className="text-muted-foreground">현재 → 권고</span>
            <span className={textTone}>
              {r.param.currentThreshold.toFixed(2)} → {r.recommendedThreshold!.toFixed(2)}
              {r.significantChange && " 🚨"}
            </span>
          </div>
          <div className="flex items-center justify-between text-[10px] font-mono">
            <span className="text-muted-foreground">예상 winRate (CI 하한)</span>
            <span className={textTone}>
              ≥ {((r.expectedWinRate ?? 0) * 100).toFixed(1)}%
              <span className="text-[8px] opacity-70 ml-1">
                ({((r.expectedWinRate ?? 0) - r.baselineWinRate >= 0 ? "+" : "")}
                {(((r.expectedWinRate ?? 0) - r.baselineWinRate) * 100).toFixed(1)}%p)
              </span>
            </span>
          </div>
        </>
      ) : (
        <div className="text-[10px] font-mono text-muted-foreground">
          {r.sampleSufficient
            ? "통계적 유의성 부재 — 임계값 효과 X"
            : "표본 부족 (≥100 trades 권장)"}
        </div>
      )}

      {/* Bucket 분포 미니 차트 */}
      <div className="mt-2 pt-2 border-t border-border/20">
        <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${r.buckets.length}, 1fr)` }}>
          {r.buckets.map((b, i) => {
            const winRatePct = b.winRate * 100;
            const isAboveBaseline = b.ciLower >= r.baselineWinRate + 0.05;
            return (
              <div
                key={i}
                className="relative h-6 rounded-sm overflow-hidden bg-card/40"
                title={`${b.label}: n=${b.n}, ${winRatePct.toFixed(0)}% (CI ${(b.ciLower * 100).toFixed(0)}~${(b.ciUpper * 100).toFixed(0)}%)`}
              >
                <div
                  className={cn(
                    "absolute bottom-0 left-0 right-0 transition-all",
                    isAboveBaseline
                      ? "bg-emerald-400/40"
                      : winRatePct >= 50
                      ? "bg-neon-cyan/30"
                      : "bg-red-400/30",
                  )}
                  style={{ height: `${Math.min(100, winRatePct)}%` }}
                />
                <div className="absolute inset-0 flex items-center justify-center font-mono text-[8px] text-foreground">
                  {b.n}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-1 text-[8px] font-mono text-muted-foreground/60 text-center">
          {r.buckets[0].label} → {r.buckets[r.buckets.length - 1].label}
        </div>
      </div>
    </div>
  );
}
