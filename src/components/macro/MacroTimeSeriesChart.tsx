import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { HudPanel } from "@/components/HudPanel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  MacroPeriod,
  MacroSeriesData,
} from "@/hooks/useMacroIndicator";

interface MacroTimeSeriesChartProps {
  series: MacroSeriesData[];
  period: MacroPeriod;
  onPeriodChange: (p: MacroPeriod) => void;
  /** 0 라인 표시 (spread 류). */
  showZeroLine?: boolean;
  /** 차트 영역 높이 (px). default 300. */
  height?: number;
  /** loading flag (페이지 hook). */
  isLoading?: boolean;
}

const PERIOD_OPTIONS: { value: MacroPeriod; label: string }[] = [
  { value: "30d", label: "30D" },
  { value: "90d", label: "90D" },
  { value: "1y", label: "1Y" },
  { value: "5y", label: "5Y" },
];

export function MacroTimeSeriesChart({
  series,
  period,
  onPeriodChange,
  showZeroLine,
  height = 300,
  isLoading,
}: MacroTimeSeriesChartProps) {
  // 사용자가 토글한 표시 시리즈 (default: 모두 ON)
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  // 합쳐진 데이터 셋 (date 기준 outer join)
  const merged = useMemo(() => {
    const dateMap = new Map<string, Record<string, number | string>>();
    series.forEach(s => {
      if (hidden.has(s.id)) return;
      s.points.forEach(p => {
        const row = dateMap.get(p.date) ?? { date: p.date };
        row[s.id] = p.value;
        dateMap.set(p.date, row);
      });
    });
    return Array.from(dateMap.values()).sort((a, b) =>
      (a.date as string).localeCompare(b.date as string),
    );
  }, [series, hidden]);

  const hasData = merged.length > 0;
  const allStub = series.every(s => s.status === "stub");
  const anyError = series.some(s => s.status === "error");

  function toggle(id: string) {
    setHidden(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <HudPanel
      title="Time Series"
      subtitle={`FRED ${period.toUpperCase()} · ${series.length}개 시리즈`}
      headerRight={
        <Select value={period} onValueChange={v => onPeriodChange(v as MacroPeriod)}>
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
      }
    >
      {/* 시리즈 토글 row */}
      <div className="flex flex-wrap gap-2 mb-3">
        {series.map(s => {
          const isOn = !hidden.has(s.id);
          return (
            <Button
              key={s.id}
              size="sm"
              variant="outline"
              onClick={() => toggle(s.id)}
              className={cn(
                "h-7 px-2 font-mono text-[10px] gap-1.5",
                isOn ? "border-foreground/30" : "opacity-50",
              )}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: s.color ?? "oklch(0.78 0.15 165)" }}
              />
              {s.label}
              {s.unit && (
                <span className="text-muted-foreground">({s.unit})</span>
              )}
            </Button>
          );
        })}
      </div>

      {isLoading ? (
        <div
          className="flex items-center justify-center"
          style={{ height }}
        >
          <Loader2 className="h-5 w-5 animate-spin text-neon-cyan" />
        </div>
      ) : anyError ? (
        <div
          className="flex items-center justify-center font-mono text-xs text-red-400"
          style={{ height }}
        >
          FRED fetch 에러 — 시계열 표시 불가
        </div>
      ) : allStub || !hasData ? (
        <div
          className="flex flex-col items-center justify-center gap-2"
          style={{ height }}
        >
          <div className="font-mono text-xs text-muted-foreground">
            시계열 데이터 없음
          </div>
          <div className="font-mono text-[10px] text-orange-300/80">
            FRED_API_KEY 등록 후 자동 표시됩니다
          </div>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={merged}>
            <defs>
              {series.map(s => (
                <linearGradient
                  key={s.id}
                  id={`gradient-${s.id}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor={s.color ?? "oklch(0.78 0.15 165)"}
                    stopOpacity={0.4}
                  />
                  <stop
                    offset="100%"
                    stopColor={s.color ?? "oklch(0.78 0.15 165)"}
                    stopOpacity={0}
                  />
                </linearGradient>
              ))}
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
            <Legend
              wrapperStyle={{
                fontFamily: "Fragment Mono",
                fontSize: "10px",
              }}
            />
            {showZeroLine && (
              <ReferenceLine
                y={0}
                stroke="rgba(0,0,0,0.3)"
                strokeDasharray="3 3"
              />
            )}
            {series.map(s =>
              hidden.has(s.id) ? null : (
                <Line
                  key={s.id}
                  type="monotone"
                  name={s.label}
                  dataKey={s.id}
                  stroke={s.color ?? "oklch(0.78 0.15 165)"}
                  strokeWidth={s.derived ? 2 : 1.5}
                  dot={false}
                  connectNulls
                  strokeDasharray={s.derived ? undefined : "0"}
                />
              ),
            )}
          </LineChart>
        </ResponsiveContainer>
      )}

      {allStub && (
        <div className="mt-3 rounded-md border border-orange-500/30 bg-orange-500/5 p-2">
          <div className="font-mono text-[10px] text-orange-300/90 leading-relaxed">
            FRED_API_KEY 가 설정되지 않아 모든 시리즈가 stub 입니다. Railway env
            에 키를 등록하면 자동으로 실데이터가 표시됩니다 ({" "}
            <a
              href="https://fred.stlouisfed.org/docs/api/api_key.html"
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-orange-200"
            >
              무료 키 발급
            </a>{" "}
            ).
          </div>
        </div>
      )}
    </HudPanel>
  );
}
