/**
 * ChartZone — 메인 캔들 + BB + indicators 차트.
 *
 * useCoinDetail 의 candles + bbSeries + rsiSeries + adxSeries 를 그대로 사용.
 * legacy CoinDetail 페이지의 차트 로직 그대로 (단순화).
 */

import { useMemo } from "react";
import { HudPanel } from "@/components/HudPanel";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useCoinDetail } from "@/hooks/useMarketData";
import type { TimeframeValue } from "@shared/types";
import { Loader2 } from "lucide-react";

interface ChartZoneProps {
  symbol: string;
  interval: TimeframeValue;
}

export function ChartZone({ symbol, interval }: ChartZoneProps) {
  const { data: detail, isLoading } = useCoinDetail(symbol, interval, 100);

  const chartData = useMemo(() => {
    if (!detail) return [];
    const { candles, bbSeries } = detail;
    const sliceStart = Math.max(0, candles.length - 60);
    return candles.slice(sliceStart).map((c, i) => {
      const globalIdx = sliceStart + i;
      const bb = bbSeries?.[globalIdx];
      return {
        time: new Date(c.openTime).toLocaleDateString("ko-KR", {
          month: "short",
          day: "numeric",
        }),
        close: c.close,
        bbUpper: bb?.upper ?? c.close,
        bbMiddle: bb?.middle ?? c.close,
        bbLower: bb?.lower ?? c.close,
      };
    });
  }, [detail]);

  if (isLoading || !detail) {
    return (
      <HudPanel title="Chart" subtitle={`${symbol} · ${interval}`}>
        <div className="h-[400px] flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-neon-pink" />
        </div>
      </HudPanel>
    );
  }

  const axisTick = {
    fontSize: 10,
    fill: "oklch(0.5 0.02 260)",
    fontFamily: "Share Tech Mono",
  };
  const tooltipStyle = {
    backgroundColor: "oklch(0.14 0.015 260)",
    border: "1px solid oklch(0.25 0.03 260)",
    borderRadius: "4px",
    fontFamily: "Share Tech Mono",
    fontSize: "11px",
    color: "oklch(0.92 0.01 260)",
  };

  const lastPrice = detail.candles[detail.candles.length - 1]?.close ?? 0;

  return (
    <HudPanel
      title="Chart"
      subtitle={`${symbol} · ${interval} · BBDX`}
      headerRight={
        <span className="font-display text-lg font-bold text-neon-cyan">
          ${lastPrice.toFixed(lastPrice < 1 ? 6 : 2)}
        </span>
      }
    >
      <div className="h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.03 260)" />
            <XAxis
              dataKey="time"
              tick={axisTick}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={["auto", "auto"]}
              tick={axisTick}
              tickLine={false}
              orientation="right"
            />
            <Tooltip contentStyle={tooltipStyle} />
            <ReferenceLine
              y={lastPrice}
              stroke="oklch(0.7 0.2 350)"
              strokeDasharray="2 2"
              strokeOpacity={0.4}
            />
            <Line
              type="monotone"
              dataKey="bbUpper"
              stroke="oklch(0.65 0.02 260)"
              strokeDasharray="5 5"
              dot={false}
              strokeWidth={1}
            />
            <Line
              type="monotone"
              dataKey="bbMiddle"
              stroke="oklch(0.65 0.02 260)"
              strokeDasharray="3 3"
              dot={false}
              strokeWidth={1}
            />
            <Line
              type="monotone"
              dataKey="bbLower"
              stroke="oklch(0.65 0.02 260)"
              strokeDasharray="5 5"
              dot={false}
              strokeWidth={1}
            />
            <Bar dataKey="close" fill="oklch(0.7 0.15 160)" opacity={0.3} />
            <Line
              type="monotone"
              dataKey="close"
              stroke="oklch(0.7 0.2 190)"
              dot={false}
              strokeWidth={2}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </HudPanel>
  );
}
