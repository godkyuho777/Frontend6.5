/**
 * Engine A — Single Indicator Backtest tab.
 *
 * DUAL_BACKTEST_ENGINE_PLAN §2 의 시각화.
 *
 * 사용자 가설: "RSI < 30 매수 후 3% 익절 / 30 캔들 시간 손절. BTC 4H 1년."
 *  → totalSignals, winRate (Wilson 95% CI), MDD, Sharpe, Profit Factor,
 *    그리고 bucket 별 승률 + 알파 유의성 (binomial p-value).
 *
 * 헌장: 단일 지표 백테스트 = 단독 시그널 평가가 아닌 *가설 검증 도구*.
 */

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FlaskConical,
  Loader2,
  Play,
  XCircle,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ErrorBar,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { trpc } from "@/lib/trpc";
import { HudPanel } from "@/components/HudPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type {
  EntryConditionType,
  ExitCondition,
  IndicatorLayer,
  SampleSufficiency,
  SingleIndicatorConfig,
  SingleIndicatorResult,
} from "@shared/macro-types";

// ── Indicator catalog ─────────────────────────────────────
const INDICATORS: Array<{
  id: string;
  label: string;
  layer: IndicatorLayer;
}> = [
  { id: "rsi", label: "RSI(14)", layer: "signal" },
  { id: "bb_position_pct", label: "BB Position (0~1)", layer: "signal" },
  { id: "adx", label: "ADX(14)", layer: "signal" },
  { id: "macd_histogram", label: "MACD Histogram", layer: "signal" },
  { id: "atr", label: "ATR(14)", layer: "signal" },
  { id: "volume_ratio", label: "Volume Ratio", layer: "signal" },
  { id: "alignment_score", label: "Wave Alignment (-1~+1)", layer: "wave" },
  { id: "current_fib_position", label: "Fib Position", layer: "wave" },
  { id: "uptrend_strength", label: "Uptrend Strength", layer: "wave" },
  { id: "score", label: "Macro Score (-100~+100)", layer: "macro" },
  { id: "multiplier", label: "Macro Multiplier", layer: "macro" },
  { id: "c1_crisis", label: "C1 Crisis (0~1)", layer: "macro" },
  { id: "c2_riskOn", label: "C2 Risk-On (0~1)", layer: "macro" },
  {
    id: "c3_net_liquidity_30d_pct",
    label: "C3 Net Liquidity %",
    layer: "macro",
  },
  { id: "vix", label: "VIX", layer: "macro" },
];

const ENTRY_TYPES: Array<{ value: EntryConditionType; label: string }> = [
  { value: "less_than", label: "<" },
  { value: "greater_than", label: ">" },
  { value: "between", label: "between" },
  { value: "crosses_below", label: "crosses ↓" },
  { value: "crosses_above", label: "crosses ↑" },
  { value: "equals", label: "=" },
];

type ExitType = ExitCondition["type"];
const EXIT_TYPES: Array<{ value: ExitType; label: string }> = [
  { value: "fixed_return", label: "익절 (fixed %)" },
  { value: "fixed_loss", label: "손절 (fixed %)" },
  { value: "time_stop", label: "시간 손절 (캔들 수)" },
  { value: "indicator_threshold", label: "지표 임계 청산" },
];

const TF_OPTIONS = [
  { value: "4h", label: "4H" },
  { value: "1d", label: "1D" },
  { value: "1w", label: "1W" },
] as const;

// ── Form state ────────────────────────────────────────────
interface FormState {
  indicator: string;
  entryType: EntryConditionType;
  entryThreshold: string;
  entryThresholdHi: string; // for "between"
  exitType: ExitType;
  exitTargetPct: string;
  exitStopPct: string;
  exitMaxBars: string;
  symbol: string;
  tf: "4h" | "1d" | "1w";
  startDate: string;
  endDate: string;
}

const DEFAULT_FORM: FormState = {
  indicator: "rsi",
  entryType: "less_than",
  entryThreshold: "30",
  entryThresholdHi: "70",
  exitType: "fixed_return",
  exitTargetPct: "3",
  exitStopPct: "2",
  exitMaxBars: "30",
  symbol: "BTCUSDT",
  tf: "4h",
  startDate: new Date(Date.now() - 365 * 86400_000).toISOString().slice(0, 10),
  endDate: new Date().toISOString().slice(0, 10),
};

const EXAMPLE_FORM: FormState = {
  ...DEFAULT_FORM,
  indicator: "rsi",
  entryType: "less_than",
  entryThreshold: "30",
  exitType: "fixed_return",
  exitTargetPct: "3",
  exitMaxBars: "30",
};

// ── Helpers ───────────────────────────────────────────────
function formToConfig(form: FormState): SingleIndicatorConfig {
  const indicator = INDICATORS.find(i => i.id === form.indicator);
  const layer = (indicator?.layer ?? "signal") as IndicatorLayer;

  let entryThreshold: number | [number, number] | string;
  if (form.entryType === "between") {
    entryThreshold = [
      Number(form.entryThreshold),
      Number(form.entryThresholdHi),
    ];
  } else {
    entryThreshold = Number(form.entryThreshold);
  }

  let exit: ExitCondition;
  switch (form.exitType) {
    case "fixed_return":
      exit = {
        type: "fixed_return",
        params: {
          target_pct: Number(form.exitTargetPct) / 100,
          max_bars: Number(form.exitMaxBars),
        },
      };
      break;
    case "fixed_loss":
      exit = {
        type: "fixed_loss",
        params: {
          stop_pct: Number(form.exitStopPct) / 100,
          max_bars: Number(form.exitMaxBars),
        },
      };
      break;
    case "time_stop":
      exit = {
        type: "time_stop",
        params: { max_bars: Number(form.exitMaxBars) },
      };
      break;
    case "indicator_threshold":
    default:
      exit = {
        type: "indicator_threshold",
        params: { max_bars: Number(form.exitMaxBars) },
      };
      break;
  }

  return {
    indicator: form.indicator,
    layer,
    entry_condition: { type: form.entryType, threshold: entryThreshold },
    exit_condition: exit,
    symbol: form.symbol.toUpperCase(),
    tf: form.tf,
    start_ms: new Date(form.startDate).getTime(),
    end_ms: new Date(form.endDate).getTime(),
  };
}

function sufficiencyMeta(s: SampleSufficiency) {
  if (s === "sufficient")
    return {
      label: "표본 충분",
      bg: "bg-emerald-500/15 border-emerald-500/40",
      text: "text-neon-green",
    };
  if (s === "marginal")
    return {
      label: "표본 경계",
      bg: "bg-yellow-500/15 border-yellow-500/40",
      text: "text-neon-yellow",
    };
  return {
    label: "표본 부족 — 결과 무시 권장",
    bg: "bg-red-500/15 border-red-500/40",
    text: "text-red-400",
  };
}

// ── Sub-components ────────────────────────────────────────

function ResultMetrics({ r }: { r: SingleIndicatorResult }) {
  const suf = sufficiencyMeta(r.sample_sufficiency);
  return (
    <HudPanel
      title="결과 지표"
      subtitle="Wilson 95% CI · binomial p-value"
      variant="highlight"
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          <Metric label="시그널 수" value={r.total_signals.toString()} />
          <Metric
            label="승률"
            value={`${(r.win_rate * 100).toFixed(1)}%`}
            sub={`CI [${(r.ci[0] * 100).toFixed(1)}, ${(r.ci[1] * 100).toFixed(1)}]`}
            color={r.win_rate >= 0.5 ? "text-neon-green" : "text-red-400"}
          />
          <Metric
            label="평균 수익"
            value={`${r.avg_return_pct >= 0 ? "+" : ""}${r.avg_return_pct.toFixed(2)}%`}
            color={r.avg_return_pct >= 0 ? "text-neon-cyan" : "text-red-400"}
          />
          <Metric
            label="MDD"
            value={`${r.mdd_pct.toFixed(2)}%`}
            color="text-red-400"
          />
          <Metric
            label="Sharpe"
            value={r.sharpe.toFixed(2)}
            color={r.sharpe >= 0.5 ? "text-neon-green" : "text-neon-yellow"}
          />
          <Metric
            label="Profit Factor"
            value={profitFactor(r.trades).toFixed(2)}
          />
        </div>
        <div
          className={cn(
            "px-3 py-2 rounded-lg font-mono text-xs flex items-center gap-2",
            suf.bg,
            suf.text
          )}
        >
          {r.sample_sufficiency === "insufficient" ? (
            <AlertTriangle className="h-3.5 w-3.5" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5" />
          )}
          {suf.label} (n = {r.total_signals})
        </div>
      </div>
    </HudPanel>
  );
}

function profitFactor(trades: SingleIndicatorResult["trades"]): number {
  let gain = 0;
  let loss = 0;
  for (const t of trades) {
    if (t.return_pct >= 0) gain += t.return_pct;
    else loss += Math.abs(t.return_pct);
  }
  if (loss === 0) return gain > 0 ? Infinity : 0;
  return gain / loss;
}

function Metric({
  label,
  value,
  sub,
  color = "text-primary",
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="hud-frame p-3">
      <div className="font-mono text-[10px] text-muted-foreground tracking-wider mb-1">
        {label}
      </div>
      <div className={cn("font-display text-xl font-bold", color)}>{value}</div>
      {sub && (
        <div className="font-mono text-[9px] text-muted-foreground mt-1">
          {sub}
        </div>
      )}
    </div>
  );
}

function DistributionChart({ result }: { result: SingleIndicatorResult }) {
  const data = result.by_value_bucket.map(b => ({
    label: `${b.bucket[0].toFixed(1)}~${b.bucket[1].toFixed(1)}`,
    winRate: b.win_rate * 100,
    n: b.n,
    ciLo: b.ci[0] * 100,
    ciHi: b.ci[1] * 100,
    err: [(b.win_rate - b.ci[0]) * 100, (b.ci[1] - b.win_rate) * 100] as [
      number,
      number,
    ],
    sparse: b.n < 10,
  }));

  if (data.length === 0) {
    return (
      <HudPanel title="지표 값별 분포">
        <div className="py-6 text-center font-mono text-xs text-muted-foreground">
          아직 분포 데이터가 없습니다 (시그널 = {result.total_signals})
        </div>
      </HudPanel>
    );
  }

  return (
    <HudPanel
      title="지표 값별 분포"
      subtitle="bucket 별 승률 + Wilson 95% CI"
    >
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data}>
          <CartesianGrid stroke="rgba(0,0,0,0.06)" />
          <XAxis
            dataKey="label"
            tick={{
              fontSize: 10,
              fontFamily: "Fragment Mono",
              fill: "#7a7a7a",
            }}
            angle={-30}
            textAnchor="end"
            height={50}
          />
          <YAxis
            tick={{
              fontSize: 10,
              fontFamily: "Fragment Mono",
              fill: "#7a7a7a",
            }}
            label={{
              value: "승률 %",
              angle: -90,
              position: "insideLeft",
              style: {
                fill: "#7a7a7a",
                fontSize: 10,
                fontFamily: "Fragment Mono",
              },
            }}
            domain={[0, 100]}
          />
          <Tooltip
            contentStyle={{
              background: "#ffffff",
              border: "1px solid #ececec",
              borderRadius: "8px",
              fontFamily: "Fragment Mono",
              fontSize: "11px",
            }}
            formatter={(v: number, name: string, item: any) => {
              if (name === "winRate") {
                const p = item.payload;
                return [
                  `${v.toFixed(1)}% (n=${p.n}, CI [${p.ciLo.toFixed(1)}, ${p.ciHi.toFixed(1)}])`,
                  "승률",
                ];
              }
              return [v, name];
            }}
          />
          <Bar dataKey="winRate">
            {data.map((entry, idx) => (
              <Cell
                key={idx}
                fill={
                  entry.sparse
                    ? "oklch(0.5 0.02 260)"
                    : entry.winRate >= 50
                      ? "oklch(0.78 0.15 165)"
                      : "oklch(0.65 0.25 25)"
                }
              />
            ))}
            <ErrorBar dataKey="err" width={4} stroke="rgba(0,0,0,0.35)" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="font-mono text-[10px] text-muted-foreground mt-2">
        회색 bucket: n &lt; 10 (충분한 표본 X) · 초록: winRate ≥ 50% · 빨강:
        &lt; 50%
      </div>
    </HudPanel>
  );
}

function AlphaCard({ r }: { r: SingleIndicatorResult }) {
  const significant = r.alpha_significant;
  return (
    <HudPanel
      title="알파 유의성"
      subtitle="기준 vs 결과 · binomial p-value"
    >
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <Metric
            label="기준 승률"
            value={`${(r.baseline_winrate * 100).toFixed(1)}%`}
          />
          <Metric
            label="결과 승률"
            value={`${(r.win_rate * 100).toFixed(1)}%`}
            color={
              r.win_rate >= r.baseline_winrate
                ? "text-neon-green"
                : "text-red-400"
            }
          />
          <Metric
            label="p-value"
            value={r.p_value.toFixed(4)}
            color={significant ? "text-neon-green" : "text-muted-foreground"}
          />
        </div>
        <div
          className={cn(
            "px-3 py-2 rounded-lg font-mono text-xs flex items-center gap-2",
            significant
              ? "bg-emerald-500/15 text-neon-green"
              : "bg-muted text-muted-foreground"
          )}
        >
          {significant ? (
            <CheckCircle2 className="h-3.5 w-3.5" />
          ) : (
            <XCircle className="h-3.5 w-3.5" />
          )}
          {significant ? "유의미 (p < 0.05)" : "약함 (p ≥ 0.05)"}
        </div>
        <div className="font-mono text-[10px] text-muted-foreground leading-relaxed">
          이 p-value 는 BH FDR 다중 검정 보정 전 단순 binomial 양측 검정
          결과입니다. 여러 가설을 동시에 시험할 때는 FDR 보정 후 재평가가
          필요합니다.
        </div>
      </div>
    </HudPanel>
  );
}

// ── Main tab ──────────────────────────────────────────────

export default function EngineATab() {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const mutation = trpc.dualEngine.singleIndicator.useMutation();

  const result = useMemo<SingleIndicatorResult | null>(() => {
    if (!mutation.data) return null;
    if ("status" in mutation.data && mutation.data.status === "error")
      return null;
    return mutation.data as unknown as SingleIndicatorResult;
  }, [mutation.data]);

  const errorDetail =
    mutation.data &&
    "status" in mutation.data &&
    mutation.data.status === "error"
      ? mutation.data.detail
      : (mutation.error?.message ?? null);

  const handleRun = () => {
    const config = formToConfig(form);
    mutation.mutate({ config });
  };

  const setField = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  const selectedIndicator = INDICATORS.find(i => i.id === form.indicator);

  return (
    <div className="space-y-4">
      {/* Example scenario */}
      <HudPanel title="예시 시나리오" subtitle="가설 기반 백테스트">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="font-mono text-xs text-muted-foreground leading-relaxed flex-1 min-w-[260px]">
            BTC 4H 에서 RSI &lt; 30 매수, 3% 익절 / 30 캔들 시간 손절. 1년치
            데이터로 검증.
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setForm(EXAMPLE_FORM)}
            className="font-mono text-xs h-7"
          >
            예시 로드
          </Button>
        </div>
      </HudPanel>

      {/* Form */}
      <HudPanel
        title="Engine A — 단일 지표 설정"
        subtitle="단일 지표 + 단순 진입/청산 → 알파 측정"
      >
        <div className="space-y-4">
          {/* Indicator + Entry */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div>
              <Label>지표</Label>
              <Select
                value={form.indicator}
                onValueChange={v => setField("indicator", v)}
              >
                <SelectTrigger className="h-9 font-mono text-xs bg-muted">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {(["signal", "wave", "macro"] as IndicatorLayer[]).map(
                    layer => (
                      <div key={layer}>
                        <div className="px-2 py-1 font-mono text-[10px] text-muted-foreground">
                          {layer} layer
                        </div>
                        {INDICATORS.filter(i => i.layer === layer).map(i => (
                          <SelectItem
                            key={i.id}
                            value={i.id}
                            className="font-mono text-xs"
                          >
                            {i.label}
                          </SelectItem>
                        ))}
                      </div>
                    )
                  )}
                </SelectContent>
              </Select>
              {selectedIndicator && (
                <div className="font-mono text-[10px] text-muted-foreground mt-1">
                  layer: {selectedIndicator.layer}
                </div>
              )}
            </div>
            <div>
              <Label>진입 조건</Label>
              <div className="flex gap-2">
                <Select
                  value={form.entryType}
                  onValueChange={v =>
                    setField("entryType", v as EntryConditionType)
                  }
                >
                  <SelectTrigger className="h-9 w-[120px] font-mono text-xs bg-muted">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ENTRY_TYPES.map(t => (
                      <SelectItem
                        key={t.value}
                        value={t.value}
                        className="font-mono text-xs"
                      >
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  value={form.entryThreshold}
                  onChange={e => setField("entryThreshold", e.target.value)}
                  className="h-9 font-mono text-xs bg-muted"
                  placeholder="임계값"
                />
                {form.entryType === "between" && (
                  <Input
                    type="number"
                    value={form.entryThresholdHi}
                    onChange={e => setField("entryThresholdHi", e.target.value)}
                    className="h-9 font-mono text-xs bg-muted"
                    placeholder="상한"
                  />
                )}
              </div>
            </div>
            <div>
              <Label>심볼 / TF</Label>
              <div className="flex gap-2">
                <Input
                  value={form.symbol}
                  onChange={e => setField("symbol", e.target.value)}
                  className="h-9 font-mono text-xs bg-muted"
                  placeholder="BTCUSDT"
                />
                <Select
                  value={form.tf}
                  onValueChange={v => setField("tf", v as "4h" | "1d" | "1w")}
                >
                  <SelectTrigger className="h-9 w-[80px] font-mono text-xs bg-muted">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TF_OPTIONS.map(tf => (
                      <SelectItem
                        key={tf.value}
                        value={tf.value}
                        className="font-mono text-xs"
                      >
                        {tf.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Exit + Dates */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div>
              <Label>청산 유형</Label>
              <Select
                value={form.exitType}
                onValueChange={v => setField("exitType", v as ExitType)}
              >
                <SelectTrigger className="h-9 font-mono text-xs bg-muted">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXIT_TYPES.map(t => (
                    <SelectItem
                      key={t.value}
                      value={t.value}
                      className="font-mono text-xs"
                    >
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>청산 파라미터</Label>
              <div className="flex gap-2 items-center">
                {form.exitType === "fixed_return" && (
                  <>
                    <Input
                      type="number"
                      value={form.exitTargetPct}
                      onChange={e => setField("exitTargetPct", e.target.value)}
                      className="h-9 font-mono text-xs bg-muted"
                      placeholder="익절 %"
                    />
                    <span className="font-mono text-[10px] text-muted-foreground">
                      %
                    </span>
                  </>
                )}
                {form.exitType === "fixed_loss" && (
                  <>
                    <Input
                      type="number"
                      value={form.exitStopPct}
                      onChange={e => setField("exitStopPct", e.target.value)}
                      className="h-9 font-mono text-xs bg-muted"
                      placeholder="손절 %"
                    />
                    <span className="font-mono text-[10px] text-muted-foreground">
                      %
                    </span>
                  </>
                )}
                <Input
                  type="number"
                  value={form.exitMaxBars}
                  onChange={e => setField("exitMaxBars", e.target.value)}
                  className="h-9 font-mono text-xs bg-muted"
                  placeholder="최대 캔들"
                />
                <span className="font-mono text-[10px] text-muted-foreground">
                  캔들
                </span>
              </div>
            </div>
            <div>
              <Label>기간</Label>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={form.startDate}
                  onChange={e => setField("startDate", e.target.value)}
                  className="h-9 font-mono text-xs bg-muted"
                />
                <Input
                  type="date"
                  value={form.endDate}
                  onChange={e => setField("endDate", e.target.value)}
                  className="h-9 font-mono text-xs bg-muted"
                />
              </div>
            </div>
          </div>

          {/* Run button */}
          <div className="flex justify-end pt-2">
            <Button
              onClick={handleRun}
              disabled={mutation.isPending}
              className="h-9 font-mono text-xs"
            >
              {mutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5 mr-1.5" />
              )}
              백테스트 실행
            </Button>
          </div>
        </div>
      </HudPanel>

      {errorDetail && (
        <HudPanel title="오류" variant="danger">
          <div className="font-mono text-xs text-red-400">{errorDetail}</div>
        </HudPanel>
      )}

      {mutation.isPending && (
        <div className="py-12 flex flex-col items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <div className="font-mono text-xs text-muted-foreground">
            Engine A 실행 중 — 타임라인 빌드 + 시그널 재생 + bucketing...
          </div>
        </div>
      )}

      {result && (
        <>
          <ResultMetrics r={result} />
          <DistributionChart result={result} />
          <AlphaCard r={result} />
        </>
      )}
    </div>
  );
}

// ── tiny atoms ────────────────────────────────────────────
function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="font-mono text-[10px] text-muted-foreground tracking-wider block mb-1.5">
      {children}
    </label>
  );
}
