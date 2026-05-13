/**
 * EMA + ADX 정배열 추세 — 실시간 신호 탭.
 *
 * 백엔드 trpc.emaAdxTrend.scan 으로 top 10 코인 스캔 + 상위 시그널 카드 표시.
 */

import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { SignalTab as SignalTabStandard } from "@/components/trackers/tabs";
import { HudPanel } from "@/components/HudPanel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Loader2, TrendingUp, TrendingDown, Activity, ChevronRight } from "lucide-react";
import type { SignalSnapshot } from "@/components/trackers/tabs";

type TF = "1h" | "4h" | "1d";
const TF_OPTIONS: TF[] = ["1h", "4h", "1d"];

export function SignalTab() {
  const [tf, setTf] = useState<TF>("4h");
  const [, setLocation] = useLocation();
  const { data, isLoading, refetch } = trpc.emaAdxTrend.scan.useQuery(
    { tf },
    { staleTime: 60_000, refetchOnWindowFocus: false },
  );

  // 상위 (triggered) 시그널 1개를 StandardSignalCard 로 변환
  const topSignal: SignalSnapshot | null = (() => {
    if (!data?.results) return null;
    const triggered = data.results
      .filter((r) => r.triggered)
      .sort((a, b) => b.finalConfidence - a.finalConfidence);
    if (triggered.length === 0) return null;
    const top = triggered[0];
    return {
      side: top.side === "LONG" ? "long" : top.side === "SHORT" ? "short" : "neutral",
      final_confidence: top.finalConfidence,
      threshold: top.threshold,
      breakdown: [
        { category: "EMA 정배열", value: top.breakdown.emaStack, weight: 0.30, contribution: top.breakdown.emaStack * 0.30 * 100, color: "oklch(0.82 0.18 145)" },
        { category: "ADX 강도", value: top.breakdown.adx, weight: 0.25, contribution: top.breakdown.adx * 0.25 * 100, color: "oklch(0.85 0.18 95)" },
        { category: "±DI 우위", value: top.breakdown.diDiff, weight: 0.20, contribution: top.breakdown.diDiff * 0.20 * 100, color: "oklch(0.75 0.20 200)" },
        { category: "SMA 기울기", value: top.breakdown.smaSlope, weight: 0.15, contribution: top.breakdown.smaSlope * 0.15 * 100, color: "oklch(0.75 0.20 280)" },
        { category: "HH/HL 구조", value: top.breakdown.structure, weight: 0.10, contribution: top.breakdown.structure * 0.10 * 100, color: "oklch(0.85 0.18 30)" },
      ],
      active_modifiers: [],
      entry_price: top.prices.price,
      stop_price: top.prices.stopLoss,
      stop_pct: top.prices.stopPct,
      targets: [top.prices.target1, top.prices.target2],
      targets_pct: [top.prices.target1Pct, top.prices.target2Pct],
    };
  })();

  return (
    <div className="space-y-4">
      {/* TF Selector */}
      <div className="flex items-center justify-between flex-wrap gap-2">
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
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isLoading}
          className="font-mono text-xs"
        >
          {isLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
          REFRESH
        </Button>
      </div>

      {/* 상위 시그널 카드 (표준) */}
      <SignalTabStandard
        signal={topSignal}
        isLoading={isLoading && !data}
        emptyState={
          <HudPanel title="활성 시그널 없음" subtitle={`${tf.toUpperCase()} · top 10 코인 스캔 결과`}>
            <p className="font-mono text-xs text-muted-foreground py-2">
              현재 final confidence ≥ 55 인 LONG/SHORT 시그널이 없습니다. 추세장이 형성되면 자동 알림됩니다.
            </p>
          </HudPanel>
        }
      />

      {/* 전체 스캔 결과 — 코인 리스트 */}
      <HudPanel
        title="전체 스캔 결과"
        subtitle={`TOP 10 코인 · ${tf.toUpperCase()} · ${data?.results.length ?? 0}개`}
      >
        {data?.results.length === 0 || !data ? (
          <p className="font-mono text-xs text-muted-foreground py-2">데이터 없음</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/30">
                  <th className="text-left font-mono text-[10px] text-muted-foreground uppercase tracking-wider py-2 px-2">Symbol</th>
                  <th className="text-right font-mono text-[10px] text-muted-foreground uppercase tracking-wider py-2 px-2">Price</th>
                  <th className="text-center font-mono text-[10px] text-muted-foreground uppercase tracking-wider py-2 px-2">Side</th>
                  <th className="text-right font-mono text-[10px] text-muted-foreground uppercase tracking-wider py-2 px-2">Conf.</th>
                  <th className="text-right font-mono text-[10px] text-muted-foreground uppercase tracking-wider py-2 px-2 hidden sm:table-cell">ADX</th>
                  <th className="text-right font-mono text-[10px] text-muted-foreground uppercase tracking-wider py-2 px-2 hidden md:table-cell">+DI/-DI</th>
                  <th className="text-center py-2 px-2"></th>
                </tr>
              </thead>
              <tbody>
                {data.results
                  .slice()
                  .sort((a, b) => b.finalConfidence - a.finalConfidence)
                  .map((r) => (
                    <tr
                      key={r.symbol}
                      className={cn(
                        "border-b border-border/10 hover:bg-card/40 cursor-pointer transition-colors",
                        r.triggered && r.side === "LONG" && "border-l-2 border-l-neon-green",
                        r.triggered && r.side === "SHORT" && "border-l-2 border-l-neon-red",
                      )}
                      onClick={() => setLocation(`/coin/${r.symbol}?tf=${tf}`)}
                    >
                      <td className="py-2 px-2">
                        <span className="font-display text-xs font-bold text-neon-cyan">
                          {r.symbol.replace("USDT", "")}
                        </span>
                      </td>
                      <td className="text-right py-2 px-2 font-mono text-xs text-foreground">
                        ${r.prices.price < 1 ? r.prices.price.toFixed(6) : r.prices.price < 100 ? r.prices.price.toFixed(4) : r.prices.price.toFixed(2)}
                      </td>
                      <td className="text-center py-2 px-2">
                        {r.triggered ? (
                          <span
                            className={cn(
                              "font-mono text-[10px] px-2 py-0.5 rounded-sm border font-bold uppercase",
                              r.side === "LONG"
                                ? "text-neon-green border-neon-green/40 bg-neon-green/10"
                                : "text-neon-red border-neon-red/40 bg-neon-red/10",
                            )}
                          >
                            {r.side === "LONG" ? <TrendingUp className="inline h-3 w-3 mr-1" /> : <TrendingDown className="inline h-3 w-3 mr-1" />}
                            {r.side}
                          </span>
                        ) : (
                          <span className="font-mono text-[10px] text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="text-right py-2 px-2 font-mono text-xs">
                        <span
                          className={cn(
                            r.finalConfidence >= 55
                              ? "text-neon-yellow font-bold"
                              : "text-muted-foreground",
                          )}
                        >
                          {r.finalConfidence}
                        </span>
                      </td>
                      <td className="text-right py-2 px-2 font-mono text-xs text-muted-foreground hidden sm:table-cell">
                        {r.prices.adx.toFixed(1)}
                      </td>
                      <td className="text-right py-2 px-2 font-mono text-[10px] text-muted-foreground hidden md:table-cell">
                        {r.prices.plusDi.toFixed(1)}/{r.prices.minusDi.toFixed(1)}
                      </td>
                      <td className="text-center py-2 px-2">
                        <ChevronRight className="h-3 w-3 text-muted-foreground inline" />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </HudPanel>
    </div>
  );
}
