/**
 * LiteCoinChart — Lite 모드용 매우 단순화된 가격 차트.
 * Recharts AreaChart 한 라인 + 옵션으로 BB 영역만. RSI/ADX 등 보조 지표 X.
 */

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

interface Candle {
  time: number;
  close: number;
  high: number;
  low: number;
  volume: number;
}

interface Props {
  candles: Candle[];
  bb?: { upper: number; middle: number; lower: number } | null;
  height?: number;
}

function formatPrice(p: number): string {
  if (p === 0) return "—";
  if (p < 1) return p.toFixed(6);
  if (p < 100) return p.toFixed(4);
  return p.toFixed(0);
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function LiteCoinChart({ candles, bb, height = 220 }: Props) {
  const data = candles.map((c) => ({
    time: c.time,
    timeLabel: formatTime(c.time),
    price: c.close,
  }));

  const minLow = Math.min(...candles.map((c) => c.low));
  const maxHigh = Math.max(...candles.map((c) => c.high));

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 50, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="liteCoinGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="oklch(0.82 0.18 195)" stopOpacity={0.4} />
              <stop offset="100%" stopColor="oklch(0.82 0.18 195)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/15" />
          <XAxis
            dataKey="timeLabel"
            tick={{ fontSize: 10, fontFamily: "Share Tech Mono" }}
            interval="preserveStartEnd"
            tickCount={6}
          />
          <YAxis
            domain={[minLow * 0.995, maxHigh * 1.005]}
            tick={{ fontSize: 10, fontFamily: "Share Tech Mono" }}
            tickFormatter={(v) => `$${formatPrice(v)}`}
            width={50}
            orientation="right"
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "oklch(0.14 0.015 260)",
              border: "1px solid oklch(0.3 0.02 260)",
              fontFamily: "Share Tech Mono",
              fontSize: 11,
              borderRadius: 6,
            }}
            formatter={(v: number) => [`$${formatPrice(v)}`, "가격"]}
            labelFormatter={(l) => l}
          />
          {bb && (
            <>
              <ReferenceLine
                y={bb.upper}
                stroke="oklch(0.65 0.18 235)"
                strokeDasharray="2 4"
                strokeWidth={1}
                label={{ value: "비싼 영역", position: "right", fill: "oklch(0.65 0.18 235)", fontSize: 9 }}
              />
              <ReferenceLine
                y={bb.middle}
                stroke="oklch(0.6 0.02 260)"
                strokeDasharray="2 4"
                strokeWidth={1}
                label={{ value: "평균", position: "right", fill: "oklch(0.6 0.02 260)", fontSize: 9 }}
              />
              <ReferenceLine
                y={bb.lower}
                stroke="oklch(0.7 0.22 145)"
                strokeDasharray="2 4"
                strokeWidth={1}
                label={{ value: "싼 영역", position: "right", fill: "oklch(0.7 0.22 145)", fontSize: 9 }}
              />
            </>
          )}
          <Area
            type="monotone"
            dataKey="price"
            stroke="oklch(0.82 0.18 195)"
            strokeWidth={2}
            fill="url(#liteCoinGrad)"
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
