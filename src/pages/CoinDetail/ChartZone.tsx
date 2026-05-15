/**
 * ChartZone — Bybit TradingView 스타일 OHLC 캔들 차트 + BB 오버레이 +
 *             Volume 히스토그램 + RSI subchart + ADX/DI subchart.
 *
 * useCoinDetail 의 candles + bbSeries + rsiSeries + adxSeries 모두 활용.
 * 사용자 요청 (2026-05-15): 실제 Bybit 캔들차트처럼 OHLC 봉 + 그 위에 보조
 * 지표 오버레이. 기존 area-bar + line 단순화 형태를 진짜 캔들로 교체.
 *
 *   1) 메인: 실제 OHLC 캔들 (양봉 녹/음봉 적) + BB Upper/Middle/Lower 라인
 *   2) Volume 히스토그램 (시간축, 양봉/음봉 색 분리)
 *   3) RSI(14) subchart: 30/35/70 reference lines
 *   4) ADX/DI subchart: ADX + +DI + -DI + 30 threshold
 */

import { useMemo } from "react";
import { HudPanel } from "@/components/HudPanel";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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

// ─── Custom Candlestick Shape (OHLC) ────────────────────────────────────
// Recharts 는 기본 candlestick 미지원 → Bar shape prop 으로 커스텀 SVG.
// 양봉 (close ≥ open) = 녹색, 음봉 (close < open) = 빨강.
// VwapDetail.tsx 와 동일 패턴 — priceToY 변환기로 실제 캔들 그림.

interface CandleShapeProps {
  x?: number;
  width?: number;
  payload?: {
    open: number;
    high: number;
    low: number;
    close: number;
  };
  priceToY?: (price: number) => number;
}

function Candle(props: CandleShapeProps) {
  const { x, width, payload, priceToY } = props;
  if (!payload || x == null || width == null || !priceToY) return null;
  const { open, high, low, close } = payload;
  const isUp = close >= open;
  const color = isUp ? "#10b981" /* green-500 */ : "#ef4444" /* red-500 */;
  const cx = x + width / 2;
  const yOpen = priceToY(open);
  const yClose = priceToY(close);
  const yHigh = priceToY(high);
  const yLow = priceToY(low);
  const bodyTop = Math.min(yOpen, yClose);
  const bodyH = Math.max(1, Math.abs(yClose - yOpen));
  const bodyW = Math.max(2, width * 0.7);
  const bodyX = cx - bodyW / 2;
  return (
    <g>
      <line x1={cx} y1={yHigh} x2={cx} y2={yLow} stroke={color} strokeWidth={1} />
      <rect x={bodyX} y={bodyTop} width={bodyW} height={bodyH} fill={color} stroke={color} />
    </g>
  );
}

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

  // 캔들 + BB 밴드 영역을 모두 포함하는 yDomain 동적 산정 + priceToY 변환기.
  // Recharts Y 축은 내부 scale 을 노출하지 않으므로 수동 계산.
  const mainChartHeight = 360;
  const mainTopPad = 5;
  const mainBottomPad = 5;
  const mainPlotH = mainChartHeight - mainTopPad - mainBottomPad;

  const yDomain = (() => {
    if (chartData.length === 0) return [0, 1] as [number, number];
    let lo = Infinity;
    let hi = -Infinity;
    for (const d of chartData) {
      if (d.low < lo) lo = d.low;
      if (d.high > hi) hi = d.high;
      // BB 밴드도 영역 포함 (밴드가 캔들을 벗어나도 잘리지 않도록)
      if (d.bbLower < lo) lo = d.bbLower;
      if (d.bbUpper > hi) hi = d.bbUpper;
    }
    const pad = (hi - lo) * 0.05;
    return [lo - pad, hi + pad] as [number, number];
  })();

  const priceToY = (price: number): number => {
    const [lo, hi] = yDomain;
    const range = hi - lo || 1;
    const ratio = (price - lo) / range;
    return mainTopPad + (1 - ratio) * mainPlotH;
  };

  return (
    <div className="space-y-3">
      {/* ─── Main: OHLC 캔들 + BB ────────────────────────────────────── */}
      <HudPanel
        title="Chart"
        subtitle={`${symbol} · ${interval} · BBDX (OHLC + Bollinger Bands)`}
        headerRight={
          <span className="font-display text-lg font-bold text-neon-cyan">
            ${lastPrice.toFixed(lastPrice < 1 ? 6 : 2)}
          </span>
        }
      >
        <div style={{ height: `${mainChartHeight}px` }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: mainTopPad, right: 5, left: 5, bottom: mainBottomPad }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.03 260)" />
              <XAxis
                dataKey="time"
                tick={axisTick}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={yDomain}
                tick={axisTick}
                tickLine={false}
                orientation="right"
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value: number | string, name: string, item) => {
                  if (typeof value !== "number") return [value, name];
                  // 캔들 시리즈는 OHLC 한 줄 표시
                  if (name === "candle" && item?.payload) {
                    const p = item.payload as { open: number; high: number; low: number; close: number };
                    const fmt = (v: number) => v.toFixed(v < 1 ? 6 : 2);
                    return [
                      `O ${fmt(p.open)} / H ${fmt(p.high)} / L ${fmt(p.low)} / C ${fmt(p.close)}`,
                      "OHLC",
                    ];
                  }
                  return [value.toFixed(value < 1 ? 6 : 2), name];
                }}
              />
              <ReferenceLine
                y={lastPrice}
                stroke="oklch(0.7 0.2 350)"
                strokeDasharray="2 2"
                strokeOpacity={0.4}
              />
              {/* BB 라인 — 캔들 위에 보조지표로 오버레이 (사용자 요청) */}
              <Line
                type="monotone"
                dataKey="bbUpper"
                stroke="oklch(0.65 0.02 260)"
                strokeDasharray="5 5"
                dot={false}
                strokeWidth={1}
                name="BB Upper"
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="bbMiddle"
                stroke="oklch(0.65 0.02 260)"
                strokeDasharray="3 3"
                dot={false}
                strokeWidth={1}
                name="BB Middle"
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="bbLower"
                stroke="oklch(0.65 0.02 260)"
                strokeDasharray="5 5"
                dot={false}
                strokeWidth={1}
                name="BB Lower"
                isAnimationActive={false}
              />
              {/* 실제 OHLC 캔들 — VwapDetail 과 동일 패턴 */}
              <Bar
                dataKey="high"
                shape={(p: object) => <Candle {...(p as CandleShapeProps)} priceToY={priceToY} />}
                isAnimationActive={false}
                legendType="none"
                name="candle"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </HudPanel>

      {/* ─── Volume Histogram (시간축, 양봉/음봉 색 분리) ──────────────── */}
      <HudPanel title="Volume" subtitle="시간축 거래량 — 양봉(녹) / 음봉(적)">
        <div className="h-[120px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.03 260)" />
              <XAxis
                dataKey="time"
                tick={axisTick}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={axisTick}
                tickLine={false}
                orientation="right"
                tickFormatter={(v) =>
                  v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}K` : v.toFixed(0)
                }
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value: number) => [value.toLocaleString(), "Volume"]}
              />
              <Bar dataKey="volume" isAnimationActive={false}>
                {chartData.map((d, i) => (
                  <Cell key={i} fill={d.close >= d.open ? "#10b981" : "#ef4444"} fillOpacity={0.6} />
                ))}
              </Bar>
            </BarChart>
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
