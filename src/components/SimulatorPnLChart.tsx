/**
 * SimulatorPnLChart — 시뮬레이터 누적 PnL 시계열 차트 (2026-05-25).
 *
 * 사용자의 closed positions 를 day / week / month 단위로 버킷팅해
 * Recharts ComposedChart 로 시각화. 막대(bar)는 기간 PnL, 라인(line)은 누적.
 *
 * 데이터 소스: useLocalPositionsSync(userId, "closed").  localStorage 단독.
 *   - 백엔드 모드여도 positions prop 만 받으면 그대로 작동 (pure presentation).
 *
 * 디자인 시스템 준수:
 *   - HudPanel + Tabs (shadcn) + Recharts (oklch theme tokens).
 *   - neon-cyan = 누적 라인, neon-green / neon-red = bar 부호.
 *   - font-mono / font-display 사용 (oklch 폰트 토큰).
 *
 * 호출 패턴:
 *   <SimulatorPnLChart positions={closedPositions} />
 *
 * 거래가 없으면 안내 카드만 렌더 — 빈 차트로 인한 시각적 노이즈 제거.
 */

import { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Cell,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TrendingUp, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  aggregatePnLByGranularity,
  summarizePnLSeries,
  type PnLGranularity,
  type PnLDataPoint,
} from "@/lib/sim-pnl";

// ─── 색상 토큰 (Recharts 인라인용 oklch) ──────────────────────────
//
// Tailwind class 가 차트 SVG 에 직접 적용되지 않는 Recharts 의 한계상
// 차트 fill/stroke 만 raw oklch 토큰을 사용. 텍스트 / 컨테이너는 Tailwind.
const COLOR_CYAN = "oklch(0.85 0.18 190)"; // neon-cyan equivalent (누적 라인)
const COLOR_GREEN = "oklch(0.78 0.18 145)"; // neon-green (양수 PnL 막대)
const COLOR_RED = "oklch(0.65 0.22 25)"; // neon-red (음수 PnL 막대)
const COLOR_GRID = "oklch(0.25 0.03 260)";
const COLOR_AXIS = "oklch(0.5 0.02 260)";
const COLOR_TOOLTIP_BG = "oklch(0.14 0.015 260)";
const COLOR_TOOLTIP_BORDER = "oklch(0.25 0.03 260)";
const COLOR_TOOLTIP_TEXT = "oklch(0.92 0.01 260)";

interface SimulatorPnLChartProps {
  positions: Array<{
    closedPnl: number | null;
    closedAt: string | Date | null;
  }>;
  height?: number;
  className?: string;
}

function formatUSDCompact(v: number): string {
  const abs = Math.abs(v);
  const sign = v >= 0 ? "+" : "−"; // 부호: + / 마이너스 기호
  if (abs >= 1_000_000) {
    return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  }
  if (abs >= 1_000) {
    return `${sign}$${(abs / 1_000).toFixed(1)}k`;
  }
  return `${sign}$${abs.toFixed(2)}`;
}

function formatUSD(v: number): string {
  const sign = v >= 0 ? "+" : "";
  return `${sign}$${v.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Recharts tooltip — 한 데이터포인트의 모든 정보를 한 카드에 표시.
 */
interface TooltipPayloadItem {
  payload?: PnLDataPoint;
}
function PnLTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0]?.payload as PnLDataPoint | undefined;
  if (!d) return null;
  return (
    <div
      className="rounded-md border px-3 py-2 font-mono text-[11px]"
      style={{
        backgroundColor: COLOR_TOOLTIP_BG,
        borderColor: COLOR_TOOLTIP_BORDER,
        color: COLOR_TOOLTIP_TEXT,
      }}
    >
      <div className="mb-1 font-bold tracking-wider">{d.bucket}</div>
      <div className="grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5">
        <span className="text-muted-foreground">Period PnL</span>
        <span className={cn(d.pnl >= 0 ? "text-neon-green" : "text-neon-red")}>
          {formatUSD(d.pnl)}
        </span>
        <span className="text-muted-foreground">Cumulative</span>
        <span
          className={cn(
            d.cumulativePnl >= 0 ? "text-neon-green" : "text-neon-red",
          )}
        >
          {formatUSD(d.cumulativePnl)}
        </span>
        <span className="text-muted-foreground">Trades</span>
        <span>{d.tradeCount}</span>
      </div>
    </div>
  );
}

const GRANULARITY_LABEL: Record<PnLGranularity, string> = {
  day: "일별",
  week: "주별",
  month: "월별",
};

export function SimulatorPnLChart({
  positions,
  height = 280,
  className,
}: SimulatorPnLChartProps) {
  const [granularity, setGranularity] = useState<PnLGranularity>("day");

  const data = useMemo(
    () => aggregatePnLByGranularity(positions, granularity),
    [positions, granularity],
  );

  const summary = useMemo(() => summarizePnLSeries(data), [data]);

  // 거래 없음 → 안내 카드만 (HudPanel 빈 차트는 시각적으로 어색)
  if (data.length === 0) {
    return (
      <div
        className={cn(
          "rounded-md border border-neon-cyan/30 bg-card/40 px-3 py-2 flex flex-col gap-1.5",
          className,
        )}
      >
        <div className="flex items-center gap-2 text-[10px] font-mono">
          <TrendingUp className="h-3.5 w-3.5 text-neon-cyan" />
          <span className="font-display font-bold text-foreground uppercase tracking-wide">
            누적 PnL 추세
          </span>
        </div>
        <p className="font-sans text-xs text-muted-foreground">
          거래 데이터 없음 — 첫 거래 종료 후 차트가 표시됩니다.
        </p>
      </div>
    );
  }

  // Y 축 도메인 — 누적/기간 양쪽 다 보이도록 min/max 확장
  const allValues = data.flatMap((d) => [d.pnl, d.cumulativePnl]);
  const minVal = Math.min(0, ...allValues);
  const maxVal = Math.max(0, ...allValues);
  const padding = Math.max(Math.abs(maxVal - minVal) * 0.1, 1);
  const yDomain: [number, number] = [minVal - padding, maxVal + padding];

  return (
    <div
      className={cn(
        "rounded-md border border-neon-cyan/30 bg-card/40 p-3 flex flex-col gap-2",
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap text-[10px] font-mono">
        <BarChart3 className="h-3.5 w-3.5 text-neon-cyan" />
        <span className="font-display font-bold text-foreground uppercase tracking-wide text-[11px]">
          누적 PnL 추세
        </span>
        <span className="text-muted-foreground">
          · {summary.totalTrades} closed trade{summary.totalTrades === 1 ? "" : "s"}
        </span>
        <span
          className={cn(
            "ml-auto font-bold",
            summary.totalPnl >= 0 ? "text-neon-green" : "text-neon-red",
          )}
        >
          Total {formatUSD(summary.totalPnl)}
        </span>
      </div>

      {/* Granularity tabs */}
      <Tabs
        value={granularity}
        onValueChange={(v) => setGranularity(v as PnLGranularity)}
      >
        <TabsList className="h-7">
          <TabsTrigger value="day" className="text-[10px]">
            일별
          </TabsTrigger>
          <TabsTrigger value="week" className="text-[10px]">
            주별
          </TabsTrigger>
          <TabsTrigger value="month" className="text-[10px]">
            월별
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Chart */}
      <div style={{ height: `${height}px` }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="simPnlCumulative" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLOR_CYAN} stopOpacity={0.5} />
                <stop offset="95%" stopColor={COLOR_CYAN} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={COLOR_GRID} />
            <XAxis
              dataKey="label"
              tick={{
                fontSize: 10,
                fontFamily: "Fragment Mono, monospace",
                fill: COLOR_AXIS,
              }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={yDomain}
              tick={{
                fontSize: 10,
                fontFamily: "Fragment Mono, monospace",
                fill: COLOR_AXIS,
              }}
              tickLine={false}
              tickFormatter={(v: number) => formatUSDCompact(v)}
              width={56}
            />
            <ReferenceLine
              y={0}
              stroke={COLOR_AXIS}
              strokeDasharray="2 2"
              strokeOpacity={0.5}
            />
            <Tooltip
              content={<PnLTooltip />}
              cursor={{ fill: "oklch(0.2 0.02 260 / 0.3)" }}
            />
            {/* 기간 PnL — 양수=녹, 음수=적 (각 cell 개별 색상) */}
            <Bar
              dataKey="pnl"
              name="Period PnL"
              isAnimationActive={false}
              radius={[2, 2, 0, 0]}
            >
              {data.map((d, idx) => (
                <Cell
                  key={`cell-${idx}`}
                  fill={d.pnl >= 0 ? COLOR_GREEN : COLOR_RED}
                />
              ))}
            </Bar>
            {/* 누적 PnL — 라인 (neon-cyan) */}
            <Line
              type="monotone"
              dataKey="cumulativePnl"
              name="Cumulative"
              stroke={COLOR_CYAN}
              strokeWidth={1.75}
              dot={false}
              activeDot={{ r: 3, fill: COLOR_CYAN }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1 pt-1 border-t border-border/30 text-[10px] font-mono">
        <SummaryKV label="Total" value={formatUSD(summary.totalPnl)} positive={summary.totalPnl >= 0} />
        <SummaryKV
          label={`Best ${GRANULARITY_LABEL[granularity]}`}
          value={
            summary.bestPeriod
              ? `${formatUSD(summary.bestPeriod.pnl)} (${summary.bestPeriod.label})`
              : "—"
          }
          positive
        />
        <SummaryKV
          label={`Worst ${GRANULARITY_LABEL[granularity]}`}
          value={
            summary.worstPeriod
              ? `${formatUSD(summary.worstPeriod.pnl)} (${summary.worstPeriod.label})`
              : "—"
          }
          positive={false}
        />
        <SummaryKV
          label={`Avg / ${GRANULARITY_LABEL[granularity]}`}
          value={formatUSD(summary.avgPnl)}
          positive={summary.avgPnl >= 0}
        />
      </div>
    </div>
  );
}

function SummaryKV({
  label,
  value,
  positive,
}: {
  label: string;
  value: string;
  positive: boolean;
}) {
  return (
    <div className="flex flex-col">
      <span className="text-muted-foreground uppercase tracking-wide text-[9px]">
        {label}
      </span>
      <span className={cn(positive ? "text-neon-green" : "text-neon-red")}>
        {value}
      </span>
    </div>
  );
}
