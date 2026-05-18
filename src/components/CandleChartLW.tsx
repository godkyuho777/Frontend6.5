/**
 * Lightweight-charts (TradingView OSS) candlestick chart with optional
 * Bollinger Bands, Fibonacci level, and trendline overlays. Used by both
 * /coin/:symbol and /fibonacci/:symbol detail pages.
 *
 * 2026-05-16: Zoom/scroll 상태 보존 리팩토링.
 *   - 이전: `initChart` 가 모든 props 변경 (특히 currentPrice 매 3초 갱신) 에서
 *     차트를 destroy + recreate 하여 사용자의 zoom/pan 상태가 매번 리셋됨.
 *   - 이후: 차트 생성과 데이터/오버레이 업데이트를 분리. currentPrice 는
 *     priceLine 만 갱신 (차트 자체는 유지). 캔들 데이터 변경 시 series.setData
 *     로 in-place 갱신.
 *   - fitContent 는 candles 가 처음 채워질 때 한 번, symbol/timeframe 변경
 *     (candles 의 첫 timestamp 가 바뀔 때) 에만 호출.
 */

import { useEffect, useRef } from "react";
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

  // 차트 + series refs (lightweight-charts 인스턴스는 React 외부 lifecycle 관리)
  const chartRef = useRef<any>(null);
  const candleSeriesRef = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);
  const bbUpperRef = useRef<any>(null);
  const bbMiddleRef = useRef<any>(null);
  const bbLowerRef = useRef<any>(null);
  /** 모든 trendline / Fib 한도선 series. 갱신 시 한꺼번에 removeSeries. */
  const overlaysRef = useRef<any[]>([]);
  /** 가격 라인 핸들 (Fib + Current). priceLine 은 candleSeries.createPriceLine 으로 생성하고 removePriceLine 으로 제거. */
  const priceLinesRef = useRef<any[]>([]);
  const currentPriceLineRef = useRef<any>(null);

  /** 마지막으로 그린 캔들의 첫 timestamp — symbol/timeframe 전환 감지용. */
  const lastFirstTimeRef = useRef<number | null>(null);
  /** 차트가 초기 생성되었는지 (lightweight-charts dynamic import 가 비동기). */
  const setupCompleteRef = useRef(false);
  /** lightweight-charts module 캐시. */
  const lwModuleRef = useRef<any>(null);

  // ── 1. Chart instance + base series 생성 (height 만 의존) ──
  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    if (!container) return;

    (async () => {
      const mod =
        lwModuleRef.current || (await import("lightweight-charts"));
      if (cancelled) return;
      lwModuleRef.current = mod;
      const {
        createChart,
        CandlestickSeries,
        HistogramSeries,
        ColorType,
        LineStyle,
        CrosshairMode,
      } = mod;

      // 기존 차트가 있으면 정리
      if (chartRef.current) {
        try {
          chartRef.current.remove();
        } catch {
          // ignore
        }
        chartRef.current = null;
      }

      // container.clientWidth 가 0 인 순간이면 (mobile / 늦게 mount 되는 부모)
      // 차트가 0×0 으로 생성되어 canvas 가 보이지 않는다. 최소 1px 로
      // fallback 한 후, 아래의 ResizeObserver 가 실제 width 가 들어오는
      // 즉시 applyOptions 로 갱신한다.
      const initialWidth = container.clientWidth || 1;

      const chart = createChart(container, {
        width: initialWidth,
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
          rightOffset: 12,
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

      candleSeriesRef.current = chart.addSeries(CandlestickSeries, {
        upColor: "#00e676",
        downColor: "#ff1744",
        borderUpColor: "#00e676",
        borderDownColor: "#ff1744",
        wickUpColor: "#00e676",
        wickDownColor: "#ff1744",
      });

      volumeSeriesRef.current = chart.addSeries(HistogramSeries, {
        priceFormat: { type: "volume" },
        priceScaleId: "volume",
      });
      chart.priceScale("volume").applyOptions({
        scaleMargins: { top: 0.85, bottom: 0 },
      });

      setupCompleteRef.current = true;
      lastFirstTimeRef.current = null;

      // 컨테이너 리사이즈 핸들러 (window resize 만 잡음 — 부모 컨테이너의
      // 비동기 layout 변화는 별도 ResizeObserver 로 처리).
      const onResize = () => {
        if (containerRef.current && chartRef.current) {
          const w = containerRef.current.clientWidth;
          if (w > 0) {
            chartRef.current.applyOptions({ width: w });
          }
        }
      };
      window.addEventListener("resize", onResize);

      // ResizeObserver — container 의 실제 width 변화를 추적.
      // 초기 mount 시 container.clientWidth=0 인 케이스 (mobile / late
      // hydration / parent flex 가 늦게 settle) 를 정확히 잡아준다.
      let didFirstFit = false;
      const resizeObs = new ResizeObserver((entries) => {
        if (!chartRef.current) return;
        const entry = entries[0];
        if (!entry) return;
        const w = Math.floor(entry.contentRect.width);
        if (w > 0) {
          try {
            chartRef.current.applyOptions({ width: w });
            // 첫 non-zero width 가 들어왔을 때 한 번 fitContent (캔들이
            // 이미 setData 된 상태 대비). 이후 fitContent 는 호출 X →
            // 사용자 zoom 보존.
            if (!didFirstFit) {
              didFirstFit = true;
              chartRef.current.timeScale().fitContent();
            }
          } catch {
            // ignore
          }
        }
      });
      resizeObs.observe(container);

      // cleanup 은 별도 useEffect 의 unmount 에서 처리 (아래)
      (chart as any).__onResize = onResize;
      (chart as any).__resizeObs = resizeObs;
    })();

    return () => {
      cancelled = true;
      const chart = chartRef.current;
      if (chart) {
        const onResize = (chart as any).__onResize;
        if (onResize) window.removeEventListener("resize", onResize);
        const resizeObs = (chart as any).__resizeObs as ResizeObserver | undefined;
        if (resizeObs) {
          try {
            resizeObs.disconnect();
          } catch {
            // ignore
          }
        }
        try {
          chart.remove();
        } catch {
          // ignore
        }
      }
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      bbUpperRef.current = null;
      bbMiddleRef.current = null;
      bbLowerRef.current = null;
      overlaysRef.current = [];
      priceLinesRef.current = [];
      currentPriceLineRef.current = null;
      setupCompleteRef.current = false;
    };
  }, [height]);

  // ── 2. Candle / Volume 데이터 갱신 ──
  // candles 가 바뀔 때 (symbol/timeframe 변경 OR live update) series.setData 로 in-place 갱신.
  // 첫 그리기 또는 symbol/timeframe 전환 (첫 캔들의 timestamp 가 바뀌었을 때) 에만 fitContent.
  useEffect(() => {
    if (!setupCompleteRef.current || candles.length === 0) return;
    const candleSeries = candleSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    if (!candleSeries || !volumeSeries) return;

    const effectiveWindow = windowSize && windowSize > 0 ? windowSize : candles.length;
    const offsetIdx = Math.max(0, candles.length - effectiveWindow);
    const chartCandles = candles.slice(offsetIdx);

    candleSeries.setData(
      chartCandles.map((c) => ({
        time: Math.floor(c.openTime / 1000),
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })),
    );

    volumeSeries.setData(
      chartCandles.map((c) => ({
        time: Math.floor(c.openTime / 1000),
        value: c.volume,
        color: c.close >= c.open ? "rgba(0,230,118,0.15)" : "rgba(255,23,68,0.15)",
      })),
    );

    // symbol / timeframe 전환 시에만 fitContent (첫 캔들 시간이 달라졌는지 확인)
    const firstTime = chartCandles[0]?.openTime ?? null;
    const isFirstDraw = lastFirstTimeRef.current == null;
    const isSeriesSwitch =
      lastFirstTimeRef.current != null && lastFirstTimeRef.current !== firstTime;
    if (isFirstDraw || isSeriesSwitch) {
      try {
        chartRef.current?.timeScale().fitContent();
      } catch {
        // ignore
      }
      lastFirstTimeRef.current = firstTime;
    }
    // 같은 series 내에서 새 캔들이 추가된 경우 (live tick) 는 fitContent 호출 X
    // → 사용자의 zoom/pan 상태 보존.
  }, [candles, windowSize]);

  // ── 3. Bollinger Bands 오버레이 ──
  useEffect(() => {
    if (!setupCompleteRef.current) return;
    const chart = chartRef.current;
    if (!chart) return;
    const mod = lwModuleRef.current;
    if (!mod) return;
    const { LineSeries, LineStyle } = mod;

    // 기존 BB 제거
    [bbUpperRef.current, bbMiddleRef.current, bbLowerRef.current].forEach((s) => {
      if (s) {
        try {
          chart.removeSeries(s);
        } catch {
          // ignore
        }
      }
    });
    bbUpperRef.current = bbMiddleRef.current = bbLowerRef.current = null;

    if (!bbSeries || bbSeries.length !== candles.length) return;

    const effectiveWindow = windowSize && windowSize > 0 ? windowSize : candles.length;
    const offsetIdx = Math.max(0, candles.length - effectiveWindow);
    const chartCandles = candles.slice(offsetIdx);
    const bbWindow = bbSeries.slice(offsetIdx);
    const upperData: any[] = [];
    const middleData: any[] = [];
    const lowerData: any[] = [];
    for (let i = 0; i < bbWindow.length; i++) {
      const time = Math.floor(chartCandles[i].openTime / 1000);
      const bb = bbWindow[i];
      if (!bb) continue;
      upperData.push({ time, value: bb.upper });
      middleData.push({ time, value: bb.middle });
      lowerData.push({ time, value: bb.lower });
    }
    const bbColor = "rgba(180,180,255,0.55)";
    const upper = chart.addSeries(LineSeries, {
      color: bbColor,
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    upper.setData(upperData);
    const middle = chart.addSeries(LineSeries, {
      color: "rgba(180,180,255,0.35)",
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    middle.setData(middleData);
    const lower = chart.addSeries(LineSeries, {
      color: bbColor,
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    lower.setData(lowerData);
    bbUpperRef.current = upper;
    bbMiddleRef.current = middle;
    bbLowerRef.current = lower;
  }, [bbSeries, candles, windowSize]);

  // ── 4. Fibonacci price lines ──
  useEffect(() => {
    if (!setupCompleteRef.current) return;
    const candleSeries = candleSeriesRef.current;
    const mod = lwModuleRef.current;
    if (!candleSeries || !mod) return;
    const { LineStyle } = mod;

    // 기존 Fib priceLines 제거
    priceLinesRef.current.forEach((line) => {
      try {
        candleSeries.removePriceLine(line);
      } catch {
        // ignore
      }
    });
    priceLinesRef.current = [];

    if (!fibLevels || fibLevels.length === 0) return;

    for (const level of fibLevels) {
      const color = FIB_COLORS[level.ratio] ?? "#00e5ff44";
      const isGolden = level.ratio === 0.618;
      const isKey =
        level.ratio === 0 ||
        level.ratio === 1 ||
        level.ratio === 0.618 ||
        level.ratio === 0.382;

      const line = candleSeries.createPriceLine({
        price: level.price,
        color,
        lineWidth: isGolden ? 2 : 1,
        lineStyle: isGolden ? LineStyle.Solid : LineStyle.Dashed,
        axisLabelVisible: true,
        title: `${level.label ?? `Fib ${level.ratio}`} ($${
          level.price < 1 ? level.price.toPrecision(4) : level.price.toFixed(2)
        })`,
      });
      priceLinesRef.current.push(line);

      if (isKey && level.zoneHigh != null && level.zoneLow != null) {
        const hi = candleSeries.createPriceLine({
          price: level.zoneHigh,
          color,
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: false,
          title: "",
        });
        const lo = candleSeries.createPriceLine({
          price: level.zoneLow,
          color,
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: false,
          title: "",
        });
        priceLinesRef.current.push(hi, lo);
      }
    }
  }, [fibLevels]);

  // ── 5. Trendlines ──
  useEffect(() => {
    if (!setupCompleteRef.current) return;
    const chart = chartRef.current;
    const mod = lwModuleRef.current;
    if (!chart || !mod) return;
    const { LineSeries, LineStyle } = mod;

    // 기존 trendline series 제거
    overlaysRef.current.forEach((s) => {
      try {
        chart.removeSeries(s);
      } catch {
        // ignore
      }
    });
    overlaysRef.current = [];

    if (!trendlines || trendlines.length === 0 || candles.length === 0) return;

    const effectiveWindow = windowSize && windowSize > 0 ? windowSize : candles.length;
    const offsetIdx = Math.max(0, candles.length - effectiveWindow);
    const chartCandles = candles.slice(offsetIdx);

    const drawn = trendlines.filter((t) => t.isValid || t.isVisualHint);

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

    for (const tl of drawn) {
      const baseColor = tl.type === "support" ? "#00e676" : "#ff1744";
      const isHint = tl.isVisualHint === true || tl.quality === "two-pivot";
      const isRansac = tl.quality === "ransac";
      const tlColor = isHint
        ? tl.type === "support"
          ? "#00e67688"
          : "#ff174488"
        : baseColor;
      const tlWidth: 1 | 2 | 3 = isHint ? 1 : isRansac ? 3 : 2;
      const tlStyle = isHint ? LineStyle.Dashed : LineStyle.Solid;

      const chartStartIdx = Math.max(0, tl.startPoint.index - offsetIdx);
      if (tl.endPoint.index < offsetIdx) continue;
      if (tl.startPoint.index >= candles.length) continue;

      const maxGlobalIdx = Math.min(
        tl.endPoint.index + EXTRA_FORWARD_CANDLES,
        offsetIdx + chartCandles.length - 1,
      );
      const drawEndChartIdx = Math.max(0, maxGlobalIdx - offsetIdx);

      const lineData: any[] = [];
      for (let i = chartStartIdx; i <= drawEndChartIdx; i++) {
        const globalIdx = i + offsetIdx;
        const price =
          tl.startPoint.price + tl.slope * (globalIdx - tl.startPoint.index);
        if (price < clipLow || price > clipHigh) break;
        lineData.push({
          time: Math.floor(chartCandles[i].openTime / 1000),
          value: price,
        });
      }
      if (lineData.length >= 2) {
        const series = chart.addSeries(LineSeries, {
          color: tlColor,
          lineWidth: tlWidth,
          lineStyle: tlStyle,
          crosshairMarkerVisible: false,
          priceLineVisible: false,
          lastValueVisible: false,
          title: isHint ? "AUTO" : "",
        });
        series.setData(lineData);
        overlaysRef.current.push(series);
      }
    }
  }, [trendlines, candles, windowSize, fibLevels, currentPrice]);

  // ── 6. Current price line — 매 ticker 갱신마다 가격만 업데이트 ──
  useEffect(() => {
    if (!setupCompleteRef.current) return;
    const candleSeries = candleSeriesRef.current;
    const mod = lwModuleRef.current;
    if (!candleSeries || !mod) return;
    const { LineStyle } = mod;

    if (currentPrice == null || !Number.isFinite(currentPrice) || currentPrice <= 0)
      return;

    // 기존 라인 제거 후 재생성 (lightweight-charts 의 priceLine 은 applyOptions 가
    // price 변경을 지원하지 않으므로 remove+create 가 가장 안전. 이 작업은 차트
    // 자체를 destroy 하지 않으므로 zoom/pan 상태에는 영향 X).
    if (currentPriceLineRef.current) {
      try {
        candleSeries.removePriceLine(currentPriceLineRef.current);
      } catch {
        // ignore
      }
      currentPriceLineRef.current = null;
    }

    currentPriceLineRef.current = candleSeries.createPriceLine({
      price: currentPrice,
      color: "#ff0066",
      lineWidth: 1,
      lineStyle: LineStyle.SparseDotted,
      axisLabelVisible: true,
      title: "Current",
    });
  }, [currentPrice]);

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
