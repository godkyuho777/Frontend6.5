/**
 * Engine B — Multi-Strategy DSL backtest tab (Phase 1: template selector).
 *
 * DUAL_BACKTEST_ENGINE_PLAN §3.
 *
 * Phase 1: 5 templates + 헌장 매핑 검증 + 실행 (DSL editor 는 Phase 2 에서 추가).
 *
 * 헌장: 본 엔진은 multi-dimensional 조합 평가 도구 — Charter R3 위반 X.
 */

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronRight,
  FlaskConical,
  Loader2,
  Play,
  XCircle,
} from "lucide-react";

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
  StrategyExpression,
  MultiStrategyConfig,
} from "@shared/macro-types";

// ── 5 Templates ───────────────────────────────────────────
interface Template {
  id: string;
  label: string;
  description: string;
  expression: StrategyExpression;
  enabled: boolean;
}

const TEMPLATES: Template[] = [
  {
    id: "bbdx_v65_full",
    label: "BBDX v6.5 Full",
    description:
      "BB position (≤ 0.2) AND RSI (< 35) AND ADX (≥ 20) — 3-path 합집합 근사",
    enabled: true,
    expression: {
      type: "logic",
      operator: "AND",
      children: [
        {
          type: "condition",
          indicator: "bb_position_pct",
          operator: "lt",
          value: 0.2,
          layer: "signal",
        },
        {
          type: "condition",
          indicator: "rsi",
          operator: "lt",
          value: 35,
          layer: "signal",
        },
        {
          type: "condition",
          indicator: "adx",
          operator: "gt",
          value: 20,
          layer: "signal",
        },
      ],
    },
  },
  {
    id: "num_path_only",
    label: "NUM Path Only",
    description: "RSI < 30 AND MACD histogram > 0 — 모멘텀 turnaround 시그널",
    enabled: true,
    expression: {
      type: "logic",
      operator: "AND",
      children: [
        {
          type: "condition",
          indicator: "rsi",
          operator: "lt",
          value: 30,
          layer: "signal",
        },
        {
          type: "condition",
          indicator: "macd_histogram",
          operator: "gt",
          value: 0,
          layer: "signal",
        },
      ],
    },
  },
  {
    id: "wave_macro_gate",
    label: "Wave + Macro Gate",
    description:
      "Wave alignment > 0.5 AND Macro score > 0 AND BB pos < 0.3 — 다층 컨플루언스",
    enabled: true,
    expression: {
      type: "logic",
      operator: "AND",
      children: [
        {
          type: "condition",
          indicator: "alignment_score",
          operator: "gt",
          value: 0.5,
          layer: "wave",
        },
        {
          type: "condition",
          indicator: "score",
          operator: "gt",
          value: 0,
          layer: "macro",
        },
        {
          type: "condition",
          indicator: "bb_position_pct",
          operator: "lt",
          value: 0.3,
          layer: "signal",
        },
      ],
    },
  },
  {
    id: "macro_only",
    label: "Macro Only (R3 위반 — 측정용)",
    description:
      "C2 risk-on > 0.8 단독 — 헌장 R3 위반 시뮬레이션. 검증 실패할 것.",
    enabled: true,
    expression: {
      type: "condition",
      indicator: "c2_riskOn",
      operator: "gt",
      value: 0.8,
      layer: "macro",
    },
  },
  {
    id: "custom",
    label: "Custom (Advanced)",
    description: "DSL editor — Phase 2 후속 작업. 현재는 disabled.",
    enabled: false,
    expression: {
      type: "condition",
      indicator: "rsi",
      operator: "lt",
      value: 30,
      layer: "signal",
    },
  },
];

const TF_OPTIONS = [
  { value: "4h", label: "4H" },
  { value: "1d", label: "1D" },
  { value: "1w", label: "1W" },
] as const;

export default function EngineBTab() {
  const [selectedId, setSelectedId] = useState<string>(TEMPLATES[0]!.id);
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [tf, setTf] = useState<"4h" | "1d" | "1w">("4h");
  const [startDate, setStartDate] = useState(
    new Date(Date.now() - 365 * 86400_000).toISOString().slice(0, 10)
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));

  const selected = TEMPLATES.find(t => t.id === selectedId) ?? TEMPLATES[0]!;

  const validateQuery = trpc.dualEngine.validateStrategy.useQuery(
    { expression: selected.expression as unknown },
    { enabled: !!selected, staleTime: 60_000 }
  );

  const runMutation = trpc.dualEngine.multiStrategy.useMutation();

  const result = useMemo(() => {
    if (!runMutation.data) return null;
    if ("status" in runMutation.data && runMutation.data.status === "error")
      return null;
    return runMutation.data as any;
  }, [runMutation.data]);

  const errorDetail =
    runMutation.data &&
    "status" in runMutation.data &&
    runMutation.data.status === "error"
      ? runMutation.data.detail
      : (runMutation.error?.message ?? null);

  const handleRun = () => {
    const config: MultiStrategyConfig = {
      expression: selected.expression,
      exit_condition: {
        type: "fixed_return",
        params: { target_pct: 0.03, stop_pct: 0.02, max_bars: 30 },
      },
      symbol: symbol.toUpperCase(),
      tf,
      start_ms: new Date(startDate).getTime(),
      end_ms: new Date(endDate).getTime(),
    };
    runMutation.mutate({ config });
  };

  const validation = validateQuery.data;

  return (
    <div className="space-y-4">
      <HudPanel
        title="Engine B — Multi-Strategy Templates"
        subtitle="Phase 1 stub · DSL editor deferred to Phase 2"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {TEMPLATES.map(t => {
            const active = t.id === selectedId;
            return (
              <button
                key={t.id}
                disabled={!t.enabled}
                onClick={() => setSelectedId(t.id)}
                className={cn(
                  "text-left p-3 rounded-lg transition-all bg-muted/50 hover:bg-muted",
                  !t.enabled && "opacity-40 cursor-not-allowed",
                  active && t.enabled
                    ? "bg-foreground text-background"
                    : "text-muted-foreground"
                )}
              >
                <div className="font-display text-xs font-bold tracking-wider mb-1">
                  {t.label}
                </div>
                <div className="font-mono text-[10px] text-muted-foreground/80 leading-tight">
                  {t.description}
                </div>
                {!t.enabled && (
                  <div className="font-mono text-[9px] text-neon-yellow mt-1">
                    Phase 2 추가 예정
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </HudPanel>

      {validation && (
        <HudPanel
          title="Charter Validation"
          subtitle="R3 매핑 검증 (백테스트 실행 전)"
          variant={validation.passed ? "highlight" : "danger"}
        >
          <div className="space-y-2">
            <div
              className={cn(
                "flex items-center gap-2 font-mono text-xs",
                validation.passed ? "text-neon-green" : "text-red-400"
              )}
            >
              {validation.passed ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              {validation.passed ? "헌장 매핑 통과" : "헌장 매핑 실패"}
            </div>
            <div className="font-mono text-[10px]">
              <span className="text-muted-foreground">Covered: </span>
              {validation.covered.length === 0 ? (
                <span className="text-muted-foreground">none</span>
              ) : (
                validation.covered.map((d: string) => (
                  <Badge
                    key={d}
                    className="mr-1 bg-emerald-500/15 text-neon-green border-emerald-500/40"
                  >
                    {d}
                  </Badge>
                ))
              )}
            </div>
            {validation.missing.length > 0 && (
              <div className="font-mono text-[10px]">
                <span className="text-muted-foreground">Missing: </span>
                {validation.missing.map((d: string) => (
                  <Badge
                    key={d}
                    className="mr-1 bg-red-500/15 text-red-400 border-red-500/40"
                  >
                    {d}
                  </Badge>
                ))}
              </div>
            )}
            {validation.warnings.length > 0 && (
              <ul className="font-mono text-[10px] text-neon-yellow space-y-0.5">
                {validation.warnings.map((w: string, i: number) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            )}
          </div>
        </HudPanel>
      )}

      <HudPanel title="Run Config" subtitle="symbol · tf · date range">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <Label>Symbol</Label>
            <Input
              value={symbol}
              onChange={e => setSymbol(e.target.value)}
              className="h-9 font-mono text-xs"
            />
          </div>
          <div>
            <Label>Timeframe</Label>
            <Select
              value={tf}
              onValueChange={v => setTf(v as "4h" | "1d" | "1w")}
            >
              <SelectTrigger className="h-9 font-mono text-xs bg-muted">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TF_OPTIONS.map(t => (
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
            <Label>Start Date</Label>
            <Input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="h-9 font-mono text-xs bg-muted"
            />
          </div>
          <div>
            <Label>End Date</Label>
            <Input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="h-9 font-mono text-xs bg-muted"
            />
          </div>
        </div>
        <div className="flex justify-end pt-3">
          <Button
            onClick={handleRun}
            disabled={runMutation.isPending}
            className="h-9 font-mono text-xs"
          >
            {runMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5 mr-1.5" />
            )}
            Engine B 실행
          </Button>
        </div>
      </HudPanel>

      {errorDetail && (
        <HudPanel title="Error" variant="danger">
          <div className="font-mono text-xs text-red-400">{errorDetail}</div>
        </HudPanel>
      )}

      {runMutation.isPending && (
        <div className="py-12 flex flex-col items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <div className="font-mono text-xs text-muted-foreground">
            Engine B 실행 중 — DSL 평가 + cross-layer bucketing...
          </div>
        </div>
      )}

      {result && (
        <HudPanel title="Result Summary" variant="highlight">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Metric label="Signals" value={result.total_signals.toString()} />
            <Metric
              label="Win Rate"
              value={`${(result.win_rate * 100).toFixed(1)}%`}
              color={
                result.win_rate >= 0.5 ? "text-neon-green" : "text-red-400"
              }
            />
            <Metric label="Sharpe" value={result.sharpe.toFixed(2)} />
            <Metric
              label="MDD"
              value={`${result.mdd_pct.toFixed(2)}%`}
              color="text-red-400"
            />
          </div>
          {result.charter_validation && !result.charter_validation.passed && (
            <div className="mt-3 px-3 py-2 rounded-lg bg-red-500/15 font-mono text-xs text-red-400">
              헌장 매핑 실패 — Missing dimensions:{" "}
              {result.charter_validation.missing.join(", ")}
            </div>
          )}
          <div className="mt-3 font-mono text-[10px] text-muted-foreground">
            상세 cross-layer / by_layer bucket 시각화는 Phase 2 에서 추가 (DSL
            editor 와 함께).
          </div>
        </HudPanel>
      )}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="font-mono text-[10px] text-muted-foreground tracking-wider block mb-1.5">
      {children}
    </label>
  );
}

function Metric({
  label,
  value,
  color = "text-primary",
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="hud-frame p-3">
      <div className="font-mono text-[10px] text-muted-foreground tracking-wider mb-1">
        {label}
      </div>
      <div className={cn("font-display text-xl font-bold", color)}>{value}</div>
    </div>
  );
}
