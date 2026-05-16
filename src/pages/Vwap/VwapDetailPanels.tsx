/**
 * VwapDetailPanels — `trpc.vwap.detail` 응답을 4개 시각화 패널로 분해.
 *
 * 백엔드 `vwap-detail.ts` 가 한 번에 반환하는 결과 (signal/signalV2, bands,
 * volumeProfile, pullbackV2, multiTfAlignment, vwapMult, candles) 를 다음 4개
 * sub-panel 로 분리:
 *  - VwapChartPanel:      캔들 + VWAP/EMA9/±1/2/3σ 밴드 오버레이
 *  - VolumeProfilePanel:  세로 horizontal-bar (HVN/LVN/POC/Value Area)
 *  - SignalCardV2:        5-component 분해 (signalV2 우선, fallback signal)
 *  - AlignmentCard:       multi-TF 정합 + multiplier
 *  - PullbackQualityCard: Pullback v2 detected/bounceConfirmed
 *
 * 헌장 규칙 3 준수: vwapMult 표시 시 "BBDX multiplier" 라는 점 명시.
 */

import { HudPanel } from "@/components/HudPanel";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ReferenceLine } from "recharts";
import { TrendingUp, TrendingDown, Check, X as IconX } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { computeVwapChartSeries } from "@/lib/vwap-engine";

// ---------------------------------------------------------------------------
// 타입 — 백엔드 d.ts 미러 (types-entry 에서 export 안 되어 인라인 정의)
// ---------------------------------------------------------------------------

export interface VwapBands {
  vwap: number;
  sigma: number;
  upper1: number;
  upper2: number;
  upper3: number;
  lower1: number;
  lower2: number;
  lower3: number;
}

export interface VolumeProfileBin {
  priceLow: number;
  priceHigh: number;
  volume: number;
}

export interface VolumeProfileValueArea {
  low: number;
  high: number;
  pct: number;
}

export interface VolumeProfile {
  bins: VolumeProfileBin[];
  poc: number;
  hvnList: number[];
  lvnList: number[];
  valueArea: VolumeProfileValueArea;
  totalVolume: number;
}

export interface PullbackQuality {
  detected: boolean;
  touchCandleIdx: number | null;
  bounceConfirmed: boolean;
  proximityRatio: number;
  touchedLine: "vwap" | "ema9" | null;
}

export interface VwapSignalLite {
  side: "LONG" | "SHORT";
  strength: number;
  reasons: string[];
}

export type AlignmentLevel = "aligned" | "partial" | "mixed" | "neutral";
export interface MultiTfAlignmentPerTf {
  side: "LONG" | "SHORT" | null;
  strength: number;
}
export interface MultiTfAlignment {
  tfs: ("1h" | "4h" | "1d")[];
  alignmentLevel: AlignmentLevel;
  perTf: Record<string, MultiTfAlignmentPerTf>;
  multiplier: number;
}

export interface CandleLite {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface VwapDetailLite {
  symbol: string;
  tf: "1h" | "4h" | "1d";
  candles: CandleLite[];
  vwap: number;
  ema9: number;
  bands: VwapBands;
  volumeProfile: VolumeProfile;
  pullbackV2: PullbackQuality;
  signal: VwapSignalLite | null;
  signalV2: VwapSignalLite | null;
  vwapMult: number;
  multiTfAlignment: MultiTfAlignment;
  computedAt: number;
}

// ---------------------------------------------------------------------------
// VwapMult chip — 헌장 규칙 3 (BBDX multiplier 시각화)
// ---------------------------------------------------------------------------

export function VwapMultChip({ vwapMult }: { vwapMult: number | undefined }) {
  if (vwapMult == null || !Number.isFinite(vwapMult)) {
    return (
      <span
        className="font-mono text-[10px] px-1.5 py-0.5 rounded-sm border border-border/30 text-muted-foreground"
        title="VWAP multiplier 데이터 없음"
      >
        VWAP n/a
      </span>
    );
  }
  const pct = (vwapMult - 1) * 100;
  const isPos = vwapMult > 1.05;
  const isNeg = vwapMult < 0.95;
  const cls = isPos
    ? "border-neon-green/40 text-neon-green bg-neon-green/5"
    : isNeg
      ? "border-neon-red/40 text-neon-red bg-neon-red/5"
      : "border-border/30 text-muted-foreground";
  const label = isPos
    ? `VWAP +${pct.toFixed(0)}%`
    : isNeg
      ? `VWAP ${pct.toFixed(0)}%`
      : "VWAP neutral";
  return (
    <span
      className={cn(
        "font-mono text-[10px] px-1.5 py-0.5 rounded-sm border",
        cls
      )}
      title={`헌장 규칙 3 — VWAP 시그널은 BBDX 진입 신뢰도 multiplier 로 통합. (현재 ${vwapMult.toFixed(2)}, 0.7~1.3 범위)`}
    >
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// VwapChartPanel — lightweight-charts 기반 캔들 차트 + VWAP/EMA9 + ±σ 밴드
//                  + 우측 Volume Profile DOM overlay
//
// 재설계 (2026-05-16):
//   문제 1) Recharts Line 차트 → lightweight-charts CandlestickSeries 로 교체.
//   문제 2) VWAP / EMA9 / Volume Profile 을 동일 차트 안에 통합.
//   문제 3) 캔들 색상을 neon-cyan/neon-red 진하게 + grid opacity 낮춤.
//   문제 4) 스칼라 한 점을 시리즈로 박는 버그 → vwap-engine 으로 캔들별 rolling 계산.
//
// Volume Profile 통합 — 옵션 1 (DOM overlay).
//   lightweight-charts v5 의 `priceScale().priceToCoordinate(price)` 로
//   Y 픽셀 좌표를 얻어 우측에서 좌측으로 horizontal histogram 을 SVG 로 그림.
//   캔버스를 안 쓰는 이유: SVG 가 zoom/resize 시 React state 재계산 단순.
//   기존 `<VolumeProfilePanel>` (상세 패널) 은 그대로 유지 — overlay 는 직관, 패널은 정량.
// ---------------------------------------------------------------------------

// 색상 팔레트 — cyberpunk neon (RGBA / hex). lightweight-charts API 가 oklch 미지원.
const COLOR = {
  candleUp: "#00f0ff",         // neon-cyan
  candleDown: "#ff4e82",       // neon-red/pink
  candleUpWick: "rgba(0, 240, 255, 0.7)",
  candleDownWick: "rgba(255, 78, 130, 0.7)",
  vwap: "#FFD700",             // 노랑 — 핵심 reference
  ema9: "#FF2EA0",             // neon-magenta
  band1: "rgba(255, 200, 100, 0.55)",
  band2: "rgba(255, 200, 100, 0.40)",
  band3: "rgba(255, 200, 100, 0.25)",
  bandLow1: "rgba(120, 200, 255, 0.55)",
  bandLow2: "rgba(120, 200, 255, 0.40)",
  bandLow3: "rgba(120, 200, 255, 0.25)",
  grid: "rgba(255,255,255,0.05)",
  axisText: "#888",
  crosshair: "rgba(0,229,255,0.3)",
  vpPoc: "rgba(255, 46, 160, 0.85)",      // POC — neon-pink 진하게
  vpHvn: "rgba(0, 240, 255, 0.70)",        // HVN — neon-cyan
  vpLvn: "rgba(180, 180, 180, 0.30)",      // LVN — 흐림
  vpInVA: "rgba(0, 240, 255, 0.45)",       // Value Area 내부
  vpDefault: "rgba(0, 240, 255, 0.35)",
};

/**
 * Volume Profile overlay 의 단일 bin 메타데이터.
 * Y 픽셀 좌표는 차트 재렌더 시 priceToCoordinate 로 즉시 갱신되므로 state 에 저장.
 */
interface VpRow {
  yTop: number;
  yBottom: number;
  widthPct: number;
  color: string;
  label?: string;
}

export function VwapChartPanel({ detail }: { detail: VwapDetailLite }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<{ remove: () => void } | null>(null);
  const seriesApiRef = useRef<{
    priceToCoordinate: (price: number) => number | null;
  } | null>(null);

  const [vpRows, setVpRows] = useState<VpRow[]>([]);

  // 클라이언트 사이드 rolling 시리즈 — 백엔드 detail 은 스칼라만 주므로 재계산.
  const series = useMemo(() => computeVwapChartSeries(detail.candles, 9), [detail.candles]);

  /**
   * Volume Profile bin 좌표 재계산.
   * priceToCoordinate 는 차트 zoom/scroll/resize 후 매번 다른 값을 반환하므로
   * timeScale / priceScale change 이벤트 마다 호출되어야 한다.
   */
  const recomputeVpRows = useCallback(() => {
    const api = seriesApiRef.current;
    const profile = detail.volumeProfile;
    if (!api || !profile || profile.bins.length === 0) {
      setVpRows([]);
      return;
    }
    const maxVol = profile.bins.reduce((m, b) => (b.volume > m ? b.volume : m), 0);
    if (maxVol <= 0) {
      setVpRows([]);
      return;
    }
    const hvnSet = new Set(profile.hvnList);
    const lvnSet = new Set(profile.lvnList);
    const va = profile.valueArea;
    const rows: VpRow[] = [];
    for (const bin of profile.bins) {
      const yHigh = api.priceToCoordinate(bin.priceHigh);
      const yLow = api.priceToCoordinate(bin.priceLow);
      if (yHigh == null || yLow == null) continue;
      const mid = (bin.priceLow + bin.priceHigh) / 2;
      const isPoc = Math.abs(mid - profile.poc) < 1e-9;
      const isHvn = hvnSet.has(mid);
      const isLvn = lvnSet.has(mid);
      const inVA = mid >= va.low && mid <= va.high;
      const color = isPoc
        ? COLOR.vpPoc
        : isHvn
          ? COLOR.vpHvn
          : isLvn
            ? COLOR.vpLvn
            : inVA
              ? COLOR.vpInVA
              : COLOR.vpDefault;
      rows.push({
        yTop: Math.min(yHigh, yLow),
        yBottom: Math.max(yHigh, yLow),
        widthPct: (bin.volume / maxVol) * 100,
        color,
        label: isPoc ? "POC" : undefined,
      });
    }
    setVpRows(rows);
  }, [detail.volumeProfile]);

  // 차트 초기화 — useCallback 으로 deps 안정화.
  const initChart = useCallback(async () => {
    if (!containerRef.current || detail.candles.length === 0) return;

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
      height: 360,
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
        scaleMargins: { top: 0.08, bottom: 0.22 }, // 하단 22% 는 볼륨 패널.
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

    // ── 캔들 시리즈 ──────────────────────────────────────────────────────
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: COLOR.candleUp,
      downColor: COLOR.candleDown,
      borderUpColor: COLOR.candleUp,
      borderDownColor: COLOR.candleDown,
      wickUpColor: COLOR.candleUpWick,
      wickDownColor: COLOR.candleDownWick,
    });

    seriesApiRef.current = {
      priceToCoordinate: (price: number) => candleSeries.priceToCoordinate(price),
    };

    const candleData = detail.candles.map((c) => ({
      time: Math.floor(c.timestamp / 1000) as never,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    candleSeries.setData(candleData);

    // ── 볼륨 시리즈 (하단 패널) ─────────────────────────────────────────
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
      color: "rgba(100,100,255,0.4)",
    });
    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    });
    volumeSeries.setData(
      detail.candles.map((c) => ({
        time: Math.floor(c.timestamp / 1000) as never,
        value: c.volume,
        color: c.close >= c.open ? "rgba(0,240,255,0.4)" : "rgba(255,78,130,0.4)",
      }))
    );

    // ── VWAP 라인 (굵은 노랑) ───────────────────────────────────────────
    const vwapLine = chart.addSeries(LineSeries, {
      color: COLOR.vwap,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerVisible: false,
      title: "VWAP",
    });
    vwapLine.setData(
      detail.candles.map((c, i) => ({
        time: Math.floor(c.timestamp / 1000) as never,
        value: series.vwap[i],
      }))
    );

    // ── EMA(9) 라인 (neon-magenta) ──────────────────────────────────────
    const emaLine = chart.addSeries(LineSeries, {
      color: COLOR.ema9,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerVisible: false,
      title: "EMA(9)",
    });
    emaLine.setData(
      detail.candles.map((c, i) => ({
        time: Math.floor(c.timestamp / 1000) as never,
        value: series.ema9[i],
      }))
    );

    // ── ±σ 밴드 라인 6개 (dashed, 옅음) ─────────────────────────────────
    const bandConfigs: {
      key: keyof typeof series.bands;
      color: string;
      width: 1;
      label: string;
    }[] = [
      { key: "upper3", color: COLOR.band3, width: 1, label: "+3σ" },
      { key: "upper2", color: COLOR.band2, width: 1, label: "+2σ" },
      { key: "upper1", color: COLOR.band1, width: 1, label: "+1σ" },
      { key: "lower1", color: COLOR.bandLow1, width: 1, label: "-1σ" },
      { key: "lower2", color: COLOR.bandLow2, width: 1, label: "-2σ" },
      { key: "lower3", color: COLOR.bandLow3, width: 1, label: "-3σ" },
    ];
    for (const cfg of bandConfigs) {
      const line = chart.addSeries(LineSeries, {
        color: cfg.color,
        lineWidth: cfg.width,
        lineStyle: LineStyle.Dashed,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
        title: cfg.label,
      });
      line.setData(
        detail.candles.map((c, i) => ({
          time: Math.floor(c.timestamp / 1000) as never,
          value: series.bands[cfg.key][i],
        }))
      );
    }

    chart.timeScale().fitContent();

    // ── Volume Profile overlay 좌표 재계산 트리거 ──────────────────────
    // 차트 timeScale 변경 / priceScale autoscale 발생 시마다 priceToCoordinate
    // 결과가 달라지므로, subscribe 콜백에서 setState.
    recomputeVpRows();
    const subscription = chart.timeScale().subscribeVisibleTimeRangeChange(() => {
      recomputeVpRows();
    });

    // Resize handler — container 폭 변경 + Y 축 픽셀 좌표 재계산.
    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
        // priceToCoordinate 가 즉시 갱신 안 될 수 있어 다음 frame 에 재계산.
        requestAnimationFrame(recomputeVpRows);
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      try {
        chart.timeScale().unsubscribeVisibleTimeRangeChange(subscription as never);
      } catch {
        // ignore
      }
      chart.remove();
    };
  }, [detail.candles, series, recomputeVpRows]);

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
      seriesApiRef.current = null;
    };
  }, [initChart]);

  if (detail.candles.length === 0) {
    return (
      <p className="font-mono text-xs text-muted-foreground py-4">
        캔들 데이터 없음 — 잠시 후 다시 시도하세요.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <div ref={containerRef} className="w-full" style={{ minHeight: 360 }} />
        {/* Volume Profile overlay — 우측에서 좌측으로 가로 막대. 차트 영역 위 */}
        {/* 절대 위치 SVG (pointer-events: none 으로 차트 인터랙션 방해 안 함). */}
        {vpRows.length > 0 && (
          <svg
            className="pointer-events-none absolute inset-0"
            width="100%"
            height="100%"
            style={{ overflow: "visible" }}
          >
            {vpRows.map((row, i) => {
              const height = Math.max(1, row.yBottom - row.yTop);
              // 차트 우측 끝에서 안쪽으로 max 22% 폭의 막대.
              const widthPct = (row.widthPct / 100) * 22;
              return (
                <g key={i}>
                  <rect
                    x={`${100 - widthPct - 6}%`}
                    y={row.yTop}
                    width={`${widthPct}%`}
                    height={height}
                    fill={row.color}
                  />
                  {row.label && (
                    <text
                      x="98%"
                      y={(row.yTop + row.yBottom) / 2 + 3}
                      textAnchor="end"
                      fontFamily="Share Tech Mono"
                      fontSize="9"
                      fill="#ff2ea0"
                    >
                      {row.label}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        )}
      </div>
      {/* 범례 — 라인 매핑 한눈에 */}
      <div className="flex flex-wrap items-center gap-3 px-1 pt-1 border-t border-border/20">
        <LegendDot color={COLOR.vwap} label="VWAP" />
        <LegendDot color={COLOR.ema9} label="EMA(9)" />
        <LegendDot color={COLOR.band1} label="±1σ" dashed />
        <LegendDot color={COLOR.band2} label="±2σ" dashed />
        <LegendDot color={COLOR.band3} label="±3σ" dashed />
        <LegendDot color={COLOR.candleUp} label="UP" />
        <LegendDot color={COLOR.candleDown} label="DOWN" />
        <LegendDot color={COLOR.vpPoc} label="POC" />
        <LegendDot color={COLOR.vpHvn} label="HVN" />
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
// VolumeProfilePanel — 가격(Y) × 거래량(X) horizontal bar
// ---------------------------------------------------------------------------

export function VolumeProfilePanel({ profile }: { profile: VolumeProfile }) {
  if (!profile || profile.bins.length === 0) {
    return (
      <p className="font-mono text-xs text-muted-foreground py-4">
        Volume Profile 데이터 없음
      </p>
    );
  }
  const maxVol = profile.bins.reduce((m, b) => (b.volume > m ? b.volume : m), 0);
  const hvnSet = new Set(profile.hvnList);
  const lvnSet = new Set(profile.lvnList);
  const va = profile.valueArea;

  return (
    <div className="space-y-1">
      <div className="font-mono text-[10px] text-muted-foreground flex justify-between mb-2">
        <span>POC: ${profile.poc.toFixed(4)}</span>
        <span>
          HVN {profile.hvnList.length} · LVN {profile.lvnList.length}
        </span>
      </div>
      <div className="space-y-[1px]">
        {/* 가격 높은 bin 부터 표시 (위 → 아래) */}
        {[...profile.bins].reverse().map((bin, i) => {
          const mid = (bin.priceLow + bin.priceHigh) / 2;
          const widthPct = maxVol > 0 ? (bin.volume / maxVol) * 100 : 0;
          const isPoc = Math.abs(mid - profile.poc) < 1e-9;
          const isHvn = hvnSet.has(mid);
          const isLvn = lvnSet.has(mid);
          const inVA = mid >= va.low && mid <= va.high;
          return (
            <div
              key={i}
              className={cn(
                "relative flex items-center gap-2 h-4 px-1",
                inVA && "bg-neon-cyan/5"
              )}
              title={
                isPoc
                  ? "POC (Point of Control)"
                  : isHvn
                    ? "HVN (High Volume Node)"
                    : isLvn
                      ? "LVN (Low Volume Node)"
                      : undefined
              }
            >
              <span className="font-mono text-[8px] text-muted-foreground w-14 text-right shrink-0">
                ${mid.toFixed(mid < 1 ? 5 : 2)}
              </span>
              <div className="flex-1 h-3 bg-muted/10 relative overflow-hidden rounded-sm">
                <div
                  className={cn(
                    "h-full transition-all",
                    isPoc
                      ? "bg-neon-pink/80"
                      : isHvn
                        ? "bg-neon-cyan/70"
                        : isLvn
                          ? "bg-muted-foreground/20"
                          : "bg-neon-cyan/30"
                  )}
                  style={{ width: `${widthPct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      {va.pct > 0 && (
        <div className="pt-2 mt-2 border-t border-border/20 font-mono text-[9px] text-muted-foreground">
          Value Area: ${va.low.toFixed(4)} ~ ${va.high.toFixed(4)} ·{" "}
          {(va.pct * 100).toFixed(0)}%
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SignalCardV2 — 5-component 분해 표
// ---------------------------------------------------------------------------

/**
 * 5-component breakdown — 백엔드 `signalV2` 의 strength 산출 비율 (총 100):
 *   VWAP 거리   : 25
 *   EMA(9) 위치: 20
 *   EMA 되돌림  : 25 (Pullback v2 의 bounceConfirmed → 25, 단순 detected → ~12)
 *   VP 지지(HVN/POC) : 15
 *   VP 구조(LVN 위) : 15
 *
 * 백엔드는 strength 만 노출하므로, breakdown 은 UI 측에서 detail 의 보조
 * 데이터 (pullbackV2, volumeProfile) 로 추정 표시. 정확한 값을 보장하지 않음.
 */
export function SignalCardV2({ detail }: { detail: VwapDetailLite }) {
  const sig = detail.signalV2 ?? detail.signal;
  const isV2 = !!detail.signalV2;
  const totalStrength = sig?.strength ?? 0;

  // breakdown 추정 (백엔드 산식과 1:1 매칭은 아님 — 사용자에게 weighting 안내 목적)
  const components = useMemo(() => {
    const pb = detail.pullbackV2;
    const vp = detail.volumeProfile;
    const vpHasHvn = vp.hvnList.length > 0;
    const vpHasLvn = vp.lvnList.length > 0;
    return [
      {
        label: "VWAP 거리",
        weight: 25,
        score: sig ? Math.min(25, totalStrength * 0.25) : 0,
      },
      {
        label: "EMA(9) 위치",
        weight: 20,
        score: sig ? Math.min(20, totalStrength * 0.2) : 0,
      },
      {
        label: "EMA 되돌림",
        weight: 25,
        score: pb.bounceConfirmed ? 25 : pb.detected ? 12 : 0,
      },
      {
        label: "VP 지지 (HVN/POC)",
        weight: 15,
        score: vpHasHvn ? 15 : 0,
      },
      {
        label: "VP 구조 (LVN 위)",
        weight: 15,
        score: vpHasLvn ? 15 : 0,
      },
    ];
  }, [detail, sig, totalStrength]);

  return (
    <HudPanel
      title="VWAP Signal v2"
      subtitle={isV2 ? "5-COMPONENT" : "4-COMPONENT (LEGACY)"}
      variant={sig ? "highlight" : "default"}
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          {sig?.side === "LONG" ? (
            <Badge className="bg-neon-green/20 text-neon-green border-neon-green/40 font-mono text-xs px-2 py-0.5">
              <TrendingUp className="h-3 w-3 mr-0.5" />
              LONG
            </Badge>
          ) : sig?.side === "SHORT" ? (
            <Badge className="bg-neon-red/20 text-neon-red border-neon-red/40 font-mono text-xs px-2 py-0.5">
              <TrendingDown className="h-3 w-3 mr-0.5" />
              SHORT
            </Badge>
          ) : (
            <Badge className="bg-muted/30 text-muted-foreground border-border/40 font-mono text-xs px-2 py-0.5">
              NO SIGNAL
            </Badge>
          )}
          <span className="font-display text-xl font-bold text-neon-cyan">
            {totalStrength}
            <span className="text-muted-foreground text-sm">/100</span>
          </span>
        </div>

        <div className="h-1.5 bg-muted/30 rounded-sm overflow-hidden">
          <div
            className={cn(
              "h-full transition-all",
              totalStrength >= 70
                ? "bg-neon-green"
                : totalStrength >= 50
                  ? "bg-neon-yellow"
                  : "bg-neon-cyan"
            )}
            style={{ width: `${totalStrength}%` }}
          />
        </div>

        <div className="space-y-1.5">
          {components.map((c) => (
            <div key={c.label} className="flex items-center gap-2">
              <span className="font-mono text-[10px] text-muted-foreground flex-1">
                {c.label}
              </span>
              <div className="w-20 h-1 bg-muted/30 rounded-sm overflow-hidden">
                <div
                  className="h-full bg-neon-cyan/70"
                  style={{
                    width: `${(c.score / c.weight) * 100}%`,
                  }}
                />
              </div>
              <span className="font-mono text-[10px] text-foreground w-10 text-right">
                {c.score.toFixed(0)}/{c.weight}
              </span>
            </div>
          ))}
        </div>

        {sig && sig.reasons.length > 0 && (
          <div className="pt-2 border-t border-border/20">
            <ul className="space-y-0.5">
              {sig.reasons.slice(0, 5).map((r, i) => (
                <li
                  key={i}
                  className="font-mono text-[10px] text-foreground/80"
                >
                  • {r}
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="font-mono text-[9px] text-muted-foreground/70 pt-2 border-t border-border/20 leading-relaxed">
          ⚠ 본 시그널은 BBDX 보조 차원 (multiplier-only). 단독 매매 신호 X. 헌장 규칙 3.
        </p>
      </div>
    </HudPanel>
  );
}

// ---------------------------------------------------------------------------
// AlignmentCard — Multi-TF 정합
// ---------------------------------------------------------------------------

const ALIGNMENT_BADGE: Record<AlignmentLevel, { label: string; cls: string }> = {
  aligned: {
    label: "ALIGNED",
    cls: "bg-neon-green/20 text-neon-green border-neon-green/40",
  },
  partial: {
    label: "PARTIAL",
    cls: "bg-neon-yellow/20 text-neon-yellow border-neon-yellow/40",
  },
  mixed: {
    label: "MIXED",
    cls: "bg-neon-orange/20 text-neon-pink border-neon-pink/40",
  },
  neutral: {
    label: "NEUTRAL",
    cls: "bg-muted/30 text-muted-foreground border-border/40",
  },
};

export function AlignmentCard({ alignment }: { alignment: MultiTfAlignment }) {
  const badge = ALIGNMENT_BADGE[alignment.alignmentLevel];
  return (
    <HudPanel title="Multi-TF Alignment" subtitle="1H · 4H · 1D">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Badge
            className={cn("font-mono text-xs px-2 py-0.5 border", badge.cls)}
          >
            {badge.label}
          </Badge>
          <span className="font-mono text-xs text-neon-cyan">
            ×{alignment.multiplier.toFixed(2)}
          </span>
        </div>

        <div className="space-y-1.5">
          {alignment.tfs.map((tf) => {
            const per = alignment.perTf[tf];
            const sideCls =
              per?.side === "LONG"
                ? "text-neon-green"
                : per?.side === "SHORT"
                  ? "text-neon-red"
                  : "text-muted-foreground";
            return (
              <div
                key={tf}
                className="flex items-center justify-between font-mono text-[11px]"
              >
                <span className="text-muted-foreground uppercase tracking-wider">
                  {tf}
                </span>
                <span className={cn("flex items-center gap-2", sideCls)}>
                  <span>{per?.side ?? "NEUTRAL"}</span>
                  <span className="text-foreground/60">
                    {per?.strength != null ? `${per.strength.toFixed(0)}%` : "—"}
                  </span>
                </span>
              </div>
            );
          })}
        </div>

        <p className="font-mono text-[9px] text-muted-foreground/70 pt-2 border-t border-border/20 leading-relaxed">
          1H/4H/1D VWAP 정렬 시 시그널 신뢰도 가산 (aligned ×1.15 · partial ×1.05 ·
          mixed ×0.95 · neutral ×1.00).
        </p>
      </div>
    </HudPanel>
  );
}

// ---------------------------------------------------------------------------
// PullbackQualityCard — Pullback v2
// ---------------------------------------------------------------------------

export function PullbackQualityCard({
  pullback,
}: {
  pullback: PullbackQuality;
}) {
  return (
    <HudPanel title="Pullback v2" subtitle="VWAP/EMA TOUCH + BOUNCE">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col items-center gap-1 p-2 rounded-sm border border-border/20 bg-card/40">
            {pullback.detected ? (
              <Check className="h-5 w-5 text-neon-cyan" />
            ) : (
              <IconX className="h-5 w-5 text-muted-foreground/50" />
            )}
            <span className="font-mono text-[10px] text-muted-foreground uppercase">
              Detected
            </span>
          </div>
          <div className="flex flex-col items-center gap-1 p-2 rounded-sm border border-border/20 bg-card/40">
            {pullback.bounceConfirmed ? (
              <Check className="h-5 w-5 text-neon-green" />
            ) : (
              <IconX className="h-5 w-5 text-muted-foreground/50" />
            )}
            <span className="font-mono text-[10px] text-muted-foreground uppercase">
              Bounce
            </span>
          </div>
        </div>

        <div className="space-y-1 font-mono text-[10px]">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Touched Line</span>
            <span className="text-foreground">
              {pullback.touchedLine ? pullback.touchedLine.toUpperCase() : "—"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Proximity</span>
            <span className="text-foreground">
              {(pullback.proximityRatio * 100).toFixed(1)}%
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Touch Idx</span>
            <span className="text-foreground">
              {pullback.touchCandleIdx ?? "—"}
            </span>
          </div>
        </div>

        <p className="font-mono text-[9px] text-muted-foreground/70 pt-2 border-t border-border/20 leading-relaxed">
          최근 5캔들 내 VWAP/EMA 터치 + 다음 캔들 반등 확인 시 5-component score 의
          EMA 되돌림 25점 풀로 가산.
        </p>
      </div>
    </HudPanel>
  );
}

// dummy import to keep ReferenceLine usage ready for future overlay markers
export const _refLine = ReferenceLine;
