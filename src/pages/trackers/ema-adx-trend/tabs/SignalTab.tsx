/**
 * EMA + ADX 정배열 추세 — 실시간 신호 탭 (코인 detail 컨텍스트).
 *
 * 단일 코인 (`symbol`, `tf`) 의 시그널만 표시. 리스트는 메인 페이지에서 처리.
 */

import { trpc } from "@/lib/trpc";
import { SignalTab as SignalTabStandard } from "@/components/trackers/tabs";
import { HudPanel } from "@/components/HudPanel";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import type { SignalSnapshot } from "@/components/trackers/tabs";

export interface SignalTabProps {
  symbol: string;
  tf: "1h" | "4h" | "1d";
}

export function SignalTab({ symbol, tf }: SignalTabProps) {
  const { data, isLoading, isError, error, refetch } =
    trpc.emaAdxTrend.evaluate.useQuery(
      { symbol, tf },
      { staleTime: 60_000, refetchOnWindowFocus: false },
    );

  // 표준 SignalSnapshot 으로 매핑
  const signal: SignalSnapshot | null = data
    ? {
        side: data.side === "LONG" ? "long" : data.side === "SHORT" ? "short" : "neutral",
        final_confidence: data.finalConfidence,
        threshold: data.threshold,
        breakdown: [
          {
            category: "EMA 정배열",
            value: data.breakdown.emaStack,
            weight: 0.30,
            contribution: data.breakdown.emaStack * 0.30 * 100,
            color: "oklch(0.82 0.18 145)",
          },
          {
            category: "ADX 강도",
            value: data.breakdown.adx,
            weight: 0.25,
            contribution: data.breakdown.adx * 0.25 * 100,
            color: "oklch(0.85 0.18 95)",
          },
          {
            category: "±DI 우위",
            value: data.breakdown.diDiff,
            weight: 0.20,
            contribution: data.breakdown.diDiff * 0.20 * 100,
            color: "oklch(0.75 0.20 200)",
          },
          {
            category: "SMA 기울기",
            value: data.breakdown.smaSlope,
            weight: 0.15,
            contribution: data.breakdown.smaSlope * 0.15 * 100,
            color: "oklch(0.75 0.20 280)",
          },
          {
            category: "HH/HL 구조",
            value: data.breakdown.structure,
            weight: 0.10,
            contribution: data.breakdown.structure * 0.10 * 100,
            color: "oklch(0.85 0.18 30)",
          },
        ],
        active_modifiers: [],
        entry_price: data.prices.price,
        stop_price: data.prices.stopLoss,
        stop_pct: data.prices.stopPct,
        targets: [data.prices.target1, data.prices.target2],
        targets_pct: [data.prices.target1Pct, data.prices.target2Pct],
      }
    : null;

  return (
    <div className="space-y-4">
      {/* 가격 / 지표 요약 카드 — 사용자 명시 "EMA, ADX, DI 같은걸 표기" */}
      {data && (
        <HudPanel
          title={`${symbol.replace("USDT", "")} 보조지표 현황`}
          subtitle={`${tf.toUpperCase()} · 마지막 계산: ${new Date(data.computedAt).toLocaleTimeString("ko-KR")}`}
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 font-mono text-xs">
            <Metric label="Price" value={`$${data.prices.price < 1 ? data.prices.price.toFixed(6) : data.prices.price.toFixed(2)}`} accent="cyan" />
            <Metric label="EMA 9 / 21 / 50" value={`${data.prices.ema9.toFixed(2)} / ${data.prices.ema21.toFixed(2)} / ${data.prices.ema50.toFixed(2)}`} accent="green" />
            <Metric label="SMA(50)" value={`$${data.prices.sma50.toFixed(2)}`} />
            <Metric label="ADX(14)" value={data.prices.adx.toFixed(1)} accent={data.prices.adx >= 20 ? "yellow" : undefined} />
            <Metric label="+DI / -DI" value={`${data.prices.plusDi.toFixed(1)} / ${data.prices.minusDi.toFixed(1)}`} accent={data.prices.plusDi > data.prices.minusDi ? "green" : "red"} />
            <Metric label="±DI Diff" value={`${data.prices.plusDi - data.prices.minusDi >= 0 ? "+" : ""}${(data.prices.plusDi - data.prices.minusDi).toFixed(1)}`} />
            <Metric label="Side" value={data.side} accent={data.side === "LONG" ? "green" : data.side === "SHORT" ? "red" : undefined} />
            <Metric label="Confidence" value={`${data.finalConfidence} / ${data.threshold}`} accent={data.finalConfidence >= data.threshold ? "yellow" : undefined} />
          </div>
        </HudPanel>
      )}

      {/* 표준 시그널 카드 */}
      <SignalTabStandard
        signal={signal}
        isLoading={isLoading && !data}
        emptyState={
          <HudPanel title="시그널 정보" subtitle={`${symbol} · ${tf.toUpperCase()}`}>
            {isError ? (
              <p className="font-mono text-xs text-neon-red">
                평가 실패: {String(error?.message ?? "")}
              </p>
            ) : (
              <p className="font-mono text-xs text-muted-foreground">데이터 로드 중...</p>
            )}
          </HudPanel>
        }
      />

      {/* 통과 근거 (reasons) */}
      {data && (
        <HudPanel title="진입 근거" subtitle={`${data.reasons.length}개 통과 조건`}>
          {data.reasons.length === 0 ? (
            <p className="font-mono text-xs text-muted-foreground italic py-2">
              통과한 조건이 없어 진입 신호가 발행되지 않았습니다.
            </p>
          ) : (
            <ul className="space-y-1.5 font-mono text-xs">
              {data.reasons.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-foreground/90">
                  <span className="text-neon-green">✓</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          )}
        </HudPanel>
      )}

      {isLoading && !data && (
        <div className="flex items-center justify-center py-8 gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-neon-cyan" />
          <span className="font-mono text-xs text-muted-foreground">평가 중...</span>
        </div>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "green" | "red" | "cyan" | "yellow";
}) {
  const cls = accent
    ? { green: "text-neon-green", red: "text-neon-red", cyan: "text-neon-cyan", yellow: "text-neon-yellow" }[accent]
    : "text-foreground";
  return (
    <div>
      <div className="text-muted-foreground text-[10px] uppercase tracking-wider">{label}</div>
      <div className={cn("font-bold", cls)}>{value}</div>
    </div>
  );
}
