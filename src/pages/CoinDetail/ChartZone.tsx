/**
 * ChartZone — 메인 캔들 + BB + RSI subchart + ADX/DI subchart.
 *
 * useCoinDetail 의 candles + bbSeries + rsiSeries + adxSeries 모두 활용.
 * legacy CoinDetail.tsx 의 3 패널 구조 복원 (post-merge regression fix):
 *   1) 메인: 캔들 + BB Upper/Middle/Lower + close 라인
 *   2) RSI(14) subchart: 30/35/70 reference lines
 *   3) ADX/DI subchart: ADX + +DI + -DI + 30 threshold
 */

import { useMemo } from "react";
import { HudPanel } from "@/components/HudPanel";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
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
    const { candles, bbSeries, rsiSeries, adxSeries } = detail;
    const sliceStart = Math.max(0, candles.length - 60);
    return candles.slice(sliceStart).map((c, i) => {
      const globalIdx = sliceStart + i;
      const bb = bbSeries?.[globalIdx];
      return {
        time: new Date(c.openTime).toLocaleDateString("ko-KR", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
        }),
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
        bbUpper: bb?.upper ?? c.close,
        bbMiddle: bb?.middle ?? c.close,
        bbLower: bb?.lower ?? c.close,
        rsi: rsiSeries?.[globalIdx] ?? 50,
        adx: adxSeries?.[globalIdx]?.adx ?? 0,
        plusDi: adxSeries?.[globalIdx]?.plusDi ?? 0,
        minusDi: adxSeries?.[globalIdx]?.minusDi ?? 0,
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
    <div className="space-y-3">
      {/* ─── Main: 캔들 + BB ────────────────────────────────────────── */}
      <HudPanel
        title="Chart"
        subtitle={`${symbol} · ${interval} · BBDX`}
        headerRight={
          <span className="font-display text-lg font-bold text-neon-cyan">
            ${lastPrice.toFixed(lastPrice < 1 ? 6 : 2)}
          </span>
        }
      >
        <div className="h-[360px]">
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
                name="BB Upper"
              />
              <Line
                type="monotone"
                dataKey="bbMiddle"
                stroke="oklch(0.65 0.02 260)"
                strokeDasharray="3 3"
                dot={false}
                strokeWidth={1}
                name="BB Middle"
              />
              <Line
                type="monotone"
                dataKey="bbLower"
                stroke="oklch(0.65 0.02 260)"
                strokeDasharray="5 5"
                dot={false}
                strokeWidth={1}
                name="BB Lower"
              />
              <Bar dataKey="close" fill="oklch(0.7 0.15 160)" opacity={0.3} />
              <Line
                type="monotone"
                dataKey="close"
                stroke="oklch(0.7 0.2 190)"
                dot={false}
                strokeWidth={2}
                name="Close"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </HudPanel>

      {/* ─── RSI(14) subchart ────────────────────────────────────────── */}
      <HudPanel title="RSI (14)" subtitle="Relative Strength Index">
        <div className="h-[160px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.03 260)" />
              <XAxis
                dataKey="time"
                tick={axisTick}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[0, 100]}
                tick={axisTick}
                tickLine={false}
                ticks={[0, 30, 35, 50, 70, 100]}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value: number) => [value.toFixed(2), "RSI"]}
              />
              {/* 30/35: BBDX 진입 영역 (oversold) */}
              <ReferenceLine
                y={30}
                stroke="oklch(0.82 0.19 145)"
                strokeDasharray="4 2"
                strokeOpacity={0.6}
                label={{
                  value: "30",
                  position: "right",
                  fill: "oklch(0.82 0.19 145)",
                  fontSize: 10,
                  fontFamily: "Share Tech Mono",
                }}
              />
              <ReferenceLine
                y={35}
                stroke="oklch(0.82 0.19 145)"
                strokeDasharray="4 2"
                strokeOpacity={0.4}
                label={{
                  value: "35",
                  position: "right",
                  fill: "oklch(0.82 0.19 145)",
                  fontSize: 10,
                  fontFamily: "Share Tech Mono",
                }}
              />
              {/* 70: 청산 임계 (overbought) */}
              <ReferenceLine
                y={70}
                stroke="oklch(0.72 0.25 350)"
                strokeDasharray="4 2"
                strokeOpacity={0.6}
                label={{
                  value: "70",
                  position: "right",
                  fill: "oklch(0.72 0.25 350)",
                  fontSize: 10,
                  fontFamily: "Share Tech Mono",
                }}
              />
              <Line
                dataKey="rsi"
                stroke="oklch(0.88 0.18 95)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </HudPanel>

      {/* ─── ADX/DI subchart ─────────────────────────────────────────── */}
      <HudPanel title="ADX / DI" subtitle="Average Directional Index with +DI / -DI">
        <div className="h-[160px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.03 260)" />
              <XAxis
                dataKey="time"
                tick={axisTick}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis domain={[0, "auto"]} tick={axisTick} tickLine={false} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value: number, name: string) => [
                  value.toFixed(2),
                  name === "adx" ? "ADX" : name === "plusDi" ? "+DI" : "-DI",
                ]}
              />
              <ReferenceLine
                y={30}
                stroke="oklch(0.65 0.02 260)"
                strokeDasharray="4 2"
                strokeOpacity={0.5}
                label={{
                  value: "30",
                  position: "right",
                  fill: "oklch(0.65 0.02 260)",
                  fontSize: 10,
                  fontFamily: "Share Tech Mono",
                }}
              />
              <Line
                dataKey="adx"
                stroke="oklch(0.82 0.18 195)"
                strokeWidth={2}
                dot={false}
                name="ADX"
              />
              <Line
                dataKey="plusDi"
                stroke="oklch(0.82 0.19 145)"
                strokeWidth={1.5}
                dot={false}
                strokeDasharray="3 2"
                name="+DI"
              />
              <Line
                dataKey="minusDi"
                stroke="oklch(0.72 0.25 350)"
                strokeWidth={1.5}
                dot={false}
                strokeDasharray="3 2"
                name="-DI"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </HudPanel>
    </div>
  );
}
