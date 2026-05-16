/**
 * Lightweight-charts (TradingView OSS) candlestick chart with optional
 * Bollinger Bands, Fibonacci level, and trendline overlays. Used by both
 * /coin/:symbol and /fibonacci/:symbol detail pages.
 */

import { useCallback, useEffect, useRef } from "react";
import type { Candle } from "@shared/types";
import type { Trendline } from "@/lib/fibonacci-engine";

export interface ChartFibLevel {
  ratio: number;
  price: number;
  label?: string;
  zoneLow?: number;
  zoneHigh?: number;
}

export interface ChartBBPoint {
  upper: number;
  middle: number;
  lower: number;
}

interface CandleChartLWProps {
  candles: Candle[];
  currentPrice: number;
  fibLevels?: ChartFibLevel[];
  trendlines?: Trendline[];
  bbSeries?: ChartBBPoint[];
  height?: number;
  /** how many trailing candles to display (default: all loaded candles).
   *  Pass a number to limit; pass undefined or 0 to show all loaded data so
   *  the user can scroll/zoom freely through the full series. */
  windowSize?: number;
  /** show the floating legend row under the chart (default true) */
  showLegend?: boolean;
}

const FIB_COLORS: Record<number, string> = {
  0: "#ff0066",
  0.236: "#ff006688",
  0.382: "#ff6b6b",
  0.5: "#00e5ff88",
  0.618: "#FFD700",
  0.786: "#00e5ff88",
  1: "#ff0066",
};

export function CandleChartLW({
  candles,
  currentPrice,
  fibLevels,
  trendlines,
  bbSeries,
  height = 500,
  windowSize,
  showLegend = true,
}: CandleChartLWProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<{ remove: () => void } | null>(null);

  const initChart = useCallback(async () => {
    if (!containerRef.current || candles.length === 0) return;

    const {
      createChart,
      CandlestickSeries,
      HistogramSeries,
      LineSeries,
      ColorType,
      LineStyle,
      CrosshairMode,
    } = await import("lightweight-charts");

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const container = containerRef.current;

    const chart = createChart(container, {
      width: container.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#888",
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)" },
        horzLines: { color: "rgba(255,255,255,0.04)" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "rgba(0,229,255,0.3)", width: 1, style: LineStyle.Dashed },
        horzLine: { color: "rgba(0,229,255,0.3)", width: 1, style: LineStyle.Dashed },
      },
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.1)",
        scaleMargins: { top: 0.05, bottom: 0.05 },
      },
      timeScale: {
        borderColor: "rgba(255,255,255,0.1)",
        timeVisible: true,
        secondsVisible: false,
        // 사용자가 차트 우측 끝을 넘어 미래 방향으로 스크롤 시 빈 공간 표시.
        // Bybit / TradingView 와 동일한 UX.
        rightOffset: 12,
        // 휠 + 드래그로 시간축 panning 활성 (기본 true 인데 명시).
        shiftVisibleRangeOnNewBar: true,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
    });

    chartRef.current = chart;

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#00e676",
      downColor: "#ff1744",
      borderUpColor: "#00e676",
      borderDownColor: "#ff1744",
      wickUpColor: "#00e676",
      wickDownColor: "#ff1744",
    });

    // windowSize undefined / 0 → 전체 로드된 캔들 표시 (사용자가 마우스 휠 +
    // 드래그로 자유롭게 zoom in / zoom out / scroll 가능). 시그널 트래커가
    // 특정 범위만 시각화하려면 windowSize 를 명시적으로 넘긴다.
    const effectiveWindow = windowSize && windowSize > 0 ? windowSize : candles.length;
    const offsetIdx = Math.max(0, candles.length - effectiveWindow);
    const chartCandles = candles.slice(offsetIdx);

    candleSeries.setData(
      chartCandles.map((c) => ({
        time: Math.floor(c.openTime / 1000) as never,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }))
    );

    // Volume histogram
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });
    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    });
    volumeSeries.setData(
      chartCandles.map((c) => ({
        time: Math.floor(c.openTime / 1000) as never,
        value: c.volume,
        color: c.close >= c.open ? "rgba(0,230,118,0.15)" : "rgba(255,23,68,0.15)",
      }))
    );

    // Bollinger Bands overlay
    if (bbSeries && bbSeries.length === candles.length) {
      const bbWindow = bbSeries.slice(offsetIdx);
      const bbColor = "rgba(180,180,255,0.55)";
      const upperData: { time: number; value: number }[] = [];
      const middleData: { time: number; value: number }[] = [];
      const lowerData: { time: number; value: number }[] = [];
      for (let i = 0; i < bbWindow.length; i++) {
        const time = Math.floor(chartCandles[i].openTime / 1000);
        const bb = bbWindow[i];
        if (!bb) continue;
        upperData.push({ time, value: bb.upper });
        middleData.push({ time, value: bb.middle });
        lowerData.push({ time, value: bb.lower });
      }
      const upper = chart.addSeries(LineSeries, {
        color: bbColor,
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      upper.setData(upperData as never);
      const middle = chart.addSeries(LineSeries, {
        color: "rgba(180,180,255,0.35)",
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      middle.setData(middleData as never);
      const lower = chart.addSeries(LineSeries, {
        color: bbColor,
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      lower.setData(lowerData as never);
    }

    // Fibonacci price lines
    if (fibLevels && fibLevels.length > 0) {
      for (const level of fibLevels) {
        const color = FIB_COLORS[level.ratio] ?? "#00e5ff44";
        const isGolden = level.ratio === 0.618;
        const isKey =
          level.ratio === 0 ||
          level.ratio === 1 ||
          level.ratio === 0.618 ||
          level.ratio === 0.382;

        candleSeries.createPriceLine({
          price: level.price,
          color,
          lineWidth: isGolden ? 2 : 1,
          lineStyle: isGolden ? LineStyle.Solid : LineStyle.Dashed,
          axisLabelVisible: true,
          title: `${level.label ?? `Fib ${level.ratio}`} ($${level.price < 1 ? level.price.toPrecision(4) : level.price.toFixed(2)})`,
        });

        if (isKey && level.zoneHigh != null && level.zoneLow != null) {
          candleSeries.createPriceLine({
            price: level.zoneHigh,
            color,
            lineWidth: 1,
            lineStyle: LineStyle.Dotted,
            axisLabelVisible: false,
            title: "",
          });
          candleSeries.createPriceLine({
            price: level.zoneLow,
            color,
            lineWidth: 1,
            lineStyle: LineStyle.Dotted,
            axisLabelVisible: false,
            title: "",
          });
        }
      }
    }

    // Current price marker
    candleSeries.createPriceLine({
      price: currentPrice,
      color: "#ff0066",
      lineWidth: 1,
      lineStyle: LineStyle.SparseDotted,
      axisLabelVisible: true,
      title: "Current",
    });

    // Trendlines
    //
    // Extrapolation clipping (2026-05-14):
    //   - 표시되는 차트 캔들의 high/low + fibLevels 의 price 를 기준으로
    //     priceRange (min/max) 를 산출하고, line value 가 그 범위의 ±30%
    //     를 벗어나면 그 시점부터 line 을 자른다.
    //   - endPoint.index + EXTRA_FORWARD_CANDLES 이후로는 extrapolate 하지 않음.
    //
    // Quality-aware styling (2026-05-15):
    //   - "ransac"     → 굵은 실선 (가장 robust 한 라인)
    //   - "regression" → 중간 실선
    //   - "two-pivot"  → 옅은 dashed line + isVisualHint=true 표시
    //   isValid=false 라인도 two-pivot hint 이면 약하게 그림 (사용자 요구:
    //   라인 통째로 사라지는 것보다 fallback hint 라도 보여주는 게 나음).
    if (trendlines && trendlines.length > 0) {
      const drawnTrendlines = trendlines.filter(
        (t) => t.isValid || t.isVisualHint
      );

      // 표시 가격 범위 계산 (캔들 high/low + fib levels)
      let visibleHigh = -Infinity;
      let visibleLow = Infinity;
      for (const c of chartCandles) {
        if (c.high > visibleHigh) visibleHigh = c.high;
        if (c.low < visibleLow) visibleLow = c.low;
      }
      if (fibLevels) {
        for (const f of fibLevels) {
          if (f.price > visibleHigh) visibleHigh = f.price;
          if (f.price < visibleLow) visibleLow = f.price;
        }
      }
      if (!Number.isFinite(visibleHigh) || !Number.isFinite(visibleLow)) {
        visibleHigh = currentPrice * 1.1;
        visibleLow = currentPrice * 0.9;
      }
      const priceRange = Math.max(1e-9, visibleHigh - visibleLow);
      const clipHigh = visibleHigh + priceRange * 0.3;
      const clipLow = Math.max(0, visibleLow - priceRange * 0.3);

      const EXTRA_FORWARD_CANDLES = 10;

      for (const tl of drawnTrendlines) {
        const baseColor = tl.type === "support" ? "#00e676" : "#ff1744";
        // Quality 별 스타일
        const isHint = tl.isVisualHint === true || tl.quality === "two-pivot";
        const isRansac = tl.quality === "ransac";
        // hint 는 50% alpha, ransac 는 굵게
        const tlColor = isHint
          ? tl.type === "support"
            ? "#00e67688" // green @ 53% alpha
            : "#ff174488" // red @ 53% alpha
          : baseColor;
        const tlWidth: 1 | 2 | 3 = isHint ? 1 : isRansac ? 3 : 2;
        const tlStyle = isHint ? LineStyle.Dashed : LineStyle.Solid;

        const chartStartIdx = Math.max(0, tl.startPoint.index - offsetIdx);

        if (tl.endPoint.index < offsetIdx) continue;
        if (tl.startPoint.index >= candles.length) continue;

        // 우측 extrapolation 한도: endPoint.index + N 또는 차트 끝, 둘 중 작은 값
        const maxGlobalIdx = Math.min(
          tl.endPoint.index + EXTRA_FORWARD_CANDLES,
          offsetIdx + chartCandles.length - 1
        );
        const drawEndChartIdx = Math.max(0, maxGlobalIdx - offsetIdx);

        const lineData: { time: number; value: number }[] = [];
        for (let i = chartStartIdx; i <= drawEndChartIdx; i++) {
          const globalIdx = i + offsetIdx;
          const price = tl.startPoint.price + tl.slope * (globalIdx - tl.startPoint.index);
          // 가격 범위 ±30% 벗어나면 그 시점에서 line 종료
          if (price < clipLow || price > clipHigh) break;
          lineData.push({
            time: Math.floor(chartCandles[i].openTime / 1000),
            value: price,
          });
        }

        if (lineData.length >= 2) {
          const tlSeries = chart.addSeries(LineSeries, {
            color: tlColor,
            lineWidth: tlWidth,
            lineStyle: tlStyle,
            crosshairMarkerVisible: false,
            priceLineVisible: false,
            lastValueVisible: false,
            // hint 라인 라벨 — endpoint 에 "AUTO" 작은 라벨
            title: isHint ? "AUTO" : "",
          });
          tlSeries.setData(lineData as never);
        }
      }
    }

    chart.timeScale().fitContent();

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, [candles, fibLevels, trendlines, bbSeries, currentPrice, height, windowSize]);

  useEffect(() => {
    const cleanupPromise = initChart();
    return () => {
      cleanupPromise?.then((fn) => fn?.());
      if (chartRef.current) {
        try {
          chartRef.current.remove();
        } catch {
          // ignore
        }
        chartRef.current = null;
      }
    };
  }, [initChart]);

  return (
    <div className="relative">
      <div ref={containerRef} className="w-full" style={{ minHeight: height }} />
      {showLegend && (
        <div className="flex flex-wrap items-center gap-4 mt-3 px-2">
          {fibLevels && fibLevels.length > 0 && (
            <>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-0.5 bg-[#FFD700]" />
                <span className="font-sans text-[10px] text-muted-foreground">0.618 Golden</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-0.5 bg-[#ff6b6b]" />
                <span className="font-sans text-[10px] text-muted-foreground">0.382</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-0.5" style={{ borderTop: "1px dashed #ff0066" }} />
                <span className="font-sans text-[10px] text-muted-foreground">High/Low</span>
              </div>
            </>
          )}
          {bbSeries && (
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-0.5" style={{ borderTop: "1px dashed rgb(180,180,255)" }} />
              <span className="font-sans text-[10px] text-muted-foreground">BB(20,2)</span>
            </div>
          )}
          {trendlines && trendlines.length > 0 && (
            <>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-0.5" style={{ borderTop: "2px dashed #00e676" }} />
                <span className="font-sans text-[10px] text-muted-foreground">Support TL</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-0.5" style={{ borderTop: "2px dashed #ff1744" }} />
                <span className="font-sans text-[10px] text-muted-foreground">Resistance TL</span>
              </div>
            </>
          )}
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-0.5" style={{ borderTop: "1px dotted #ff0066" }} />
            <span className="font-sans text-[10px] text-muted-foreground">Current Price</span>
          </div>
        </div>
      )}
    </div>
  );
}
