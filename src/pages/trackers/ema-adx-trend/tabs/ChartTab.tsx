/**
 * EMA + ADX 정배열 추세 — 차트 탭 (코인 detail 컨텍스트).
 *
 * 단일 코인의 5-component breakdown 시각화 + 통과 근거.
 */

import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { HudPanel } from "@/components/HudPanel";
import { Loader2 } from "lucide-react";

export interface ChartTabProps {
  symbol: string;
  tf: "1h" | "4h" | "1d";
}

export function ChartTab({ symbol, tf }: ChartTabProps) {
  const { data, isLoading } = trpc.emaAdxTrend.evaluate.useQuery(
    { symbol, tf },
    { staleTime: 60_000, refetchOnWindowFocus: false },
  );

  const breakdown = useMemo(() => {
    if (!data) return [];
    const b = data.breakdown;
    return [
      { name: "EMA정배열", value: Math.round(b.emaStack * 100) },
      { name: "ADX", value: Math.round(b.adx * 100) },
      { name: "±DI", value: Math.round(b.diDiff * 100) },
      { name: "SMA기울기", value: Math.round(b.smaSlope * 100) },
      { name: "HH/HL", value: Math.round(b.structure * 100) },
    ];
  }, [data]);

  if (isLoading && !data) {
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

  return (
    <div className="space-y-4">
      <HudPanel
        title="5-component Breakdown"
        subtitle={`${symbol} · ${tf.toUpperCase()} · 각 보조지표 contribution (0~100)`}
      >
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={breakdown} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="bdGrad-ema" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="oklch(0.82 0.18 195)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="oklch(0.82 0.18 195)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="oklch(0.3 0 0 / 0.2)" strokeDasharray="2 4" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fontFamily: "Share Tech Mono" }} stroke="oklch(0.6 0 0)" />
              <YAxis tick={{ fontSize: 10, fontFamily: "Share Tech Mono" }} stroke="oklch(0.6 0 0)" domain={[0, 100]} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "oklch(0.18 0 0 / 0.95)",
                  border: "1px solid oklch(0.4 0.15 280)",
                  fontFamily: "Share Tech Mono",
                  fontSize: "11px",
                }}
              />
              <Area type="monotone" dataKey="value" stroke="oklch(0.82 0.18 195)" strokeWidth={2} fill="url(#bdGrad-ema)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </HudPanel>

      <HudPanel
        title="진입가 / Target / Stop"
        subtitle={`${data.side} 시그널 — ${data.triggered ? "발행 중" : "미발생"}`}
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
          <div>
            <div className="text-muted-foreground text-[10px] uppercase tracking-wider">진입가</div>
            <div className="text-foreground font-bold">${data.prices.price.toFixed(4)}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-[10px] uppercase tracking-wider">Target 1</div>
            <div className="text-neon-green font-bold">
              ${data.prices.target1.toFixed(4)} ({data.prices.target1Pct >= 0 ? "+" : ""}{data.prices.target1Pct.toFixed(2)}%)
            </div>
          </div>
          <div>
            <div className="text-muted-foreground text-[10px] uppercase tracking-wider">Target 2</div>
            <div className="text-neon-green font-bold">
              ${data.prices.target2.toFixed(4)} ({data.prices.target2Pct >= 0 ? "+" : ""}{data.prices.target2Pct.toFixed(2)}%)
            </div>
          </div>
          <div>
            <div className="text-muted-foreground text-[10px] uppercase tracking-wider">Stop Loss</div>
            <div className="text-neon-red font-bold">
              ${data.prices.stopLoss.toFixed(4)} ({data.prices.stopPct >= 0 ? "+" : ""}{data.prices.stopPct.toFixed(2)}%)
            </div>
          </div>
        </div>
      </HudPanel>
    </div>
  );
}
