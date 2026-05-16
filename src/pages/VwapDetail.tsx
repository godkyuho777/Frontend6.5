/**
 * VwapDetail — VWAP Strategy 의 코인별 deep-dive 페이지.
 *
 * Vwap 페이지에서 코인 row 를 더블클릭하면 진입. 기존엔 `/coin/:symbol`
 * (BBDX detail) 로 이동했지만 사용자 의도와 다름. 본 페이지는 VWAP 전용:
 *   - 메인 차트: 캔들(OHLC) + VWAP + EMA9 + ±1/2/3σ 밴드
 *   - 하단 차트: 시간축 거래량 Histogram
 *   - 우측 패널: 5-component 시그널, multi-TF 정합, pullback v2, volume profile
 *
 * 헌장 규칙 3 준수 — vwapMult 는 BBDX multiplier 로만 표기.
 */

import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "wouter";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Cell,
} from "recharts";
import { ArrowLeft, Activity, Loader2 } from "lucide-react";

import { HudPanel } from "@/components/HudPanel";
import { TimeRangeSegmented } from "@/components/TimeRangeSegmented";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useVwapDetail } from "@/pages/CoinDetail/hooks/useVwapDetail";
import {
  VolumeProfilePanel,
  SignalCardV2,
  AlignmentCard,
  PullbackQualityCard,
  VwapMultChip,
  type VwapDetailLite,
  type CandleLite,
} from "@/pages/Vwap/VwapDetailPanels";

type TF = "1h" | "4h" | "1d";
const TF_OPTIONS: TF[] = ["1h", "4h", "1d"];

// ─── Custom Candlestick Shape for Recharts Bar ───────────────────────────────
// Recharts 는 기본 candlestick 미지원 → Bar shape prop 으로 커스텀 그림.
// Each datum: { idx, open, high, low, close, ... }
// Bar 의 dataKey 는 [low, high] tuple 대신 단일 number 가 필요해서, body 는
// `closeOpen` 영역 (Math.abs(close - open)) 으로, wick 는 별도 SVG line 으로.
//
// Approach: Bar `dataKey = "candle"` 에 wick+body 를 모두 그리는 shape function.
// Recharts 가 props.x/width 는 자동 산정해주므로 그걸 활용.

interface CandleShapeProps {
  // Recharts 가 주입하는 표준 props
  x?: number;
  y?: number; // unused
  width?: number;
  height?: number; // unused
  payload?: {
    idx: number;
    open: number;
    high: number;
    low: number;
    close: number;
  };
  // 외부에서 주입하는 가격→픽셀 변환기
  priceToY?: (price: number) => number;
}

function Candle(props: CandleShapeProps) {
  const { x, width, payload, priceToY } = props;
  if (!payload || x == null || width == null || !priceToY) return null;
  const { open, high, low, close } = payload;
  const isUp = close >= open;
  const color = isUp ? "#10b981" /* green-500 */ : "#ef4444"; /* red-500 */
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
      {/* wick */}
      <line
        x1={cx}
        y1={yHigh}
        x2={cx}
        y2={yLow}
        stroke={color}
        strokeWidth={1}
      />
      {/* body */}
      <rect
        x={bodyX}
        y={bodyTop}
        width={bodyW}
        height={bodyH}
        fill={color}
        stroke={color}
      />
    </g>
  );
}

// ─── Main Chart Component ────────────────────────────────────────────────────

function VwapCandleChart({ detail }: { detail: VwapDetailLite }) {
  const candles = detail.candles ?? [];
  const { bands, vwap, ema9 } = detail;

  const data = useMemo(() => {
    return candles.map((c: CandleLite, i: number) => ({
      idx: i,
      ts: c.openTime,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      // Bar 데이터 키 — shape 에 payload 만 전달하면 되므로 high 사용 (수직 영역 차지)
      candle: c.high,
      vwap,
      ema9,
      upper1: bands.upper1,
      upper2: bands.upper2,
      upper3: bands.upper3,
      lower1: bands.lower1,
      lower2: bands.lower2,
      lower3: bands.lower3,
    }));
  }, [candles, bands, vwap, ema9]);

  // 가격축 (Y) 범위 — 캔들 + 밴드 포함해 동적 산정
  const yDomain = useMemo<[number, number]>(() => {
    if (data.length === 0) return [0, 1];
    let lo = Infinity;
    let hi = -Infinity;
    for (const d of data) {
      if (d.low < lo) lo = d.low;
      if (d.high > hi) hi = d.high;
    }
    const lower3Min = bands.lower3 || lo;
    const upper3Max = bands.upper3 || hi;
    lo = Math.min(lo, lower3Min);
    hi = Math.max(hi, upper3Max);
    const pad = (hi - lo) * 0.05;
    return [lo - pad, hi + pad];
  }, [data, bands]);

  // priceToY 계산 — Recharts Y 축 height 는 outer chart 의 plot area height.
  // ResponsiveContainer 의 height 가 320px 기준. CartesianGrid 의 inner area 는
  // 약 290px (margins top:8/bottom:24 제외). 정확한 변환은 Recharts 의 내부
  // scale 을 직접 못 받으니, candle shape 에서 props.height 활용 대신
  // chartHeight 와 yDomain 으로 수동 계산.
  const chartHeight = 320;
  const chartTopPad = 8;
  const chartBottomPad = 24;
  const plotH = chartHeight - chartTopPad - chartBottomPad;

  const priceToY = useMemo(() => {
    const [lo, hi] = yDomain;
    const range = hi - lo || 1;
    return (price: number) => {
      const ratio = (price - lo) / range;
      // y 좌표 — Recharts 는 top-down, 0 = top. ratio 1 → 위, ratio 0 → 아래.
      return chartTopPad + (1 - ratio) * plotH;
    };
  }, [yDomain]);

  if (data.length === 0) {
    return (
      <p className="font-mono text-xs text-muted-foreground py-8 text-center">
        캔들 데이터 없음 — 잠시 후 다시 시도하세요.
      </p>
    );
  }

  return (
    <div className="w-full" style={{ height: `${chartHeight}px` }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: chartTopPad, right: 8, left: 0, bottom: 0 }}
        >
          <CartesianGrid stroke="oklch(0.3 0 0 / 0.3)" strokeDasharray="2 4" />
          <XAxis
            dataKey="idx"
            tick={{ fontSize: 10, fontFamily: "Fragment Mono" }}
            stroke="oklch(0.6 0 0)"
          />
          <YAxis
            domain={yDomain}
            tick={{ fontSize: 10, fontFamily: "Fragment Mono" }}
            stroke="oklch(0.6 0 0)"
            width={64}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "oklch(0.18 0 0 / 0.95)",
              border: "1px solid oklch(0.4 0.15 280)",
              fontFamily: "Fragment Mono",
              fontSize: "11px",
            }}
            labelFormatter={v => `Candle #${v}`}
            formatter={(value: number | string, name: string, item) => {
              if (typeof value !== "number") return [value, name];
              // candle 시리즈는 OHLC 모두 표시
              if (name === "candle" && item?.payload) {
                const p = item.payload as {
                  open: number;
                  high: number;
                  low: number;
                  close: number;
                };
                return [
                  `O ${p.open.toFixed(4)} / H ${p.high.toFixed(4)} / L ${p.low.toFixed(4)} / C ${p.close.toFixed(4)}`,
                  "OHLC",
                ];
              }
              return [value.toFixed(4), name];
            }}
          />
          {/* ±3σ / ±2σ / ±1σ 밴드 — 얇은 점선 (Bands) */}
          <Line
            type="monotone"
            dataKey="upper3"
            stroke="oklch(0.7 0.15 30 / 0.4)"
            strokeWidth={1}
            strokeDasharray="2 3"
            dot={false}
            isAnimationActive={false}
            name="+3σ"
          />
          <Line
            type="monotone"
            dataKey="upper2"
            stroke="oklch(0.7 0.15 30 / 0.6)"
            strokeWidth={1}
            strokeDasharray="3 3"
            dot={false}
            isAnimationActive={false}
            name="+2σ"
          />
          <Line
            type="monotone"
            dataKey="upper1"
            stroke="oklch(0.7 0.15 30 / 0.7)"
            strokeWidth={1}
            strokeDasharray="1 2"
            dot={false}
            isAnimationActive={false}
            name="+1σ"
          />
          <Line
            type="monotone"
            dataKey="lower1"
            stroke="oklch(0.7 0.15 200 / 0.7)"
            strokeWidth={1}
            strokeDasharray="1 2"
            dot={false}
            isAnimationActive={false}
            name="-1σ"
          />
          <Line
            type="monotone"
            dataKey="lower2"
            stroke="oklch(0.7 0.15 200 / 0.6)"
            strokeWidth={1}
            strokeDasharray="3 3"
            dot={false}
            isAnimationActive={false}
            name="-2σ"
          />
          <Line
            type="monotone"
            dataKey="lower3"
            stroke="oklch(0.7 0.15 200 / 0.4)"
            strokeWidth={1}
            strokeDasharray="2 3"
            dot={false}
            isAnimationActive={false}
            name="-3σ"
          />
          {/* VWAP — 노란색 실선 (사용자 명시 "VWAP과 EMA를 선으로") */}
          <Line
            type="monotone"
            dataKey="vwap"
            stroke="oklch(0.85 0.18 95)"
            strokeWidth={1.8}
            dot={false}
            isAnimationActive={false}
            name="VWAP"
          />
          {/* EMA(9) — 청록색 실선 */}
          <Line
            type="monotone"
            dataKey="ema9"
            stroke="oklch(0.75 0.15 200)"
            strokeWidth={1.8}
            dot={false}
            isAnimationActive={false}
            name="EMA(9)"
          />
          {/* Candles — 사용자 명시 "각 암호화폐별 가격들을 캔들로 표기" */}
          <Bar
            dataKey="candle"
            shape={(p: object) => (
              <Candle {...(p as CandleShapeProps)} priceToY={priceToY} />
            )}
            isAnimationActive={false}
            legendType="none"
            name="OHLC"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Volume Histogram (시간축) ──────────────────────────────────────────────

function VolumeHistogram({ detail }: { detail: VwapDetailLite }) {
  const candles = detail.candles ?? [];
  const data = useMemo(() => {
    return candles.map((c, i) => ({
      idx: i,
      volume: c.volume,
      up: c.close >= c.open,
    }));
  }, [candles]);

  if (data.length === 0) {
    return (
      <p className="font-mono text-xs text-muted-foreground py-4 text-center">
        Volume 데이터 없음
      </p>
    );
  }

  return (
    <div className="h-32 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
          <CartesianGrid stroke="oklch(0.3 0 0 / 0.2)" strokeDasharray="2 4" />
          <XAxis
            dataKey="idx"
            tick={{ fontSize: 10, fontFamily: "Fragment Mono" }}
            stroke="oklch(0.6 0 0)"
          />
          <YAxis
            tick={{ fontSize: 10, fontFamily: "Fragment Mono" }}
            stroke="oklch(0.6 0 0)"
            width={64}
            tickFormatter={v =>
              v >= 1e6
                ? `${(v / 1e6).toFixed(1)}M`
                : v >= 1e3
                  ? `${(v / 1e3).toFixed(0)}K`
                  : v.toFixed(0)
            }
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "oklch(0.18 0 0 / 0.95)",
              border: "1px solid oklch(0.4 0.15 280)",
              fontFamily: "Fragment Mono",
              fontSize: "11px",
            }}
            labelFormatter={v => `Candle #${v}`}
            formatter={(value: number) => [value.toLocaleString(), "Volume"]}
          />
          <Bar dataKey="volume" isAnimationActive={false}>
            {data.map((d, i) => (
              <Cell
                key={i}
                fill={d.up ? "#10b981" : "#ef4444"}
                fillOpacity={0.6}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function VwapDetail() {
  const params = useParams<{ symbol: string }>();
  const [, setLocation] = useLocation();
  const symbol = (params?.symbol ?? "").toUpperCase();

  // TF: URL ?tf=... 파싱 (없으면 4h)
  const [tf, setTf] = useState<TF>(() => {
    if (typeof window === "undefined") return "4h";
    const search = window.location.search;
    const match = /[?&]tf=(1h|4h|1d)/.exec(search);
    return (match?.[1] as TF) ?? "4h";
  });

  // TF 변경 시 URL 갱신
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("tf", tf);
    window.history.replaceState(null, "", url.toString());
  }, [tf]);

  const { detail, isLoading, isError, refetch } = useVwapDetail(symbol, tf);

  if (!symbol) {
    return (
      <div className="p-6">
        <p className="font-mono text-sm text-muted-foreground">코인 미지정</p>
      </div>
    );
  }

  const sideColor =
    detail?.signalV2?.side === "LONG" || detail?.signal?.side === "LONG"
      ? "text-neon-green"
      : detail?.signalV2?.side === "SHORT" || detail?.signal?.side === "SHORT"
        ? "text-neon-red"
        : "text-muted-foreground";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/vwap")}
            className="font-mono text-xs"
            aria-label="VWAP 목록으로 돌아가기"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            BACK
          </Button>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <Activity className="h-6 w-6" />
            {symbol.replace("USDT", "")}
          </h1>
          <p className="font-mono text-xs text-muted-foreground mt-1 hidden sm:block">
            VWAP strategy detail / candles + VWAP + EMA9 + volume histogram
          </p>
          {detail?.vwapMult != null && (
            <VwapMultChip vwapMult={detail.vwapMult} />
          )}
        </div>

        {/* TF Selector */}
        <TimeRangeSegmented
          options={TF_OPTIONS.map(value => ({
            value,
            label: value.toUpperCase(),
          }))}
          value={tf}
          onChange={setTf}
        />
      </div>

      {/* Loading / Error */}
      {isLoading && !detail && (
        <div className="flex items-center justify-center py-16 gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-neon-cyan" />
          <span className="font-mono text-xs text-muted-foreground">
            Bybit klines + Volume Profile 계산 중...
          </span>
        </div>
      )}

      {isError && !detail && (
        <div className="text-center py-12">
          <p className="font-mono text-sm text-neon-red mb-3">
            데이터 로드 실패
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            RETRY
          </Button>
        </div>
      )}

      {detail && (
        <>
          {/* Main candle chart + volume histogram (수직 split) */}
          <HudPanel
            title="Candle Chart + VWAP / EMA9 + Bands"
            subtitle={`${symbol} · ${tf.toUpperCase()} · ${detail.candles.length} CANDLES`}
            variant="highlight"
          >
            <VwapCandleChart detail={detail} />
          </HudPanel>

          <HudPanel
            title="Volume Histogram (시간축)"
            subtitle="각 캔들별 거래량 — 양봉(녹) / 음봉(적)"
          >
            <VolumeHistogram detail={detail} />
          </HudPanel>

          {/* 보조 패널: 5-component 시그널 + multi-TF + pullback v2 + Volume Profile */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <HudPanel
              title="VWAP Signal V2 — 5-component"
              subtitle="VWAP 거리 25 + EMA(9) 위치 20 + Pullback 25 + VP 지지 15 + VP 구조 15"
            >
              <SignalCardV2 detail={detail} />
            </HudPanel>
            <HudPanel
              title="Multi-TF Alignment"
              subtitle="1h · 4h · 1d 정합도 + BBDX multiplier"
            >
              <AlignmentCard alignment={detail.multiTfAlignment} />
            </HudPanel>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <HudPanel
              title="Pullback Quality (v2)"
              subtitle="VWAP/EMA9 터치 + 반등 확인"
            >
              <PullbackQualityCard pullback={detail.pullbackV2} />
            </HudPanel>
            <HudPanel
              title="Volume Profile"
              subtitle={`POC / HVN / LVN / Value Area (${(detail.volumeProfile.valueArea.pct * 100).toFixed(0)}%)`}
            >
              <VolumeProfilePanel profile={detail.volumeProfile} />
            </HudPanel>
          </div>

          {/* Signal side 헤더 보조 — 명시적 표기 */}
          {(detail.signalV2 || detail.signal) && (
            <div className="font-mono text-[10px] text-muted-foreground flex items-center gap-2">
              <span>Current Side:</span>
              <span className={cn("font-bold", sideColor)}>
                {detail.signalV2?.side ?? detail.signal?.side}
              </span>
              <span>
                · Strength{" "}
                {(
                  detail.signalV2?.strength ??
                  detail.signal?.strength ??
                  0
                ).toFixed(0)}
                /100
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
