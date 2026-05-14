/**
 * Backtest equity curve — 재사용 가능한 Recharts AreaChart.
 *
 * Backtest 페이지 + CoinDetail/BacktestTab 에서 공통 사용.
 */

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface EquityChartTrade {
  signalTs: number;
  returnPct: number;
  win: boolean;
}

interface EquityChartProps {
  trades: EquityChartTrade[];
  height?: number;
}

export function EquityChart({ trades, height = 180 }: EquityChartProps) {
  const data = useMemo(() => {
    let equity = 100;
    return trades.map((t) => {
      equity *= 1 + t.returnPct / 100;
      return {
        name: new Date(t.signalTs).toLocaleDateString("ko-KR", {
          month: "short",
          day: "numeric",
        }),
        equity: Math.round(equity * 100) / 100,
      };
    });
  }, [trades]);

  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center"
        style={{ height: `${height}px` }}
      >
        <p className="font-sans text-xs text-muted-foreground">시그널 없음</p>
      </div>
    );
  }

  const minEquity = Math.min(...data.map((d) => d.equity), 95);
  const maxEquity = Math.max(...data.map((d) => d.equity), 105);
  const finalEquity = data[data.length - 1]?.equity ?? 100;
  const isPositive = finalEquity >= 100;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="5%"
              stopColor={isPositive ? "oklch(0.85 0.18 190)" : "oklch(0.65 0.22 25)"}
              stopOpacity={0.3}
            />
            <stop
              offset="95%"
              stopColor={isPositive ? "oklch(0.85 0.18 190)" : "oklch(0.65 0.22 25)"}
              stopOpacity={0}
            />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.03 260)" />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 9, fontFamily: "Share Tech Mono", fill: "oklch(0.5 0.02 260)" }}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[minEquity * 0.98, maxEquity * 1.02]}
          tick={{ fontSize: 9, fontFamily: "Share Tech Mono", fill: "oklch(0.5 0.02 260)" }}
          tickLine={false}
          tickFormatter={(v) => `${v.toFixed(0)}`}
          width={36}
        />
        <ReferenceLine
          y={100}
          stroke="oklch(0.4 0.02 260)"
          strokeDasharray="4 4"
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "oklch(0.14 0.015 260)",
            border: "1px solid oklch(0.25 0.03 260)",
            borderRadius: "4px",
            fontFamily: "Share Tech Mono",
            fontSize: "11px",
            color: "oklch(0.92 0.01 260)",
          }}
          formatter={(v: number) => [`${v.toFixed(2)}`, "Equity"]}
        />
        <Area
          type="monotone"
          dataKey="equity"
          stroke={isPositive ? "oklch(0.85 0.18 190)" : "oklch(0.65 0.22 25)"}
          strokeWidth={1.5}
          fill="url(#equityGrad)"
          dot={false}
          activeDot={{
            r: 3,
            fill: isPositive ? "oklch(0.85 0.18 190)" : "oklch(0.65 0.22 25)",
          }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
