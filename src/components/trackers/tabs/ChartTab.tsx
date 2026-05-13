/**
 * ChartTab — 차트 표준 레이아웃.
 *
 * 명세: TRACKER_TAB_STANDARD §2.3.
 *   - TF/타입 셀렉터
 *   - 메인 차트 슬롯 (트래커별로 다른 컴포넌트 주입)
 *   - Chart legend
 *   - 현재 시점 분석 텍스트
 *
 * 본 컴포넌트는 chart 자체는 모름 — children/slot 으로 위임.
 */

import type { ReactNode } from "react";
import { HudPanel } from "@/components/HudPanel";
import { cn } from "@/lib/utils";

export interface TimeframeOption {
  value: string;
  label: string;
}

export interface ChartTypeOption {
  value: string;
  label: string;
}

export interface LegendItem {
  /** 점 색 (Tailwind class 또는 oklch). */
  color: string;
  label: string;
}

export interface ChartTabProps {
  /** TF 선택 옵션. */
  timeframes?: TimeframeOption[];
  selectedTimeframe?: string;
  onTimeframeChange?: (tf: string) => void;
  /** 차트 타입 선택 옵션 (예: candle+vp, candle+trend). */
  chartTypes?: ChartTypeOption[];
  selectedChartType?: string;
  onChartTypeChange?: (type: string) => void;
  /** 메인 차트 슬롯 (트래커가 직접 주입). */
  chart: ReactNode;
  /** Chart legend 항목. */
  legend?: LegendItem[];
  /** 현재 시점 분석 텍스트 (한국어 한 줄씩). */
  analysis?: string[];
  /** 추가 안내 (Phase pending 등). */
  footer?: ReactNode;
}

function Selector<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T | undefined;
  onChange?: (v: T) => void;
  label: string;
}) {
  if (options.length === 0) return null;
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <div className="flex items-center gap-1 border border-border/40 rounded-sm bg-background/40 p-0.5">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange?.(opt.value)}
            className={cn(
              "px-2.5 py-1 font-mono text-xs uppercase tracking-wider transition-all rounded-sm",
              value === opt.value
                ? "bg-neon-pink/15 text-neon-pink"
                : "text-muted-foreground hover:text-neon-cyan"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ChartTab({
  timeframes,
  selectedTimeframe,
  onTimeframeChange,
  chartTypes,
  selectedChartType,
  onChartTypeChange,
  chart,
  legend,
  analysis,
  footer,
}: ChartTabProps) {
  return (
    <div className="space-y-4">
      {(timeframes || chartTypes) && (
        <div className="flex items-center gap-4 flex-wrap">
          {timeframes && (
            <Selector
              options={timeframes}
              value={selectedTimeframe}
              onChange={onTimeframeChange}
              label="TF"
            />
          )}
          {chartTypes && (
            <Selector
              options={chartTypes}
              value={selectedChartType}
              onChange={onChartTypeChange}
              label="Type"
            />
          )}
        </div>
      )}

      <HudPanel title="차트" subtitle="MAIN CHART">
        <div className="min-h-[300px]">{chart}</div>
      </HudPanel>

      {legend && legend.length > 0 && (
        <div className="flex items-center gap-4 flex-wrap px-2 py-2 border border-border/30 rounded-sm bg-background/30">
          {legend.map((item, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span
                className={cn("h-2.5 w-2.5 rounded-full shrink-0", item.color)}
                style={
                  item.color.startsWith("oklch") || item.color.startsWith("#")
                    ? { backgroundColor: item.color }
                    : undefined
                }
              />
              <span className="font-mono text-[11px] text-muted-foreground">
                {item.label}
              </span>
            </div>
          ))}
        </div>
      )}

      {analysis && analysis.length > 0 && (
        <HudPanel title="현재 시점 분석">
          <ul className="space-y-1.5">
            {analysis.map((line, i) => (
              <li key={i} className="font-mono text-sm text-foreground/90">
                · {line}
              </li>
            ))}
          </ul>
        </HudPanel>
      )}

      {footer}
    </div>
  );
}
