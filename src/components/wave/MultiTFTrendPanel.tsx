/**
 * MultiTFTrendPanel — Trend Analysis Engine v2.0 UI (backend-first, client fallback).
 *
 * v6.5 / dev 백엔드의 `trpc.trend.analyze` 라우트를 우선 호출:
 *   per-TF DeepTimeframeTrend (4-tier confirmation: 추세선/EMA/ADX/HH-HL +
 *   거래량 보조) + 5-state Wave Alignment + BBDX waveMult.
 *
 * 백엔드 응답이 loading / error 일 때만 클라이언트 사이드 `lib/trend-analysis.ts`
 * (~800 줄 풀 구현) fallback 으로 같은 화면 렌더 — offline 또는 빠른 preview.
 *
 * TF 옵션 (사용자 토글):
 *   15m / 1H / 4H / 1D / 1W (default 4개: 1h / 4h / 1d / 1w)
 *
 * 헌장 규칙 3 준수: 단독 진입 시그널 X, BBDX 보조 컨텍스트로만 표시.
 */

import { useMemo, useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  Zap,
  AlertTriangle,
  Cloud,
  Cpu,
} from "lucide-react";
import { useCoinDetail } from "@/hooks/useMarketData";
import {
  useTrendAnalysis,
  type TrendTf,
  type DeepTimeframeTrend,
  type WaveAlignment as BackendWaveAlignment,
  type EmaArrayState,
  type StructureState,
  type VolumeConfirmation,
} from "@/pages/CoinDetail/hooks/useTrendAnalysis";
import {
  analyzeTimeframeTrend,
  synthesizeMultiTFTrend,
  type TimeframeTrend,
  type TrendDirection,
  type TrendPhase,
  type MultiTFTrendAnalysis,
} from "@/lib/trend-analysis";
import { cn } from "@/lib/utils";

interface Props {
  symbol: string;
  className?: string;
}

// ─── TF config (15m + 1w 동시 지원) ──────────────────────────────────────
const TF_CONFIG: Array<{ tf: TrendTf; label: string; count: number }> = [
  { tf: "15m", label: "15M", count: 200 },
  { tf: "1h", label: "1H", count: 200 },
  { tf: "4h", label: "4H", count: 200 },
  { tf: "1d", label: "1D", count: 120 },
  { tf: "1w", label: "1W", count: 80 },
];

const DEFAULT_TFS: TrendTf[] = ["1h", "4h", "1d", "1w"];

// ─── 5-state Wave Alignment 시각화 매핑 ──────────────────────────────────
const ALIGNMENT_BADGES: Record<
  BackendWaveAlignment,
  { label: string; ko: string; tone: string; multiplier: number }
> = {
  perfect_up: {
    label: "PERFECT UP",
    ko: "전 TF 강세 정렬",
    tone: "border-emerald-500/50 bg-emerald-500/10 text-emerald-300",
    multiplier: 1.3,
  },
  partial_up: {
    label: "PARTIAL UP",
    ko: "부분 강세 정렬",
    tone: "border-emerald-300/40 bg-emerald-300/5 text-emerald-200",
    multiplier: 1.1,
  },
  mixed: {
    label: "MIXED",
    ko: "혼합 신호",
    tone: "border-zinc-500/40 bg-zinc-500/10 text-zinc-300",
    multiplier: 0.85,
  },
  opposing: {
    label: "OPPOSING",
    ko: "TF 역행 (위험)",
    tone: "border-orange-400/40 bg-orange-400/10 text-orange-300",
    multiplier: 0.65,
  },
  perfect_down: {
    label: "PERFECT DOWN",
    ko: "전 TF 약세 정렬",
    tone: "border-rose-500/50 bg-rose-500/10 text-rose-300",
    multiplier: 0.3,
  },
};

// ─── Client-side fallback alignment 라벨 (`lib/trend-analysis`) ──────────
const LEGACY_ALIGNMENT_LABEL: Record<
  MultiTFTrendAnalysis["alignment"],
  { ko: string; tone: string }
> = {
  ALIGNED_BULL: { ko: "전 TF 강세 정렬", tone: "text-emerald-400" },
  ALIGNED_BEAR: { ko: "전 TF 약세 정렬", tone: "text-red-400" },
  DIVERGENT: { ko: "TF간 다이버전스", tone: "text-orange-400" },
  MIXED: { ko: "혼합 신호", tone: "text-muted-foreground" },
};

const PHASE_LABEL: Record<
  TrendPhase,
  { ko: string; tone: "bull" | "bear" | "neutral" }
> = {
  STRONG_BULLISH: { ko: "강한 상승", tone: "bull" },
  BULLISH: { ko: "상승", tone: "bull" },
  BULLISH_WEAKENING: { ko: "상승 약화", tone: "neutral" },
  SIDEWAYS: { ko: "횡보", tone: "neutral" },
  BEARISH_WEAKENING: { ko: "하락 약화", tone: "neutral" },
  BEARISH: { ko: "하락", tone: "bear" },
  STRONG_BEARISH: { ko: "강한 하락", tone: "bear" },
};

// ─── 5-state EMA / HH-HL / 거래량 → 컬러 매핑 ────────────────────────────
function emaStateColor(s: EmaArrayState): string {
  switch (s) {
    case "GOLDEN":
      return "text-emerald-300 bg-emerald-300/10 border-emerald-300/30";
    case "BULLISH_ALIGNED":
      return "text-emerald-400 bg-emerald-400/5 border-emerald-400/30";
    case "DEATH":
      return "text-rose-300 bg-rose-300/10 border-rose-300/30";
    case "BEARISH_ALIGNED":
      return "text-rose-400 bg-rose-400/5 border-rose-400/30";
    default:
      return "text-muted-foreground bg-muted/10 border-border/30";
  }
}

function structStateColor(s: StructureState): string {
  switch (s) {
    case "HH_HL_x2":
      return "text-emerald-300 bg-emerald-300/10 border-emerald-300/30";
    case "HH_HL_x1":
      return "text-emerald-400 bg-emerald-400/5 border-emerald-400/30";
    case "LH_LL_x2":
      return "text-rose-300 bg-rose-300/10 border-rose-300/30";
    case "LH_LL_x1":
      return "text-rose-400 bg-rose-400/5 border-rose-400/30";
    default:
      return "text-muted-foreground bg-muted/10 border-border/30";
  }
}

function volStateColor(v: VolumeConfirmation): string {
  switch (v) {
    case "INCREASING":
      return "text-emerald-400 bg-emerald-400/5 border-emerald-400/30";
    case "DECREASING":
      return "text-rose-400 bg-rose-400/5 border-rose-400/30";
    default:
      return "text-muted-foreground bg-muted/10 border-border/30";
  }
}

function volArrow(v: VolumeConfirmation): string {
  return v === "INCREASING" ? "↑" : v === "DECREASING" ? "↓" : "→";
}

function dirIcon(
  side: "BULLISH" | "BEARISH" | "SIDEWAYS",
  size = "h-4 w-4"
) {
  if (side === "BULLISH")
    return <TrendingUp className={cn(size, "text-emerald-400")} />;
  if (side === "BEARISH")
    return <TrendingDown className={cn(size, "text-rose-400")} />;
  return <Minus className={cn(size, "text-muted-foreground")} />;
}

function dirIconLegacy(dir: TrendDirection, size = "h-4 w-4") {
  if (dir === "BULLISH")
    return <TrendingUp className={cn(size, "text-emerald-400")} />;
  if (dir === "BEARISH")
    return <TrendingDown className={cn(size, "text-rose-400")} />;
  return <Minus className={cn(size, "text-muted-foreground")} />;
}

function dirColor(dir: TrendDirection | "BULLISH" | "BEARISH" | "SIDEWAYS"): string {
  if (dir === "BULLISH") return "text-emerald-400";
  if (dir === "BEARISH") return "text-rose-400";
  return "text-muted-foreground";
}

// ────────────────────────────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────────────────────────────

export default function MultiTFTrendPanel({ symbol, className }: Props) {
  // 사용자 토글 — 어느 TF 가 활성화될지 (기본 4개)
  const [activeTfs, setActiveTfs] = useState<TrendTf[]>(DEFAULT_TFS);

  // ─── 백엔드 우선 (5-min 캐시) ─────────────────────────────────────────
  const backend = useTrendAnalysis(symbol, activeTfs);

  // 백엔드 에러 또는 비어있는 응답 시 fallback 활성화
  const hasBackendData =
    !!backend.data &&
    !backend.data.error &&
    Object.keys(backend.data.perTf ?? {}).length > 0;

  // 출처 라벨
  const dataSource: "server" | "client" | "loading" = hasBackendData
    ? "server"
    : backend.isLoading
      ? "loading"
      : "client";

  if (hasBackendData && backend.data) {
    return (
      <ServerView
        symbol={symbol}
        data={backend.data}
        activeTfs={activeTfs}
        onToggleTf={setActiveTfs}
        className={className}
        dataSource={dataSource}
      />
    );
  }

  // 클라이언트 사이드 fallback (offline 또는 백엔드 아직 안 떴을 때)
  return (
    <ClientFallbackView
      symbol={symbol}
      activeTfs={activeTfs}
      onToggleTf={setActiveTfs}
      className={className}
      backendLoading={backend.isLoading}
      backendError={backend.isError}
    />
  );
}

// ────────────────────────────────────────────────────────────────────────
// ServerView — `trpc.trend.analyze` 응답 기반 (백엔드 우선)
// ────────────────────────────────────────────────────────────────────────

function ServerView({
  symbol,
  data,
  activeTfs,
  onToggleTf,
  className,
  dataSource,
}: {
  symbol: string;
  data: NonNullable<ReturnType<typeof useTrendAnalysis>["data"]>;
  activeTfs: TrendTf[];
  onToggleTf: (tfs: TrendTf[]) => void;
  className?: string;
  dataSource: "server" | "client" | "loading";
}) {
  void symbol;
  const badge = ALIGNMENT_BADGES[data.alignment] ?? ALIGNMENT_BADGES.mixed;
  // perTf key 가 활성 TF 와 일치하지 않을 수 있으므로 활성 TF 중 응답에 있는 것만
  const orderedTfs = activeTfs
    .map((tf) => ({ tf, deep: data.perTf[tf] }))
    .filter((x): x is { tf: TrendTf; deep: DeepTimeframeTrend } => !!x.deep);

  return (
    <div className={cn("space-y-3", className)}>
      <PanelHeader
        activeTfs={activeTfs}
        onToggleTf={onToggleTf}
        dataSource={dataSource}
      />

      {/* 종합 alignment 카드 */}
      <div className={cn("p-3 rounded-sm border", badge.tone)}>
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            <div>
              <div className="text-base font-display font-bold tracking-wider">
                {badge.label}
              </div>
              <div className="text-[9px] font-mono opacity-70 uppercase tracking-wider">
                {badge.ko}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-display font-bold">
              ×{data.waveMult.toFixed(2)}
              <span className="text-[10px] opacity-70 font-mono ml-1">
                BBDX waveMult
              </span>
            </div>
            <div className="text-[9px] font-mono opacity-70">
              종합 신뢰도 {Math.round(data.overallConfidence)}%
            </div>
          </div>
        </div>

        {/* multiplier 진행바 (0.30~1.30 → 0~100%) */}
        <div className="h-1.5 rounded-full bg-card/40 overflow-hidden mb-2">
          <div
            className="h-full bg-current opacity-60 transition-all"
            style={{
              width: `${Math.max(0, Math.min(100, ((data.waveMult - 0.3) / 1.0) * 100))}%`,
            }}
          />
        </div>

        <div className="text-[10px] font-mono opacity-80">
          {badge.ko} · multiplier 기대값 ×{badge.multiplier.toFixed(2)}
        </div>
      </div>

      {/* Per-TF deep breakdown (4-tier confirmation) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {orderedTfs.map(({ tf, deep }) => (
          <DeepTfCard key={tf} tf={tf} deep={deep} />
        ))}
        {orderedTfs.length === 0 && (
          <div className="col-span-full text-[10px] font-mono text-muted-foreground py-3 text-center">
            활성 TF 가 응답에 없음 — 다른 TF 를 선택하세요.
          </div>
        )}
      </div>

      <Disclaimer />
    </div>
  );
}

// ─── Per-TF deep card (4-tier ✓/✗ + 5-state EMA/HH-HL/Vol chips) ─────────
function DeepTfCard({ tf, deep }: { tf: TrendTf; deep: DeepTimeframeTrend }) {
  const isBull = deep.side === "BULLISH";
  const isBear = deep.side === "BEARISH";
  const tone = isBull
    ? "border-emerald-500/30 bg-emerald-500/5"
    : isBear
      ? "border-rose-500/30 bg-rose-500/5"
      : "border-border/30 bg-card/30";

  // 4-tier confirmations: trendline + emaArray + adxStrength + hhHlStructure
  // (volume 은 5번째 보조 — 진행 막대에는 미포함, chip 으로 표시)
  const tier = deep.confirmations;
  const emaPass =
    deep.side === "BULLISH"
      ? tier.emaArray === "GOLDEN" || tier.emaArray === "BULLISH_ALIGNED"
      : deep.side === "BEARISH"
        ? tier.emaArray === "DEATH" || tier.emaArray === "BEARISH_ALIGNED"
        : false;
  const adxPass = tier.adxStrength === "STRONG";
  const structPass =
    deep.side === "BULLISH"
      ? tier.hhHlStructure === "HH_HL_x2" || tier.hhHlStructure === "HH_HL_x1"
      : deep.side === "BEARISH"
        ? tier.hhHlStructure === "LH_LL_x2" || tier.hhHlStructure === "LH_LL_x1"
        : false;
  const checks = [
    { label: "Trend", ok: tier.trendline },
    { label: "EMA", ok: emaPass },
    { label: "ADX", ok: adxPass },
    { label: "HH/HL", ok: structPass },
  ];
  const confirmCount = checks.filter((c) => c.ok).length;

  return (
    <div className={cn("p-2 rounded-sm border", tone)}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-mono font-bold text-foreground tracking-wider">
          {tfLabel(tf)}
        </span>
        {dirIcon(deep.side, "h-3 w-3")}
      </div>

      <div className={cn("text-sm font-display font-bold", dirColor(deep.side))}>
        {Math.round(deep.confidenceScore)}
        <span className="text-[9px] text-muted-foreground font-mono">/100</span>
      </div>

      {/* 4-tier ✓/✗ 진행 막대 */}
      <div className="mt-1.5 space-y-0.5">
        <div className="flex items-center gap-0.5">
          {checks.map((c, i) => (
            <span
              key={i}
              className={cn(
                "flex-1 h-1 rounded-sm",
                c.ok ? "bg-emerald-400/70" : "bg-muted/30"
              )}
              title={`${c.label}: ${c.ok ? "PASS" : "FAIL"}`}
            />
          ))}
        </div>
        <div className="flex items-center justify-between text-[8px] font-mono text-muted-foreground">
          <span>4-tier 확인</span>
          <span className={confirmCount >= 3 ? "text-emerald-400" : ""}>
            {confirmCount}/4
          </span>
        </div>
      </div>

      {/* 4-tier 라벨 (좁은 컬럼에 ✓/✗ + 라벨) */}
      <div className="mt-1.5 grid grid-cols-2 gap-0.5 text-[8px] font-mono">
        {checks.map((c) => (
          <span
            key={c.label}
            className={cn(
              "flex items-center gap-0.5",
              c.ok ? "text-foreground" : "text-muted-foreground/50"
            )}
          >
            <span className={c.ok ? "text-emerald-400" : "text-muted-foreground/40"}>
              {c.ok ? "✓" : "✗"}
            </span>
            {c.label}
          </span>
        ))}
      </div>

      {/* 5-state chips: EMA / HH-HL / Volume */}
      <div className="mt-1.5 pt-1.5 border-t border-border/20 flex flex-wrap gap-0.5">
        <span
          className={cn(
            "text-[8px] font-mono px-1 py-0.5 rounded-sm border",
            emaStateColor(tier.emaArray)
          )}
          title={`EMA 배열: ${tier.emaArray}`}
        >
          {tier.emaArray.replace("_ALIGNED", "").replace("_", "·").toLowerCase()}
        </span>
        <span
          className={cn(
            "text-[8px] font-mono px-1 py-0.5 rounded-sm border",
            structStateColor(tier.hhHlStructure)
          )}
          title={`HH/HL 구조: ${tier.hhHlStructure}`}
        >
          {tier.hhHlStructure.toLowerCase().replace("_x2", "²").replace("_x1", "¹").replace("_", "")}
        </span>
        <span
          className={cn(
            "text-[8px] font-mono px-1 py-0.5 rounded-sm border",
            volStateColor(tier.volumeConfirm)
          )}
          title={`거래량: ${tier.volumeConfirm}`}
        >
          vol{volArrow(tier.volumeConfirm)}
        </span>
      </div>

      {/* ADX raw */}
      <div className="mt-1 flex items-center justify-between text-[8px] font-mono">
        <span className="text-muted-foreground">ADX</span>
        <span
          className={cn(
            tier.adxStrength === "STRONG"
              ? "text-emerald-300"
              : "text-muted-foreground"
          )}
        >
          {deep.adx.toFixed(1)}
          {tier.adxStrength === "STRONG" && " ★"}
        </span>
      </div>
    </div>
  );
}

function tfLabel(tf: TrendTf): string {
  return TF_CONFIG.find((c) => c.tf === tf)?.label ?? tf.toUpperCase();
}

// ────────────────────────────────────────────────────────────────────────
// ClientFallbackView — `lib/trend-analysis.ts` 사용 (offline / backend down)
// 기존 ~300줄 구현을 보존. 5-state alignment 미지원이라 4-state legacy.
// ────────────────────────────────────────────────────────────────────────

function ClientFallbackView({
  symbol,
  activeTfs,
  onToggleTf,
  className,
  backendLoading,
  backendError,
}: {
  symbol: string;
  activeTfs: TrendTf[];
  onToggleTf: (tfs: TrendTf[]) => void;
  className?: string;
  backendLoading: boolean;
  backendError: boolean;
}) {
  // 활성 TF 별 캔들 fetch — useCoinDetail 은 1h/4h/1d/1w 는 잘 동작.
  // 15m 은 Bybit Spot 호환 위해 1h fallback (백엔드와 동일 정책).
  const tf15m = useCoinDetail(symbol, "1h", 200);
  const tf1h = useCoinDetail(symbol, "1h", 200);
  const tf4h = useCoinDetail(symbol, "4h", 200);
  const tf1d = useCoinDetail(symbol, "1d", 120);
  const tf1w = useCoinDetail(symbol, "1w", 80);

  const isLoading =
    activeTfs.includes("15m")
      ? tf15m.isLoading
      : false ||
        (activeTfs.includes("1h") && tf1h.isLoading) ||
        (activeTfs.includes("4h") && tf4h.isLoading) ||
        (activeTfs.includes("1d") && tf1d.isLoading) ||
        (activeTfs.includes("1w") && tf1w.isLoading);

  const analysis: MultiTFTrendAnalysis | null = useMemo(() => {
    const sets: Array<{ data: ReturnType<typeof useCoinDetail>["data"]; tf: TrendTf; label: string }> = [];
    if (activeTfs.includes("15m"))
      sets.push({ data: tf15m.data, tf: "15m", label: "15M" });
    if (activeTfs.includes("1h"))
      sets.push({ data: tf1h.data, tf: "1h", label: "1H" });
    if (activeTfs.includes("4h"))
      sets.push({ data: tf4h.data, tf: "4h", label: "4H" });
    if (activeTfs.includes("1d"))
      sets.push({ data: tf1d.data, tf: "1d", label: "1D" });
    if (activeTfs.includes("1w"))
      sets.push({ data: tf1w.data, tf: "1w", label: "1W" });

    const trends: TimeframeTrend[] = [];
    for (const s of sets) {
      if (!s.data?.candles || s.data.candles.length < 20) continue;
      try {
        // analyzeTimeframeTrend 의 tf 인자는 client 사이드 union 형식 — "15m"
        // 은 미지원이라 1h 로 fallback 하여 호출.
        const tfParam = s.tf === "15m" ? "1h" : s.tf;
        const t = analyzeTimeframeTrend(s.data.candles, tfParam, s.label);
        trends.push(t);
      } catch {
        // skip
      }
    }
    if (trends.length === 0) return null;
    return synthesizeMultiTFTrend(trends);
  }, [activeTfs, tf15m.data, tf1h.data, tf4h.data, tf1d.data, tf1w.data]);

  if (isLoading && !analysis) {
    return (
      <div
        className={cn(
          "p-4 rounded-sm border border-border/30 bg-card/40 animate-pulse",
          className
        )}
      >
        <PanelHeader
          activeTfs={activeTfs}
          onToggleTf={onToggleTf}
          dataSource={backendLoading ? "loading" : "client"}
        />
        <div className="flex items-center gap-2 text-muted-foreground mt-3">
          <Activity className="h-4 w-4 animate-pulse" />
          <span className="text-xs font-mono">
            {backendLoading
              ? "서버 추세 분석 가져오는 중…"
              : "클라이언트 사이드 추세선 분석 중…"}
          </span>
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div
        className={cn(
          "p-4 rounded-sm border border-border/30 bg-card/40 space-y-3",
          className
        )}
      >
        <PanelHeader
          activeTfs={activeTfs}
          onToggleTf={onToggleTf}
          dataSource={backendError ? "client" : "loading"}
        />
        <div className="flex items-center gap-2 text-muted-foreground">
          <AlertTriangle className="h-4 w-4" />
          <span className="text-xs font-mono">
            데이터 부족 (최소 20캔들 필요)
          </span>
        </div>
      </div>
    );
  }

  const overallPhase = PHASE_LABEL[analysis.overallPhase];
  const alignment = LEGACY_ALIGNMENT_LABEL[analysis.alignment];
  const isBull = analysis.overallDirection === "BULLISH";
  const isBear = analysis.overallDirection === "BEARISH";

  const overallTone = isBull
    ? "border-emerald-500/40 bg-emerald-500/5"
    : isBear
      ? "border-rose-500/40 bg-rose-500/5"
      : "border-neon-cyan/30 bg-neon-cyan/5";

  return (
    <div className={cn("space-y-3", className)}>
      <PanelHeader
        activeTfs={activeTfs}
        onToggleTf={onToggleTf}
        dataSource="client"
      />

      <div className={cn("p-3 rounded-sm border", overallTone)}>
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            {dirIconLegacy(analysis.overallDirection, "h-5 w-5")}
            <div>
              <div
                className={cn(
                  "text-base font-display font-bold",
                  dirColor(analysis.overallDirection)
                )}
              >
                {overallPhase.ko}
              </div>
              <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">
                {analysis.overallPhase}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div
              className={cn(
                "text-2xl font-display font-bold",
                dirColor(analysis.overallDirection)
              )}
            >
              {analysis.overallStrength}
              <span className="text-xs text-muted-foreground font-mono">
                /100
              </span>
            </div>
            <div className="text-[9px] font-mono text-muted-foreground">
              신뢰도 {analysis.confidence}%
            </div>
          </div>
        </div>

        <div className="h-1.5 rounded-full bg-card/50 overflow-hidden mb-2">
          <div
            className={cn(
              "h-full transition-all",
              isBull
                ? "bg-emerald-400"
                : isBear
                  ? "bg-rose-400"
                  : "bg-neon-cyan"
            )}
            style={{ width: `${analysis.overallStrength}%` }}
          />
        </div>

        <div className={cn("text-[10px] font-mono", alignment.tone)}>
          {alignment.ko}
        </div>

        {analysis.predictionKo && (
          <div className="mt-2 pt-2 border-t border-border/30 text-[10px] font-mono text-foreground leading-relaxed">
            {analysis.predictionKo}
          </div>
        )}
      </div>

      {/* Per-TF breakdown (legacy) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {analysis.trends.map((t) => (
          <LegacyTfCard key={t.timeframe} trend={t} />
        ))}
      </div>

      <Disclaimer />
    </div>
  );
}

// ─── Legacy per-TF card (lib/trend-analysis 결과 기반) ────────────────────
function LegacyTfCard({ trend }: { trend: TimeframeTrend }) {
  const phase = PHASE_LABEL[trend.phase];
  const isBull = trend.direction === "BULLISH";
  const isBear = trend.direction === "BEARISH";
  const tone = isBull
    ? "border-emerald-500/30 bg-emerald-500/5"
    : isBear
      ? "border-rose-500/30 bg-rose-500/5"
      : "border-border/30 bg-card/30";

  return (
    <div className={cn("p-2 rounded-sm border", tone)}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-mono font-bold text-foreground">
          {trend.label}
        </span>
        {dirIconLegacy(trend.direction, "h-3 w-3")}
      </div>
      <div
        className={cn(
          "text-sm font-display font-bold",
          dirColor(trend.direction)
        )}
      >
        {trend.strength}
        <span className="text-[9px] text-muted-foreground font-mono">/100</span>
      </div>
      <div className="text-[8px] font-mono text-muted-foreground mt-0.5">
        {phase.ko}
      </div>

      <div className="mt-1.5 pt-1.5 border-t border-border/20 space-y-0.5 text-[8px] font-mono">
        {trend.supportLine && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">지지선</span>
            <span
              className={cn(
                trend.supportLine.slopePct > 0
                  ? "text-emerald-300"
                  : "text-rose-300"
              )}
            >
              {trend.supportLine.slopePct >= 0 ? "+" : ""}
              {trend.supportLine.slopePct.toFixed(3)}%
            </span>
          </div>
        )}
        {trend.resistanceLine && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">저항선</span>
            <span
              className={cn(
                trend.resistanceLine.slopePct > 0
                  ? "text-emerald-300"
                  : "text-rose-300"
              )}
            >
              {trend.resistanceLine.slopePct >= 0 ? "+" : ""}
              {trend.resistanceLine.slopePct.toFixed(3)}%
            </span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">ADX</span>
          <span
            className={cn(
              trend.adxTrending ? "text-emerald-300" : "text-muted-foreground"
            )}
          >
            {trend.adxValue.toFixed(1)}
            {trend.adxTrending && " ★"}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">EMA</span>
          <span
            className={cn(
              trend.emaAlignment.state === "BULLISH_ALIGNED" ||
                trend.emaAlignment.state === "GOLDEN_CROSS"
                ? "text-emerald-300"
                : trend.emaAlignment.state === "BEARISH_ALIGNED" ||
                    trend.emaAlignment.state === "DEATH_CROSS"
                  ? "text-rose-300"
                  : "text-muted-foreground"
            )}
          >
            {trend.emaAlignment.state.replace(/_/g, " ").toLowerCase()}
          </span>
        </div>
        {trend.breakout.detected && (
          <div
            className={cn(
              "flex items-center justify-between",
              trend.breakout.type === "BULLISH_BREAKOUT"
                ? "text-emerald-400"
                : "text-rose-400"
            )}
          >
            <span>브레이크아웃</span>
            <span>{trend.breakout.confidence}%</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Header (TF 토글 + 데이터 출처 라벨)
// ────────────────────────────────────────────────────────────────────────

function PanelHeader({
  activeTfs,
  onToggleTf,
  dataSource,
}: {
  activeTfs: TrendTf[];
  onToggleTf: (tfs: TrendTf[]) => void;
  dataSource: "server" | "client" | "loading";
}) {
  const toggle = (tf: TrendTf) => {
    if (activeTfs.includes(tf)) {
      // 최소 1개는 유지
      if (activeTfs.length === 1) return;
      onToggleTf(activeTfs.filter((x) => x !== tf));
    } else {
      // TF 순서를 TF_CONFIG 와 동일하게 유지
      const next = [...activeTfs, tf];
      const order = TF_CONFIG.map((c) => c.tf);
      next.sort((a, b) => order.indexOf(a) - order.indexOf(b));
      onToggleTf(next);
    }
  };

  return (
    <div className="flex items-center justify-between gap-2 text-[10px] font-mono flex-wrap">
      <span className="text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
        <Zap className="h-3 w-3" />
        Trend Analysis Engine v2.0
      </span>
      <div className="flex items-center gap-2">
        {/* TF 토글 */}
        <div className="flex items-center gap-0.5 bg-card/40 border border-border/30 rounded-sm px-1 py-0.5">
          {TF_CONFIG.map((c) => {
            const active = activeTfs.includes(c.tf);
            return (
              <button
                key={c.tf}
                type="button"
                onClick={() => toggle(c.tf)}
                className={cn(
                  "px-1.5 py-0.5 rounded-sm transition-all text-[9px]",
                  active
                    ? "bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/30 border border-transparent"
                )}
                title={`${c.label} TF ${active ? "비활성화" : "활성화"}`}
              >
                {c.label}
              </button>
            );
          })}
        </div>
        {/* 데이터 출처 라벨 */}
        <DataSourceBadge dataSource={dataSource} />
      </div>
    </div>
  );
}

function DataSourceBadge({
  dataSource,
}: {
  dataSource: "server" | "client" | "loading";
}) {
  if (dataSource === "server") {
    return (
      <span
        className="px-1.5 py-0.5 rounded-sm border border-emerald-400/40 bg-emerald-400/5 text-emerald-300 flex items-center gap-1"
        title="백엔드 trpc.trend.analyze (5분 캐시)"
      >
        <Cloud className="h-2.5 w-2.5" />
        Server-cached (5min)
      </span>
    );
  }
  if (dataSource === "client") {
    return (
      <span
        className="px-1.5 py-0.5 rounded-sm border border-neon-pink/30 bg-neon-pink/5 text-neon-pink flex items-center gap-1"
        title="클라이언트 사이드 lib/trend-analysis (offline fallback)"
      >
        <Cpu className="h-2.5 w-2.5" />
        Client-side (live)
      </span>
    );
  }
  return (
    <span className="px-1.5 py-0.5 rounded-sm border border-border/30 bg-muted/10 text-muted-foreground flex items-center gap-1">
      <Activity className="h-2.5 w-2.5 animate-pulse" />
      Loading…
    </span>
  );
}

function Disclaimer() {
  return (
    <div className="flex items-start gap-1.5 text-[9px] font-mono text-muted-foreground/70 leading-relaxed">
      <AlertTriangle className="h-2.5 w-2.5 mt-0.5 shrink-0" />
      <span>
        단독 진입 신호 X — BBDX (RSI/BB/ADX) 시그널의 보조 컨텍스트.
        4-tier 확인 (추세선·EMA·ADX·HH/HL) + 거래량 보조 + 5-state Wave
        Alignment. waveMult 는 BBDX final_confidence 곱셈 체인에만 사용
        (헌장 규칙 3).
      </span>
    </div>
  );
}
