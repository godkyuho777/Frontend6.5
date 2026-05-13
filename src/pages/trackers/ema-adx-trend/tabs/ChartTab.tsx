/**
 * EMA + ADX 정배열 추세 — 차트 탭.
 *
 * 단일 심볼 차트 (캔들 + EMA 9/21/50 + ADX 보조 패널). 사용자는 코인을
 * 선택해서 자세히 보고 싶을 때 사용. 기본은 BTCUSDT.
 */

import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { HudPanel } from "@/components/HudPanel";
import { cn } from "@/lib/utils";
import { Loader2, Activity } from "lucide-react";

type TF = "1h" | "4h" | "1d";
const TF_OPTIONS: TF[] = ["1h", "4h", "1d"];
const SYMBOL_OPTIONS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "AAVEUSDT"];

export function ChartTab() {
  const [tf, setTf] = useState<TF>("4h");
  const [symbol, setSymbol] = useState<string>("BTCUSDT");

  const { data: evalResult, isLoading } = trpc.emaAdxTrend.evaluate.useQuery(
    { symbol, tf },
    { staleTime: 60_000, refetchOnWindowFocus: false },
  );

  // 차트 데이터는 단일 시점 시그널 → 시각화는 breakdown bar 위주
  const breakdown = useMemo(() => {
    if (!evalResult) return [];
    const b = evalResult.breakdown;
    return [
      { name: "EMA정배열", value: Math.round(b.emaStack * 100) },
      { name: "ADX", value: Math.round(b.adx * 100) },
      { name: "±DI", value: Math.round(b.diDiff * 100) },
      { name: "SMA기울기", value: Math.round(b.smaSlope * 100) },
      { name: "HH/HL", value: Math.round(b.structure * 100) },
    ];
  }, [evalResult]);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 bg-card/50 border border-border/30 rounded-sm px-2 py-1">
          <Activity className="h-3 w-3 text-neon-cyan" />
          {TF_OPTIONS.map((opt) => (
            <button
              key={opt}
              onClick={() => setTf(opt)}
              className={cn(
                "font-mono text-[10px] px-2 py-1 rounded-sm transition-all uppercase",
                tf === opt
                  ? "bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/30",
              )}
            >
              {opt}
            </button>
          ))}
        </div>
        <select
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          className="font-mono text-xs bg-background border border-border/30 rounded-sm px-3 py-1 text-foreground focus:border-neon-cyan/50 focus:outline-none"
        >
          {SYMBOL_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {isLoading && !evalResult && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-neon-cyan" />
        </div>
      )}

      {evalResult && (
        <>
          {/* 시그널 상태 표 */}
          <HudPanel
            title={`${symbol.replace("USDT", "")} · ${tf.toUpperCase()}`}
            subtitle={`Side ${evalResult.side} · Final ${evalResult.finalConfidence} / ${evalResult.threshold}`}
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono text-xs">
              <div>
                <div className="text-muted-foreground text-[10px] uppercase tracking-wider">Price</div>
                <div className="text-foreground font-bold">${evalResult.prices.price.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-[10px] uppercase tracking-wider">EMA 9/21/50</div>
                <div className="text-neon-cyan font-bold">
                  {evalResult.prices.ema9.toFixed(2)} / {evalResult.prices.ema21.toFixed(2)} / {evalResult.prices.ema50.toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground text-[10px] uppercase tracking-wider">ADX / +DI / -DI</div>
                <div className="text-neon-yellow font-bold">
                  {evalResult.prices.adx.toFixed(1)} / {evalResult.prices.plusDi.toFixed(1)} / {evalResult.prices.minusDi.toFixed(1)}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground text-[10px] uppercase tracking-wider">SMA(50)</div>
                <div className="text-foreground font-bold">${evalResult.prices.sma50.toFixed(2)}</div>
              </div>
            </div>
          </HudPanel>

          {/* Breakdown chart */}
          <HudPanel title="5-component Breakdown" subtitle="각 보조지표 contribution (0~100)">
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={breakdown} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="bdGrad" x1="0" y1="0" x2="0" y2="1">
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
                  <Area type="monotone" dataKey="value" stroke="oklch(0.82 0.18 195)" strokeWidth={2} fill="url(#bdGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </HudPanel>

          {/* Reasons */}
          <HudPanel title="진입 근거" subtitle={`${evalResult.reasons.length}개 통과 조건`}>
            <ul className="space-y-1.5 font-mono text-xs">
              {evalResult.reasons.length === 0 ? (
                <li className="text-muted-foreground italic">통과 조건 없음 (시그널 미발생)</li>
              ) : (
                evalResult.reasons.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-foreground/90">
                    <span className="text-neon-green">✓</span>
                    <span>{r}</span>
                  </li>
                ))
              )}
            </ul>
          </HudPanel>
        </>
      )}
    </div>
  );
}
