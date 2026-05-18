/**
 * EMA + ADX 정배열 추세 — 차트 탭 (코인 detail 컨텍스트).
 *
 * 재설계 (2026-05-19): 기존 5-component Area chart (recharts) 폐기. 사용자 피드백:
 *   "5-component Breakdown 이 모두 100 으로 평평해서 의미 불명. 캔들 차트에
 *    EMA / ADX 띄우면 되잖아"
 *
 * SOLUSDT 4H 에서 breakdown.* 가 0~1 정규화 값이며 5개 모두 만점 (1.0) 인 경우
 * area chart 가 평평한 100 라인으로 의미 전달 실패. 본 탭은 거래자가 직관적으로
 * 해석 가능한 캔들 + EMA Ribbon + ADX/±DI 시각화로 교체.
 *
 * 새 구조:
 *   1) [상단] 5-component Pass / Fail 체크리스트 칩 (실측값 노출)
 *   2) [메인] lightweight-charts 단일 chart + 두 priceScale:
 *      - main scale (오른쪽): 캔들 + EMA(9/21/50) + SMA(50) dashed
 *      - "adx" scale (하단 28%): ADX(흰) + +DI(녹) + -DI(적) + 20/25 기준선
 *   3) [하단] 진입가 / Target 1 / Target 2 / Stop Loss 카드 (기존 유지)
 *
 * 캔들 fetch:
 *   `useCoinDetail(symbol, tf, 200)` — 200 캔들 + ADX 시리즈를 이미 계산/캐싱.
 *   EMA 정배열 (9/21/50) + SMA(50) 안정화에 200 캔들이 충분.
 *
 * lightweight-charts 패턴:
 *   VWAP 차트 V2 (`VwapDetailPanels.tsx::VwapChartPanel`) 와 동일한 단일 chart
 *   + 두 priceScale 구조. 두 chart vertical stack 대비 timeScale sync 자동.
 */

import { useCallback, useEffect, useMemo, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { HudPanel } from "@/components/HudPanel";
import { Loader2, Check, X as IconX } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCoinDetail } from "@/hooks/useMarketData";
import { calculateEMASeries } from "@/lib/trend-analysis";

export interface ChartTabProps {
  symbol: string;
  tf: "1h" | "4h" | "1d";
}

// ---------------------------------------------------------------------------
// 색상 팔레트 — cyberpunk neon. lightweight-charts API 가 oklch 미지원이므로
// hex/rgba 직접 지정. VWAP 차트 V2 와 톤 일치.
// ---------------------------------------------------------------------------

const COLOR = {
  candleUp: "#00f0ff",
  candleDown: "#ff4e82",
  candleUpWick: "rgba(0, 240, 255, 0.7)",
  candleDownWick: "rgba(255, 78, 130, 0.7)",
  ema9: "#FF2EA0",      // neon-magenta
  ema21: "#FF8800",     // orange
  ema50: "#00f0ff",     // neon-cyan — 정배열 핵심 long-term
  sma50: "rgba(255, 215, 0, 0.65)", // 옅은 노랑 dashed
  adx: "#FFFFFF",
  diPlus: "#00ff88",
  diMinus: "#ff2244",
  adxRef20: "rgba(255, 255, 255, 0.30)",
  adxRef25: "rgba(255, 255, 255, 0.50)",
  grid: "rgba(255,255,255,0.05)",
  axisText: "#888",
  crosshair: "rgba(0,229,255,0.3)",
};

// ---------------------------------------------------------------------------
// SMA 시리즈 — 단순 rolling mean. 인라인 (trend-analysis / vwap-engine 에 동일
// 헬퍼 없음, 단일 호출이라 별도 모듈 분리 보류).
// ---------------------------------------------------------------------------

function calculateSMASeries(values: number[], period: number): number[] {
  const out: number[] = [];
  if (values.length === 0 || period <= 0) return out;
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i + 1 < period) {
      // 시리즈 시작 — running mean (lightweight-charts 연속성 유지).
      out.push(sum / (i + 1));
    } else {
      out.push(sum / period);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// 5-component pass/fail 칩
// ---------------------------------------------------------------------------

interface ChipProps {
  pass: boolean;
  label: string;
  detail?: string;
}

function Chip({ pass, label, detail }: ChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-1 rounded-sm border font-mono text-[10px]",
        pass
          ? "bg-emerald-500/10 text-neon-green border-neon-green/40"
          : "bg-red-500/10 text-neon-red border-neon-red/40",
      )}
    >
      {pass ? (
        <Check className="h-3 w-3 shrink-0" />
      ) : (
        <IconX className="h-3 w-3 shrink-0" />
      )}
      <span className="font-semibold">{label}</span>
      {detail && (
        <span className="text-muted-foreground/80 font-normal">· {detail}</span>
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// 차트 패널 — 캔들 + EMA Ribbon + ADX 하단 패널
// ---------------------------------------------------------------------------

interface ChartPanelProps {
  candles: import("@shared/types").Candle[];
  adxSeries: { adx: number; plusDi: number; minusDi: number }[];
}

function EmaAdxChartPanel({ candles, adxSeries }: ChartPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<{ remove: () => void } | null>(null);

  // EMA / SMA 시리즈 — useMemo 로 캔들 변경 시만 재계산.
  const indicatorSeries = useMemo(() => {
    const closes = candles.map((c) => c.close);
    return {
      ema9: calculateEMASeries(closes, 9),
      ema21: calculateEMASeries(closes, 21),
      ema50: calculateEMASeries(closes, 50),
      sma50: calculateSMASeries(closes, 50),
    };
  }, [candles]);

  const initChart = useCallback(async () => {
    if (!containerRef.current || candles.length === 0) return;

    const {
      createChart,
      CandlestickSeries,
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
      height: 420,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: COLOR.axisText,
        fontFamily: "'Share Tech Mono', 'JetBrains Mono', monospace",
        fontSize: 10,
      },
      grid: {
        vertLines: { color: COLOR.grid },
        horzLines: { color: COLOR.grid },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: COLOR.crosshair, width: 1, style: LineStyle.Dashed },
        horzLine: { color: COLOR.crosshair, width: 1, style: LineStyle.Dashed },
      },
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.1)",
        // 메인 영역 (캔들 + EMA) 은 상단 ~70%. 하단 30% 는 ADX 패널.
        scaleMargins: { top: 0.05, bottom: 0.32 },
      },
      timeScale: {
        borderColor: "rgba(255,255,255,0.1)",
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 4,
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

    // ── 캔들 시리즈 ─────────────────────────────────────────────────────
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: COLOR.candleUp,
      downColor: COLOR.candleDown,
      borderUpColor: COLOR.candleUp,
      borderDownColor: COLOR.candleDown,
      wickUpColor: COLOR.candleUpWick,
      wickDownColor: COLOR.candleDownWick,
    });

    const candleData = candles.map((c) => ({
      time: Math.floor(c.openTime / 1000) as never,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    candleSeries.setData(candleData);

    // ── EMA 시리즈 (9/21/50) ────────────────────────────────────────────
    // lightweight-charts 는 NaN/undefined 값을 만나면 라인이 끊김. EMA seed 가
    // running SMA 라 NaN 은 없음 — calculateEMASeries 구현 확인됨.
    const ema9Series = chart.addSeries(LineSeries, {
      color: COLOR.ema9,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerVisible: false,
      title: "EMA(9)",
    });
    ema9Series.setData(
      candles.map((c, i) => ({
        time: Math.floor(c.openTime / 1000) as never,
        value: indicatorSeries.ema9[i] ?? c.close,
      })),
    );

    const ema21Series = chart.addSeries(LineSeries, {
      color: COLOR.ema21,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerVisible: false,
      title: "EMA(21)",
    });
    ema21Series.setData(
      candles.map((c, i) => ({
        time: Math.floor(c.openTime / 1000) as never,
        value: indicatorSeries.ema21[i] ?? c.close,
      })),
    );

    const ema50Series = chart.addSeries(LineSeries, {
      color: COLOR.ema50,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerVisible: false,
      title: "EMA(50)",
    });
    ema50Series.setData(
      candles.map((c, i) => ({
        time: Math.floor(c.openTime / 1000) as never,
        value: indicatorSeries.ema50[i] ?? c.close,
      })),
    );

    // ── SMA(50) — 옅은 노랑 dashed (장기 컨텍스트) ──────────────────────
    const sma50Series = chart.addSeries(LineSeries, {
      color: COLOR.sma50,
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      title: "SMA(50)",
    });
    sma50Series.setData(
      candles.map((c, i) => ({
        time: Math.floor(c.openTime / 1000) as never,
        value: indicatorSeries.sma50[i] ?? c.close,
      })),
    );

    // ── ADX / ±DI 시리즈 — 별도 priceScale "adx" 하단 28% ───────────────
    // calculateADXSeries 는 초기 period*2 캔들에 대해 {adx:0, plusDi:0, minusDi:0}
    // 을 반환 — chart 시작 부분이 0 으로 박힘. 그대로 setData (라인이 0 에서
    // 출발하는 게 시각적으로 자연스러움 + 데이터 누락 아님 명시).
    const adxSeriesChart = chart.addSeries(LineSeries, {
      color: COLOR.adx,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerVisible: false,
      priceScaleId: "adx",
      title: "ADX",
    });
    adxSeriesChart.setData(
      candles.map((c, i) => ({
        time: Math.floor(c.openTime / 1000) as never,
        value: adxSeries[i]?.adx ?? 0,
      })),
    );

    const diPlusSeriesChart = chart.addSeries(LineSeries, {
      color: COLOR.diPlus,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerVisible: false,
      priceScaleId: "adx",
      title: "+DI",
    });
    diPlusSeriesChart.setData(
      candles.map((c, i) => ({
        time: Math.floor(c.openTime / 1000) as never,
        value: adxSeries[i]?.plusDi ?? 0,
      })),
    );

    const diMinusSeriesChart = chart.addSeries(LineSeries, {
      color: COLOR.diMinus,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerVisible: false,
      priceScaleId: "adx",
      title: "-DI",
    });
    diMinusSeriesChart.setData(
      candles.map((c, i) => ({
        time: Math.floor(c.openTime / 1000) as never,
        value: adxSeries[i]?.minusDi ?? 0,
      })),
    );

    // ADX 패널 priceScale 위치 — 하단 28%.
    chart.priceScale("adx").applyOptions({
      scaleMargins: { top: 0.72, bottom: 0.02 },
      borderColor: "rgba(255,255,255,0.1)",
    });

    // ── ADX 기준선 (20 = 약한 추세, 25 = 강한 추세) ────────────────────
    // 본 트래커 ENTRY 기준은 ADX_MIN=20, ADX_STRONG=30. 25 도 일반 강세 기준선.
    adxSeriesChart.createPriceLine({
      price: 20,
      color: COLOR.adxRef20,
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: "20",
    });
    adxSeriesChart.createPriceLine({
      price: 25,
      color: COLOR.adxRef25,
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: "25",
    });

    chart.timeScale().fitContent();

    // Resize handler.
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
  }, [candles, adxSeries, indicatorSeries]);

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

  if (candles.length === 0) {
    return (
      <p className="font-mono text-xs text-muted-foreground py-4">
        캔들 데이터 없음 — 잠시 후 다시 시도하세요.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div ref={containerRef} className="w-full" style={{ minHeight: 420 }} />
      {/* 범례 — EMA / SMA / ADX 색상 매핑 한눈에 */}
      <div className="flex flex-wrap items-center gap-3 px-1 pt-1 border-t border-border/20">
        <LegendDot color={COLOR.ema9} label="EMA(9)" />
        <LegendDot color={COLOR.ema21} label="EMA(21)" />
        <LegendDot color={COLOR.ema50} label="EMA(50)" />
        <LegendDot color={COLOR.sma50} label="SMA(50)" dashed />
        <span className="font-mono text-[9px] text-muted-foreground/60">|</span>
        <LegendDot color={COLOR.adx} label="ADX" />
        <LegendDot color={COLOR.diPlus} label="+DI" />
        <LegendDot color={COLOR.diMinus} label="-DI" />
        <span className="font-mono text-[9px] text-muted-foreground/60">|</span>
        <LegendDot color={COLOR.candleUp} label="UP" />
        <LegendDot color={COLOR.candleDown} label="DOWN" />
      </div>
    </div>
  );
}

function LegendDot({
  color,
  label,
  dashed,
}: {
  color: string;
  label: string;
  dashed?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        className="w-4 h-0.5"
        style={
          dashed
            ? { borderTop: `1px dashed ${color}` }
            : { backgroundColor: color }
        }
      />
      <span className="font-mono text-[9px] text-muted-foreground">{label}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 메인 ChartTab
// ---------------------------------------------------------------------------

export function ChartTab({ symbol, tf }: ChartTabProps) {
  // 백엔드 시그널 평가 — pass/fail breakdown + 실측 indicators 값.
  const { data, isLoading } = trpc.emaAdxTrend.evaluate.useQuery(
    { symbol, tf },
    { staleTime: 60_000, refetchOnWindowFocus: false },
  );

  // 클라이언트 캔들 + ADX 시리즈 — 차트 패널 입력. 200 캔들로 EMA(50) 안정화.
  const { data: detail, isLoading: detailLoading } = useCoinDetail(
    symbol,
    tf,
    200,
  );

  if ((isLoading && !data) || (detailLoading && !detail)) {
    return (
      <div className="flex items-center justify-center py-12 gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-neon-cyan" />
        <span className="font-mono text-xs text-muted-foreground">평가 중...</span>
      </div>
    );
  }

  if (!data) {
    return (
      <p className="font-mono text-xs text-muted-foreground py-4 text-center">
        데이터 없음
      </p>
    );
  }

  const b = data.breakdown;
  const p = data.prices;

  // 칩 detail 텍스트 — 백엔드 응답의 prices.* 실측값.
  // EmaAdxBreakdown 은 0~1 정규화 — pass 기준은 0.5 이상.
  // emaStack: 1 = 9>21>50 완전 정배열 / 0.5 = 일부 / 0 = 역배열
  // adx: ADX(14) 정규화 (20→0, 50+→1) — pass 는 ADX≥30 부근 부터 의미
  // diDiff: |+DI - -DI| / 25 클립 — pass 는 5+ 차이 부터 의미
  // smaSlope: SMA(50) 기울기 정규화 — pass 는 양수 기울기
  // structure: HH/HL fractal — boolean 0/1
  return (
    <div className="space-y-4">
      {/* ── 1. 5-component Pass / Fail 칩 ──────────────────────────── */}
      <HudPanel
        title="5-component Pass / Fail"
        subtitle={`${symbol} · ${tf.toUpperCase()} · final ${data.finalConfidence.toFixed(1)} / threshold ${data.threshold} · ${data.triggered ? "발행 중" : "미발생"}`}
      >
        <div className="flex flex-wrap gap-2">
          <Chip
            pass={b.emaStack >= 0.5}
            label="EMA정배열"
            detail={`9:${p.ema9.toFixed(4)} 21:${p.ema21.toFixed(4)} 50:${p.ema50.toFixed(4)}`}
          />
          <Chip
            pass={b.adx >= 0.5}
            label="ADX≥30"
            detail={`ADX ${p.adx.toFixed(1)}`}
          />
          <Chip
            pass={b.diDiff >= 0.5}
            label={data.side === "SHORT" ? "-DI > +DI" : "+DI > -DI"}
            detail={`+DI ${p.plusDi.toFixed(1)} / -DI ${p.minusDi.toFixed(1)}`}
          />
          <Chip
            pass={b.smaSlope >= 0.5}
            label="SMA50 기울기"
            detail={`SMA50 ${p.sma50.toFixed(4)}`}
          />
          <Chip
            pass={b.structure >= 0.5}
            label="HH/HL"
            detail={b.structure >= 0.5 ? "확인" : "미확인"}
          />
        </div>
        {data.reasons.length > 0 && (
          <ul className="mt-3 space-y-1 font-mono text-[10px] text-muted-foreground border-t border-border/20 pt-2">
            {data.reasons.slice(0, 4).map((r, i) => (
              <li key={i} className="leading-relaxed">· {r}</li>
            ))}
          </ul>
        )}
      </HudPanel>

      {/* ── 2. 캔들 + EMA Ribbon + ADX 차트 ─────────────────────────── */}
      <HudPanel
        title="캔들 + EMA(9/21/50) + SMA(50) · ADX/±DI"
        subtitle={`${symbol} · ${tf.toUpperCase()} · 200 캔들`}
      >
        {detail && detail.candles.length > 0 ? (
          <EmaAdxChartPanel
            candles={detail.candles}
            adxSeries={detail.adxSeries}
          />
        ) : (
          <p className="font-mono text-xs text-muted-foreground py-4 text-center">
            차트 데이터 로딩 중...
          </p>
        )}
      </HudPanel>

      {/* ── 3. 진입가 / Target / Stop (기존 유지) ────────────────────── */}
      <HudPanel
        title="진입가 / Target / Stop"
        subtitle={`${data.side} 시그널 — ${data.triggered ? "발행 중" : "미발생"}`}
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
          <div>
            <div className="text-muted-foreground text-[10px] uppercase tracking-wider">진입가</div>
            <div className="text-foreground font-bold">${p.price.toFixed(4)}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-[10px] uppercase tracking-wider">Target 1</div>
            <div className="text-neon-green font-bold">
              ${p.target1.toFixed(4)} ({p.target1Pct >= 0 ? "+" : ""}{p.target1Pct.toFixed(2)}%)
            </div>
          </div>
          <div>
            <div className="text-muted-foreground text-[10px] uppercase tracking-wider">Target 2</div>
            <div className="text-neon-green font-bold">
              ${p.target2.toFixed(4)} ({p.target2Pct >= 0 ? "+" : ""}{p.target2Pct.toFixed(2)}%)
            </div>
          </div>
          <div>
            <div className="text-muted-foreground text-[10px] uppercase tracking-wider">Stop Loss</div>
            <div className="text-neon-red font-bold">
              ${p.stopLoss.toFixed(4)} ({p.stopPct >= 0 ? "+" : ""}{p.stopPct.toFixed(2)}%)
            </div>
          </div>
        </div>
      </HudPanel>
    </div>
  );
}
