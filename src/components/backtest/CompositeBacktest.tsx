/**
 * Composite Backtest UI — Phase B-2 (2026-05-11).
 *
 * 사용자 요구 #2: "Signal + Macro + Wave 지표 조합 백테스팅".
 *
 * 3 Layer 별 condition builder + 백테스트 실행 + 결과 비교.
 * 기존 single-strategy 결과와 *별도* 표시 — 사용자가 두 결과를 side-by-side
 * 비교 가능.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { HudPanel } from "@/components/HudPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Loader2, Play, Plus, Trash2, Layers, TrendingUp, Globe, Waves } from "lucide-react";
import { MetricCards } from "@/components/backtest/MetricCards";
import { EquityChart } from "@/components/backtest/EquityChart";
import { TradeDetailCardList } from "@/components/backtest/TradeDetailCard";

// ─── Types (backend types 미러) ─────────────────────────────────

type LayerName = "signal" | "macro" | "wave";
type Operator = "lt" | "lte" | "gt" | "gte" | "eq" | "neq" | "in" | "between";

interface LayerCondition {
  layer: LayerName;
  indicator: string;
  operator: Operator;
  value: number | string | (number | string)[];
  range?: [number, number];
}

interface CompositeConfig {
  signalConditions: LayerCondition[];
  macroConditions: LayerCondition[];
  waveConditions: LayerCondition[];
  layerCombineMode: "all" | "any";
  riskReward: {
    tier1AtrMultiplier: number;
    tier2AtrMultiplier: number;
    stopAtrMultiplier: number;
  };
}

// ─── Defaults ───────────────────────────────────────────────────

const DEFAULT_CONFIG: CompositeConfig = {
  signalConditions: [
    { layer: "signal", indicator: "rsi", operator: "lt", value: 30 },
    { layer: "signal", indicator: "bbLowerProximity", operator: "lt", value: 0.2 },
    { layer: "signal", indicator: "adx", operator: "lt", value: 20 },
  ],
  macroConditions: [
    {
      layer: "macro",
      indicator: "macroRegime",
      operator: "in",
      value: ["easy", "flooded", "neutral"],
    },
  ],
  waveConditions: [
    {
      layer: "wave",
      indicator: "waveAlignment",
      operator: "in",
      value: ["perfect_up", "partial_up"],
    },
  ],
  layerCombineMode: "all",
  riskReward: {
    tier1AtrMultiplier: 1.5,
    tier2AtrMultiplier: 3.5,
    stopAtrMultiplier: 1.0,
  },
};

const LAYER_META: Record<
  LayerName,
  { label: string; description: string; color: string; icon: any }
> = {
  signal: {
    label: "Signal Layer",
    description: "BBDX core 지표 — RSI / BB / ADX / Pattern Confluence",
    color: "text-neon-cyan",
    icon: TrendingUp,
  },
  macro: {
    label: "Macro Layer",
    description: "Macro Liquidity — regime / score / Korea modifier",
    color: "text-neon-pink",
    icon: Globe,
  },
  wave: {
    label: "Wave Layer",
    description: "Multi-TF Trend + BTC 사이클 + Wave Alignment",
    color: "text-neon-green",
    icon: Waves,
  },
};

// ─── Symbol presets ────────────────────────────────────────────

const SYMBOL_PRESETS: Record<string, string> = {
  "Top 5": "BTCUSDT,ETHUSDT,SOLUSDT,XRPUSDT,AAVEUSDT",
  "Top 10": "BTCUSDT,ETHUSDT,SOLUSDT,XRPUSDT,AAVEUSDT,DOGEUSDT,SUIUSDT,AVAXUSDT,ADAUSDT,LINKUSDT",
  "BTC+ETH": "BTCUSDT,ETHUSDT",
};

// ─── Component ──────────────────────────────────────────────────

export function CompositeBacktest() {
  const [config, setConfig] = useState<CompositeConfig>(DEFAULT_CONFIG);
  const [symbolsText, setSymbolsText] = useState(SYMBOL_PRESETS["Top 5"]);
  const [tf, setTf] = useState<"1h" | "4h" | "6h" | "1d">("4h");
  const [startDate, setStartDate] = useState(
    new Date(Date.now() - 90 * 86400_000).toISOString().slice(0, 10),
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));

  // Layer catalog (indicator/operator dropdown 값 받기)
  const catalogQuery = trpc.backtest.compositeCatalog.useQuery(undefined, {
    staleTime: Infinity,
  });

  const runMutation = trpc.backtest.runComposite.useMutation();

  // Compare 모드 — 기존 BBDX single-strategy 도 같이 실행
  const compareMutation = trpc.backtest.run.useMutation();
  const [compareEnabled, setCompareEnabled] = useState(false);

  function handleRun() {
    const symbols = symbolsText
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);

    runMutation.mutate({
      symbols,
      tf,
      startDate,
      endDate,
      config,
    });

    if (compareEnabled) {
      compareMutation.mutate({
        symbols,
        tf,
        startDate,
        endDate,
        strategy: "bbdx",
        saveToDb: false,
      });
    }
  }

  function addCondition(layer: LayerName) {
    const key = `${layer}Conditions` as
      | "signalConditions"
      | "macroConditions"
      | "waveConditions";
    const newCondition: LayerCondition = {
      layer,
      indicator:
        layer === "signal" ? "rsi" : layer === "macro" ? "macroRegime" : "waveAlignment",
      operator: layer === "signal" ? "lt" : "eq",
      value: layer === "signal" ? 30 : layer === "macro" ? "neutral" : "perfect_up",
    };
    setConfig((c) => ({
      ...c,
      [key]: [...c[key], newCondition],
    }));
  }

  function removeCondition(layer: LayerName, idx: number) {
    const key = `${layer}Conditions` as
      | "signalConditions"
      | "macroConditions"
      | "waveConditions";
    setConfig((c) => ({
      ...c,
      [key]: c[key].filter((_, i) => i !== idx),
    }));
  }

  function updateCondition(
    layer: LayerName,
    idx: number,
    patch: Partial<LayerCondition>,
  ) {
    const key = `${layer}Conditions` as
      | "signalConditions"
      | "macroConditions"
      | "waveConditions";
    setConfig((c) => ({
      ...c,
      [key]: c[key].map((cond, i) =>
        i === idx ? { ...cond, ...patch } : cond,
      ),
    }));
  }

  const result = runMutation.data;
  const compareResult = compareMutation.data;
  const indicators = catalogQuery.data?.indicators ?? [];
  const operators = catalogQuery.data?.operators ?? [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <HudPanel
        title="Composite Backtest (3-Layer 조합)"
        subtitle="Signal Tracker + Macro Liquidity + Wave Tracker 지표 조합"
        headerRight={<Layers className="h-5 w-5 text-neon-cyan" />}
      >
        <p className="font-mono text-xs text-muted-foreground mb-3">
          각 Layer 의 condition 을 자유 조합. 모든 layer 의 조건이{" "}
          <span className="text-neon-cyan">AND 게이트</span>로 충족 시 진입.
          빈 Layer 는 자동 통과 (게이트 X).
        </p>

        {/* Symbols + Period */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
          <div className="lg:col-span-2">
            <label className="font-mono text-[10px] text-muted-foreground uppercase mb-1 block">
              Symbols (콤마 구분)
            </label>
            <Input
              value={symbolsText}
              onChange={(e) => setSymbolsText(e.target.value)}
              className="font-mono text-xs"
            />
            <div className="flex gap-1 mt-1 flex-wrap">
              {Object.entries(SYMBOL_PRESETS).map(([name, value]) => (
                <button
                  key={name}
                  onClick={() => setSymbolsText(value)}
                  className="px-2 py-0.5 text-[10px] font-mono rounded-sm border border-border/30 hover:border-neon-cyan/40 hover:text-neon-cyan transition-colors"
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="font-mono text-[10px] text-muted-foreground uppercase mb-1 block">
              TF
            </label>
            <select
              value={tf}
              onChange={(e) => setTf(e.target.value as any)}
              className="w-full font-mono text-xs px-2 py-1.5 rounded-sm border border-border/30 bg-background"
            >
              {["1h", "4h", "6h", "1d"].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="font-mono text-[10px] text-muted-foreground uppercase mb-1 block">
              Combine Mode
            </label>
            <select
              value={config.layerCombineMode}
              onChange={(e) =>
                setConfig((c) => ({
                  ...c,
                  layerCombineMode: e.target.value as "all" | "any",
                }))
              }
              className="w-full font-mono text-xs px-2 py-1.5 rounded-sm border border-border/30 bg-background"
            >
              <option value="all">ALL (모든 Layer AND)</option>
              <option value="any">ANY (1개 이상 통과)</option>
            </select>
          </div>
          <div>
            <label className="font-mono text-[10px] text-muted-foreground uppercase mb-1 block">
              시작일
            </label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="font-mono text-xs"
            />
          </div>
          <div>
            <label className="font-mono text-[10px] text-muted-foreground uppercase mb-1 block">
              종료일
            </label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="font-mono text-xs"
            />
          </div>
        </div>

        {/* Run buttons */}
        <div className="flex flex-wrap gap-2 items-center">
          <Button
            onClick={handleRun}
            disabled={runMutation.isPending || compareMutation.isPending}
            className="bg-neon-cyan text-background hover:bg-neon-cyan/80 font-mono text-xs"
          >
            {runMutation.isPending ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <Play className="h-3 w-3 mr-1" />
            )}
            COMPOSITE 백테스트 실행
          </Button>
          <label className="inline-flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={compareEnabled}
              onChange={(e) => setCompareEnabled(e.target.checked)}
              className="accent-neon-pink"
            />
            예전 BBDX 와 비교 (side-by-side)
          </label>
        </div>
      </HudPanel>

      {/* 3-Layer Condition Builders */}
      {(["signal", "macro", "wave"] as LayerName[]).map((layer) => {
        const meta = LAYER_META[layer];
        const Icon = meta.icon;
        const key = `${layer}Conditions` as const;
        const conditions = config[key];
        const layerIndicators = indicators.filter((i: any) => i.layer === layer);

        return (
          <HudPanel
            key={layer}
            title={meta.label}
            subtitle={meta.description}
            headerRight={<Icon className={cn("h-5 w-5", meta.color)} />}
          >
            {conditions.length === 0 ? (
              <p className="font-mono text-xs text-muted-foreground py-2">
                Layer 비활성 (자동 통과). 아래 + 버튼으로 condition 추가.
              </p>
            ) : (
              <div className="space-y-2">
                {conditions.map((cond, idx) => (
                  <ConditionRow
                    key={idx}
                    condition={cond}
                    indicators={layerIndicators}
                    operators={operators}
                    onUpdate={(patch) => updateCondition(layer, idx, patch)}
                    onRemove={() => removeCondition(layer, idx)}
                  />
                ))}
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => addCondition(layer)}
              className="mt-2 font-mono text-[11px] h-7"
            >
              <Plus className="h-3 w-3 mr-1" />
              Condition 추가
            </Button>
          </HudPanel>
        );
      })}

      {/* Results */}
      {result && (
        <>
          <HudPanel
            title="Composite 결과"
            subtitle={`${result.overall.totalTrades} trades · ${result.durationMs / 1000}s`}
          >
            <div className="flex items-center gap-2 flex-wrap mb-3">
              <Badge className="bg-neon-cyan/10 text-neon-cyan border-neon-cyan/30 font-mono text-[10px]">
                Signal pass {(result.layerStats.signalPassRate * 100).toFixed(1)}%
              </Badge>
              <Badge className="bg-neon-pink/10 text-neon-pink border-neon-pink/30 font-mono text-[10px]">
                Macro pass {(result.layerStats.macroPassRate * 100).toFixed(1)}%
              </Badge>
              <Badge className="bg-neon-green/10 text-neon-green border-neon-green/30 font-mono text-[10px]">
                Wave pass {(result.layerStats.wavePassRate * 100).toFixed(1)}%
              </Badge>
              <Badge className="bg-neon-yellow/10 text-neon-yellow border-neon-yellow/30 font-mono text-[10px]">
                ALL pass {(result.layerStats.allPassRate * 100).toFixed(1)}%
              </Badge>
            </div>
            <MetricCards overall={result.overall as any} variant="full" />
            <div className="mt-3">
              <EquityChart trades={result.trades as any} />
            </div>
          </HudPanel>

          {compareEnabled && compareResult && (
            <HudPanel
              title="기존 BBDX 비교 (Side-by-Side)"
              subtitle={`${compareResult.overall.totalTrades} trades · single-strategy baseline`}
            >
              <MetricCards overall={compareResult.overall as any} variant="full" />
              <div className="mt-3">
                <EquityChart trades={compareResult.trades as any} />
              </div>
            </HudPanel>
          )}

          {/* Per-Trade Details */}
          <HudPanel
            title="개별 매매 상세 (Composite)"
            subtitle="각 trade 의 진입 사유 (3-Layer 분해) + 가격 흐름 + 종료 사유"
          >
            <TradeDetailCardList trades={result.trades as any} limit={50} />
          </HudPanel>
        </>
      )}
    </div>
  );
}

// ─── Condition Row ──────────────────────────────────────────────

function ConditionRow({
  condition,
  indicators,
  operators,
  onUpdate,
  onRemove,
}: {
  condition: LayerCondition;
  indicators: any[];
  operators: any[];
  onUpdate: (patch: Partial<LayerCondition>) => void;
  onRemove: () => void;
}) {
  const indMeta = indicators.find((i) => i.name === condition.indicator);
  const isEnum = indMeta?.type === "enum";
  const applicableOps = operators.filter((o) =>
    o.applicableTo.includes(indMeta?.type ?? "number"),
  );

  return (
    <div className="flex flex-wrap items-center gap-2 p-2 rounded-sm border border-border/20 bg-background/30">
      {/* Indicator */}
      <select
        value={condition.indicator}
        onChange={(e) => {
          const newInd = indicators.find((i) => i.name === e.target.value);
          onUpdate({
            indicator: e.target.value,
            // Reset operator + value when indicator changes
            operator: newInd?.type === "enum" ? "eq" : "lt",
            value: newInd?.type === "enum" ? newInd.enumValues?.[0] ?? "" : 0,
          });
        }}
        className="font-mono text-xs px-2 py-1 rounded-sm border border-border/30 bg-background"
      >
        {indicators.map((i) => (
          <option key={i.name} value={i.name}>
            {i.label}
          </option>
        ))}
      </select>

      {/* Operator */}
      <select
        value={condition.operator}
        onChange={(e) => onUpdate({ operator: e.target.value as Operator })}
        className="font-mono text-xs px-2 py-1 rounded-sm border border-border/30 bg-background"
      >
        {applicableOps.map((o) => (
          <option key={o.name} value={o.name}>
            {o.label}
          </option>
        ))}
      </select>

      {/* Value */}
      {isEnum ? (
        condition.operator === "in" ? (
          <div className="flex gap-1 flex-wrap">
            {indMeta.enumValues?.map((v: string) => {
              const valueArr = Array.isArray(condition.value) ? condition.value : [];
              const selected = valueArr.includes(v);
              return (
                <button
                  key={v}
                  onClick={() => {
                    const next = selected
                      ? valueArr.filter((x) => x !== v)
                      : [...valueArr, v];
                    onUpdate({ value: next });
                  }}
                  className={cn(
                    "px-2 py-0.5 text-[10px] font-mono rounded-sm border",
                    selected
                      ? "border-neon-cyan/60 text-neon-cyan bg-neon-cyan/10"
                      : "border-border/30 text-muted-foreground hover:border-neon-cyan/40",
                  )}
                >
                  {v}
                </button>
              );
            })}
          </div>
        ) : (
          <select
            value={String(condition.value)}
            onChange={(e) => onUpdate({ value: e.target.value })}
            className="font-mono text-xs px-2 py-1 rounded-sm border border-border/30 bg-background"
          >
            {indMeta.enumValues?.map((v: string) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        )
      ) : (
        <Input
          type="number"
          value={typeof condition.value === "number" ? condition.value : 0}
          onChange={(e) => onUpdate({ value: parseFloat(e.target.value) || 0 })}
          className="font-mono text-xs w-24 h-7"
          step="any"
        />
      )}

      <Button
        size="sm"
        variant="ghost"
        onClick={onRemove}
        className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
