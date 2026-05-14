/**
 * Macro Liquidity Tracker — Overview (Composite C1~C4).
 *
 * Macro Hub 의 default 탭. MACRO_LIQUIDITY_TRACKER_v2 시각화로
 * 7개 단일 지표 + 4개 composite signal (C1/C2/C3/C4) + Korea + FRED 시계열
 * 차트 + BBDX impact 카드를 보여준다. 본 페이지는 헌장 R3 (modifier-only)
 * 면책 텍스트를 명시하여, multiplier 가 BBDX 진입 신뢰도에 곱해지는
 * 보조 차원임을 강조.
 *
 * tRPC:
 *   - macroV2.snapshot — 현재 layer 객체
 *   - macroV2.history  — FRED 시계열 (seriesId + period)
 *
 * 라우트: `/macro` (외부 북마크 호환을 위해 `/wave/macro` 는 redirect)
 */

import { useMemo, useState } from "react";
import { Activity, AlertTriangle, Clock, Loader2 } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { trpc } from "@/lib/trpc";
import { HudPanel, StatCard } from "@/components/HudPanel";
import { RefreshIconButton } from "@/components/RefreshIconButton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { CyclePhase, MacroLayer, MacroRegime } from "@shared/macro-types";

// ── Regime 색상 매핑 ────────────────────────────────────────
const REGIME_META: Record<
  MacroRegime,
  { label: string; color: string; bg: string; text: string }
> = {
  crisis: {
    label: "CRISIS",
    color: "oklch(0.65 0.25 25)",
    bg: "bg-red-500/15",
    text: "text-red-400",
  },
  tight: {
    label: "TIGHT",
    color: "oklch(0.7 0.18 60)",
    bg: "bg-orange-500/15",
    text: "text-orange-400",
  },
  neutral: {
    label: "NEUTRAL",
    color: "oklch(0.7 0.05 260)",
    bg: "bg-slate-500/15",
    text: "text-slate-300",
  },
  easing: {
    label: "EASING",
    color: "oklch(0.78 0.15 165)",
    bg: "bg-emerald-500/15",
    text: "text-neon-green",
  },
  flooded: {
    label: "FLOODED",
    color: "oklch(0.7 0.22 305)",
    bg: "bg-purple-500/15",
    text: "text-fuchsia-400",
  },
};

const CYCLE_PHASE_META: Record<
  CyclePhase,
  { label: string; bg: string; text: string }
> = {
  pre_recession: {
    label: "PRE-RECESSION",
    bg: "bg-orange-500/15",
    text: "text-orange-400",
  },
  recession_imminent: {
    label: "RECESSION IMMINENT",
    bg: "bg-red-500/15",
    text: "text-red-400",
  },
  fed_pivot: {
    label: "FED PIVOT",
    bg: "bg-yellow-500/15",
    text: "text-neon-yellow",
  },
  crypto_rally: {
    label: "CRYPTO RALLY",
    bg: "bg-emerald-500/15",
    text: "text-neon-green",
  },
  neutral: {
    label: "NEUTRAL",
    bg: "bg-slate-500/15",
    text: "text-slate-300",
  },
};

// ── FRED 시계열 셀렉터 ─────────────────────────────────────
const SERIES_OPTIONS: { id: string; label: string }[] = [
  { id: "SOFR", label: "SOFR" },
  { id: "IORB", label: "IORB" },
  { id: "DGS10", label: "10Y Treasury" },
  { id: "DGS2", label: "2Y Treasury" },
  { id: "T10Y2Y", label: "Yield Curve 10Y-2Y" },
  { id: "WALCL", label: "Fed Balance Sheet (WALCL)" },
  { id: "RRPONTSYD", label: "Reverse Repo" },
  { id: "WTREGEN", label: "Treasury General Acct (TGA)" },
  { id: "DTWEXBGS", label: "DXY (Broad)" },
  { id: "VIXCLS", label: "VIX" },
  { id: "DFII10", label: "Real Rate 10Y" },
];

const PERIOD_OPTIONS = [
  { value: "30d" as const, label: "30D" },
  { value: "90d" as const, label: "90D" },
  { value: "1y" as const, label: "1Y" },
  { value: "5y" as const, label: "5Y" },
];

// ── Helpers ────────────────────────────────────────────────
function fmtNum(v: number | null | undefined, digits = 2, suffix = ""): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v.toFixed(digits)}${suffix}`;
}

function fmtPct(v: number | null | undefined, digits = 2): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(digits)}%`;
}

function scoreToColor(score: number): string {
  // -100~+100 → red → orange → slate → green → purple
  if (score <= -60) return "text-red-400";
  if (score <= -20) return "text-orange-400";
  if (score < 20) return "text-muted-foreground";
  if (score < 60) return "text-neon-green";
  return "text-primary";
}

// ── Sub-components ─────────────────────────────────────────

function SummaryCard({ layer }: { layer: MacroLayer }) {
  const regime = REGIME_META[layer.regime];
  const effectiveMult = 1 + (layer.multiplier - 1) * layer.freshness_mult;
  return (
    <HudPanel
      title="Macro Score & Regime"
      subtitle="MACRO_v2 § score → regime → multiplier"
      variant="highlight"
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="hud-frame p-3">
          <div className="font-mono text-[10px] text-muted-foreground tracking-wider mb-1">
            Score (-100 ~ +100)
          </div>
          <div
            className={cn(
              "font-display text-3xl font-bold",
              scoreToColor(layer.score)
            )}
          >
            {layer.score >= 0 ? "+" : ""}
            {layer.score.toFixed(0)}
          </div>
        </div>
        <div className="hud-frame p-3">
          <div className="font-mono text-[10px] text-muted-foreground tracking-wider mb-1">
            Regime
          </div>
          <div
            className={cn(
              "inline-flex items-center gap-1.5 px-2 py-1 rounded-md font-display text-sm font-bold",
              regime.bg,
              regime.text
            )}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: regime.color }}
            />
            {regime.label}
          </div>
        </div>
        <div className="hud-frame p-3">
          <div className="font-mono text-[10px] text-muted-foreground tracking-wider mb-1">
            Effective Multiplier
          </div>
          <div className="font-display text-3xl font-bold text-primary">
            ×{effectiveMult.toFixed(2)}
          </div>
          <div className="font-mono text-[10px] text-muted-foreground mt-1">
            base ×{layer.multiplier.toFixed(2)} · freshness ×
            {layer.freshness_mult.toFixed(2)}
          </div>
        </div>
      </div>
    </HudPanel>
  );
}

function IndicatorGrid({ layer }: { layer: MacroLayer }) {
  const b = layer.breakdown;
  const items: Array<{
    label: string;
    value: string;
    contribution: number;
    hint?: string;
  }> = [
    {
      label: "SOFR-IORB Spread",
      value: fmtNum(layer.sofr_iorb_spread_bp, 1, " bp"),
      contribution: b.spread_score,
      hint: "단기 자금 압박 (> 0 이면 자금경색 위험)",
    },
    {
      label: "Yield Curve 10Y-2Y",
      value: fmtNum(layer.yield_curve_10_2, 2, "%"),
      contribution: b.yield_curve_score,
      hint: "역전 (음수) → 침체 신호",
    },
    {
      label: "WALCL 30d",
      value: fmtPct(layer.walcl_change_30d_pct),
      contribution: b.walcl_score,
      hint: "Fed 대차대조표 (QE/QT)",
    },
    {
      label: "RRP+TGA 30d",
      value: fmtPct(layer.rrp_tga_change_30d_pct),
      contribution: b.rrp_tga_score,
      hint: "역레포·재무성 잔고 (drain ↑ → 유동성 ↓)",
    },
    {
      label: "Real Rate",
      value: fmtNum(layer.real_rate, 2, "%"),
      contribution: b.real_rate_score,
      hint: "10Y 실질금리 (TIPS)",
    },
    {
      label: "DXY 30d",
      value: fmtPct(layer.dxy_change_30d_pct),
      contribution: b.dxy_score,
      hint: "달러 인덱스 변화 (강달러 → 위험자산 ↓)",
    },
    {
      label: "VIX",
      value: fmtNum(layer.vix, 1),
      contribution: b.vix_score,
      hint: "공포 지수 (> 30 = 위기)",
    },
  ];

  return (
    <HudPanel
      title="7 Single Indicators"
      subtitle="MACRO_v2 §2 · raw + scored contribution"
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {items.map(it => (
          <div key={it.label} className="hud-frame p-3">
            <div className="font-mono text-[10px] text-muted-foreground tracking-wider mb-1">
              {it.label}
            </div>
            <div className="font-display text-lg font-bold text-foreground">
              {it.value}
            </div>
            <div
              className={cn(
                "font-mono text-[10px] mt-1",
                it.contribution >= 0 ? "text-neon-green" : "text-red-400"
              )}
            >
              score: {it.contribution >= 0 ? "+" : ""}
              {it.contribution.toFixed(1)}
            </div>
            {it.hint && (
              <div className="font-mono text-[9px] text-muted-foreground/70 mt-1 leading-tight">
                {it.hint}
              </div>
            )}
          </div>
        ))}
      </div>
    </HudPanel>
  );
}

function CompositeGauge({
  label,
  value,
  highThreshold,
  highColor,
  highLabel,
}: {
  label: string;
  value: number;
  highThreshold: number;
  highColor: "red" | "green";
  highLabel: string;
}) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  const triggered = value > highThreshold;
  const barColor = highColor === "red" ? "bg-red-500" : "bg-emerald-500";
  return (
    <div className="hud-frame p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="font-mono text-[10px] text-muted-foreground tracking-wider">
          {label}
        </div>
        <div
          className={cn(
            "font-display text-sm font-bold",
            triggered
              ? highColor === "red"
                ? "text-red-400"
                : "text-neon-green"
              : "text-primary"
          )}
        >
          {value.toFixed(2)}
        </div>
      </div>
      <div className="h-2 bg-muted/30 rounded-sm overflow-hidden">
        <div
          className={cn("h-full transition-all", barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
      {triggered && (
        <div
          className={cn(
            "font-mono text-[10px] mt-2",
            highColor === "red" ? "text-red-400" : "text-neon-green"
          )}
        >
          {highLabel}
        </div>
      )}
    </div>
  );
}

function CompositeSignalsCard({ layer }: { layer: MacroLayer }) {
  const c4 = CYCLE_PHASE_META[layer.c4_cycle_phase];
  return (
    <HudPanel
      title="Composite Signals (C1~C4)"
      subtitle="다중 지표 조합 — 위기 / risk-on / 순유동성 / 사이클"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <CompositeGauge
          label="C1 — Crisis"
          value={layer.c1_crisis}
          highThreshold={0.6}
          highColor="red"
          highLabel="위기 강화 (≥ 0.6)"
        />
        <CompositeGauge
          label="C2 — Risk-On"
          value={layer.c2_riskOn}
          highThreshold={0.8}
          highColor="green"
          highLabel="Risk-on 강화 (≥ 0.8)"
        />
        <div className="hud-frame p-3">
          <div className="font-mono text-[10px] text-muted-foreground tracking-wider mb-1">
            C3 — Net Liquidity 30d
          </div>
          <div
            className={cn(
              "font-display text-2xl font-bold",
              layer.c3_net_liquidity_30d_pct >= 0
                ? "text-neon-green"
                : "text-red-400"
            )}
          >
            {fmtPct(layer.c3_net_liquidity_30d_pct, 2)}
          </div>
          <div className="font-mono text-[10px] text-muted-foreground mt-1">
            WALCL - RRP - TGA
          </div>
        </div>
        <div className="hud-frame p-3">
          <div className="font-mono text-[10px] text-muted-foreground tracking-wider mb-1">
            C4 — Cycle Phase
          </div>
          <div
            className={cn(
              "inline-flex items-center gap-1.5 px-2 py-1 rounded-md font-display text-xs font-bold mt-1",
              c4.bg,
              c4.text
            )}
          >
            {c4.label}
          </div>
        </div>
      </div>
    </HudPanel>
  );
}

function KoreaMacroCard({ layer }: { layer: MacroLayer }) {
  const hasBok = layer.bok_rate != null;
  const hasKrw = layer.krw_usd != null;

  if (!hasBok && !hasKrw) {
    return (
      <HudPanel title="Korea Macro" subtitle="BOK ECOS · KRW/USD">
        <div className="text-xs font-mono text-muted-foreground py-4 text-center">
          BOK ECOS API key 미설정 — 환율은 Yahoo Finance fallback. 데이터 없음.
        </div>
      </HudPanel>
    );
  }

  return (
    <HudPanel title="Korea Macro" subtitle="BOK ECOS · KRW/USD">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <StatCard
          label="BOK Policy Rate"
          value={hasBok ? fmtNum(layer.bok_rate, 2, "%") : "—"}
          change={layer.bok_rate_change_90d ?? undefined}
        />
        <StatCard
          label="KRW / USD"
          value={hasKrw ? fmtNum(layer.krw_usd, 2) : "—"}
          change={layer.krw_change_30d_pct ?? undefined}
        />
      </div>
    </HudPanel>
  );
}

function BBDXImpactCard({ layer }: { layer: MacroLayer }) {
  const effectiveMult = 1 + (layer.multiplier - 1) * layer.freshness_mult;
  const crisisOn = layer.c1_crisis > 0.6;
  const riskOn = layer.c2_riskOn > 0.8;

  return (
    <HudPanel
      title="BBDX Impact"
      subtitle="헌장 R3 — modifier-only, 단독 시그널 X"
      variant={crisisOn ? "danger" : "default"}
    >
      <div className="space-y-3">
        <div className="hud-frame p-3 flex items-center gap-3">
          <Activity className="h-5 w-5 text-primary shrink-0" />
          <div className="flex-1">
            <div className="font-mono text-[10px] text-muted-foreground tracking-wider">
              현재 macro_mult
            </div>
            <div className="font-display text-2xl font-bold text-primary">
              ×{effectiveMult.toFixed(2)}
            </div>
          </div>
        </div>
        {(crisisOn || riskOn) && (
          <div className="flex flex-wrap gap-2">
            {crisisOn && (
              <Badge className="bg-red-500/15 text-red-400 border-red-500/40">
                C1 위기 강화
              </Badge>
            )}
            {riskOn && (
              <Badge className="bg-emerald-500/15 text-neon-green border-emerald-500/40">
                C2 Risk-on 강화
              </Badge>
            )}
          </div>
        )}
        <div className="font-mono text-[10px] text-muted-foreground leading-relaxed">
          이 multiplier 가 BBDX 진입 신뢰도에 곱해집니다. macro 단독으로는
          신호를 발행하지 않으며, BB+RSI+ADX 컨플루언스 발생 시 가중치로만
          작동합니다 (Charter R3 = modifier-only).
        </div>
      </div>
    </HudPanel>
  );
}

function FreshnessHeader({ layer }: { layer: MacroLayer }) {
  const stale = layer.freshness_mult < 1.0;
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-lg",
        stale ? "bg-yellow-500/5" : "bg-card"
      )}
    >
      <Clock
        className={cn("h-4 w-4", stale ? "text-neon-yellow" : "text-primary")}
      />
      <div className="flex-1 font-mono text-xs">
        <span className="text-muted-foreground">데이터 경과: </span>
        <span className={stale ? "text-neon-yellow" : "text-foreground"}>
          {layer.age_hours.toFixed(1)}시간 전
        </span>
        <span className="text-muted-foreground"> · freshness ×</span>
        <span className={stale ? "text-neon-yellow" : "text-primary"}>
          {layer.freshness_mult.toFixed(2)}
        </span>
      </div>
      {stale && <AlertTriangle className="h-4 w-4 text-neon-yellow shrink-0" />}
    </div>
  );
}

function TimeSeriesChart() {
  const [seriesId, setSeriesId] = useState<string>("DGS10");
  const [period, setPeriod] = useState<"30d" | "90d" | "1y" | "5y">("1y");

  const query = trpc.macroV2.history.useQuery(
    { seriesId, period },
    { staleTime: 5 * 60 * 1000 }
  );

  const data = useMemo(() => {
    if (!query.data || query.data.status === "error") return [];
    return (query.data.observations ?? []).map(o => ({
      date: o.date,
      value: o.value,
    }));
  }, [query.data]);

  const seriesLabel =
    SERIES_OPTIONS.find(s => s.id === seriesId)?.label ?? seriesId;

  return (
    <HudPanel
      title="FRED Time Series"
      subtitle={`${seriesLabel} (${period.toUpperCase()})`}
      headerRight={
        <div className="flex items-center gap-2">
          <Select value={seriesId} onValueChange={setSeriesId}>
            <SelectTrigger className="h-7 w-[180px] font-mono text-[10px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SERIES_OPTIONS.map(s => (
                <SelectItem
                  key={s.id}
                  value={s.id}
                  className="font-mono text-xs"
                >
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={period}
            onValueChange={v => setPeriod(v as "30d" | "90d" | "1y" | "5y")}
          >
            <SelectTrigger className="h-7 w-[80px] font-mono text-[10px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map(p => (
                <SelectItem
                  key={p.value}
                  value={p.value}
                  className="font-mono text-xs"
                >
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      }
    >
      {query.isLoading ? (
        <div className="h-[260px] flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-neon-cyan" />
        </div>
      ) : query.data?.status === "error" ? (
        <div className="h-[260px] flex items-center justify-center font-mono text-xs text-red-400">
          {query.data.detail ?? "FRED fetch error"}
        </div>
      ) : data.length === 0 ? (
        <div className="h-[260px] flex items-center justify-center font-mono text-xs text-muted-foreground">
          시계열 데이터 없음
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="macroSeries" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="oklch(0.78 0.15 165)"
                  stopOpacity={0.4}
                />
                <stop
                  offset="100%"
                  stopColor="oklch(0.78 0.15 165)"
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(0,0,0,0.06)" />
            <XAxis
              dataKey="date"
              tick={{
                fontSize: 10,
                fontFamily: "Fragment Mono",
                fill: "#7a7a7a",
              }}
              minTickGap={40}
            />
            <YAxis
              tick={{
                fontSize: 10,
                fontFamily: "Fragment Mono",
                fill: "#7a7a7a",
              }}
              domain={["auto", "auto"]}
            />
            <Tooltip
              contentStyle={{
                background: "#ffffff",
                border: "1px solid #ececec",
                borderRadius: "8px",
                fontFamily: "Fragment Mono",
                fontSize: "11px",
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="oklch(0.78 0.15 165)"
              fill="url(#macroSeries)"
              strokeWidth={1.5}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
      {query.data?.status === "stub" && (
        <div className="font-mono text-[10px] text-muted-foreground/70 mt-2">
          FRED_API_KEY 미설정 — stub 데이터.
        </div>
      )}
    </HudPanel>
  );
}

// ── Main page ──────────────────────────────────────────────

export default function MacroHub() {
  const snapshotQuery = trpc.macroV2.snapshot.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  // tRPC returns the layer as inferred type, but we cast to our mirror shape
  // (값 형상은 동일).
  const layer = (snapshotQuery.data as MacroLayer | null) ?? null;

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
            Macro liquidity tracker
          </h1>
          <p className="font-mono text-xs text-muted-foreground mt-1">
            Overview (Composite C1~C4) / 6차원 매크로 / FRED + ALFRED / BBDX
            multiplier
          </p>
        </div>
        <RefreshIconButton
          onClick={() => snapshotQuery.refetch()}
          label="Refresh macro snapshot"
          isLoading={snapshotQuery.isFetching}
        />
      </div>

      {snapshotQuery.isLoading ? (
        <div className="py-20 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-neon-cyan" />
        </div>
      ) : !layer ? (
        <HudPanel title="Macro Snapshot 사용 불가" variant="danger">
          <div className="text-sm font-mono text-muted-foreground">
            FRED API 응답 실패 또는 데이터 미수신. FRED_API_KEY 환경변수 설정
            여부를 확인하세요.
          </div>
        </HudPanel>
      ) : (
        <>
          <FreshnessHeader layer={layer} />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <SummaryCard layer={layer} />
            </div>
            <BBDXImpactCard layer={layer} />
          </div>

          <IndicatorGrid layer={layer} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <CompositeSignalsCard layer={layer} />
            <KoreaMacroCard layer={layer} />
          </div>

          <TimeSeriesChart />
        </>
      )}
    </div>
  );
}
