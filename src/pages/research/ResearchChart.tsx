/**
 * 리서치 차트 — Recharts 기반 데이터 시각화 (2026-06-14).
 *
 * ResearchArticle 의 "주요 데이터" 섹션에서 slug 별 ResearchChartSpec 을 렌더.
 * 라이트 테마 토큰에 맞춘 hairline 스타일, as-of·출처 캡션 기관 컨벤션 준수.
 * 헌장: 시각화/교육용. 단독 매매 시그널 아님.
 */

import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";
import type { ResearchChartSpec } from "@/lib/research-charts";

const UP = "#55ac57";
const DOWN = "#d33c3c";
const PRIMARY = "#185adb";
const GRID = "#ececec";
const AXIS = "#8a8a8a";

function fmtNum(v: number, format?: ResearchChartSpec["format"]): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  switch (format) {
    case "usd-b":
      return `$${v.toLocaleString(undefined, { maximumFractionDigits: 1 })}B`;
    case "usd": {
      const a = Math.abs(v);
      if (a >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
      if (a >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
      if (a >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
      return `$${v.toFixed(0)}`;
    }
    case "pct":
      return `${v > 0 ? "+" : ""}${v.toFixed(0)}%`;
    case "ratio":
      return `${v.toFixed(1)}×`;
    default:
      return v.toLocaleString();
  }
}

function ChartTooltip({
  active,
  payload,
  label,
  format,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
  label?: string | number;
  format?: ResearchChartSpec["format"];
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-md">
      <div className="mb-1 font-medium text-foreground">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-1.5 text-muted-foreground">
          <span
            aria-hidden
            className="size-2 rounded-full"
            style={{ backgroundColor: p.color }}
          />
          <span>{p.name}</span>
          <span className="ml-auto font-mono font-medium text-foreground">
            {fmtNum(p.value ?? 0, format)}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function ResearchChart({ spec }: { spec: ResearchChartSpec }) {
  const tickFmt = (v: number) => fmtNum(v, spec.format);
  const s0 = spec.series[0];

  const axisProps = {
    stroke: AXIS,
    tick: { fill: AXIS, fontSize: 11 },
    tickLine: false,
  } as const;

  return (
    <figure className="rounded-xl border border-border bg-card p-4">
      <figcaption className="mb-3 text-sm font-bold tracking-tight text-foreground">
        {spec.title}
      </figcaption>
      <div className="h-[240px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          {spec.type === "bar" ? (
            <BarChart
              data={spec.data}
              margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
              <XAxis dataKey={spec.xKey} {...axisProps} />
              <YAxis tickFormatter={tickFmt} width={52} {...axisProps} />
              <Tooltip
                cursor={{ fill: "rgba(0,0,0,0.04)" }}
                content={<ChartTooltip format={spec.format} />}
              />
              <Bar dataKey={s0.key} name={s0.label} radius={[3, 3, 0, 0]}>
                {spec.data.map((d, i) => {
                  const v = Number(d[s0.key]);
                  const fill = spec.colorBySign
                    ? v >= 0
                      ? UP
                      : DOWN
                    : (s0.color ?? PRIMARY);
                  return <Cell key={i} fill={fill} />;
                })}
              </Bar>
            </BarChart>
          ) : spec.type === "area" ? (
            <AreaChart
              data={spec.data}
              margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
            >
              <defs>
                {spec.series.map((s) => (
                  <linearGradient
                    key={s.key}
                    id={`grad-${s.key}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor={s.color ?? PRIMARY}
                      stopOpacity={0.25}
                    />
                    <stop
                      offset="100%"
                      stopColor={s.color ?? PRIMARY}
                      stopOpacity={0.02}
                    />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
              <XAxis dataKey={spec.xKey} {...axisProps} />
              <YAxis tickFormatter={tickFmt} width={52} {...axisProps} />
              <Tooltip content={<ChartTooltip format={spec.format} />} />
              {spec.series.map((s) => (
                <Area
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={s.color ?? PRIMARY}
                  strokeWidth={2}
                  fill={`url(#grad-${s.key})`}
                  dot={false}
                />
              ))}
            </AreaChart>
          ) : (
            <LineChart
              data={spec.data}
              margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
              <XAxis dataKey={spec.xKey} {...axisProps} />
              <YAxis tickFormatter={tickFmt} width={52} {...axisProps} />
              <Tooltip content={<ChartTooltip format={spec.format} />} />
              {spec.series.map((s) => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={s.color ?? PRIMARY}
                  strokeWidth={2}
                  dot={{ r: 2.5 }}
                  activeDot={{ r: 4 }}
                />
              ))}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
      {spec.note && (
        <p className="mt-2 text-xs italic leading-relaxed text-muted-foreground">
          {spec.note}
        </p>
      )}
      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
        {spec.asOf} · {spec.source}
      </p>
    </figure>
  );
}
