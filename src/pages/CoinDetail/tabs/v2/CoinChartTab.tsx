/**
 * CoinChartTab — 트래커 컨텍스트에 따라 다른 차트 인디케이터를 표시.
 *
 * 사용자 요구 (2026-05-13):
 *  - tracker=bbdx       → 캔들 + BB + RSI + ADX (기존 ChartZone)
 *  - tracker=fibonacci  → 캔들 + Fib levels + Trendlines (FibonacciDetail 의 CandleChartLW 재사용)
 *  - tracker=vwap       → 캔들 + VWAP + ±σ 밴드 + EMA(9) + Volume Profile
 *
 * 명세: TRACKER_TAB_STANDARD §2.3 (차트 탭 = TF 선택 + 메인 차트 + legend).
 */

import { useState } from "react";
import type { TimeframeValue } from "@shared/types";
import { TIMEFRAMES } from "@shared/types";
import { cn } from "@/lib/utils";
import { ChartZone } from "../../ChartZone";
import { HudPanel } from "@/components/HudPanel";
import { Clock, AlertCircle, Loader2 } from "lucide-react";
import { CandleChartLW } from "@/components/CandleChartLW";
import { useFibonacciDetail } from "@/hooks/useFibonacciDetail";
import { useVwapDetail } from "../../hooks/useVwapDetail";
import {
  VwapChartPanel,
  VolumeProfilePanel,
} from "@/pages/Vwap/VwapDetailPanels";
import type { TrackerContext } from "../../tracker-context";

interface CoinChartTabProps {
  symbol: string;
  tracker?: TrackerContext;
}

// ---------------------------------------------------------------------------
// TF Selector + Legend 공통
// ---------------------------------------------------------------------------

function ChartControls({
  interval,
  setInterval,
  legend,
}: {
  interval: TimeframeValue;
  setInterval: (tf: TimeframeValue) => void;
  legend: { color: string; label: string }[];
}) {
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-1.5 bg-card/50 border border-border/30 rounded-sm px-2 py-1">
        <Clock className="h-3 w-3 text-neon-cyan" />
        <div className="flex gap-0.5">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.value}
              onClick={() => setInterval(tf.value as TimeframeValue)}
              className={cn(
                "font-mono text-[10px] px-2 py-1 rounded-sm transition-all",
                interval === tf.value
                  ? "bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
              )}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 font-mono text-[10px] text-muted-foreground">
        {legend.map((l) => (
          <LegendDot key={l.label} color={l.color} label={l.label} />
        ))}
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("inline-block h-2 w-2 rounded-full", color)} />
      <span>{label}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// BBDX — 기존 ChartZone (캔들 + BB + RSI + ADX)
// ---------------------------------------------------------------------------

function BbdxChartContent({
  symbol,
  interval,
  setInterval,
}: {
  symbol: string;
  interval: TimeframeValue;
  setInterval: (tf: TimeframeValue) => void;
}) {
  return (
    <div className="space-y-3">
      <ChartControls
        interval={interval}
        setInterval={setInterval}
        legend={[
          { color: "bg-neon-cyan", label: "종가" },
          { color: "bg-muted-foreground", label: "BB 상단/중단/하단" },
          { color: "bg-neon-yellow", label: "RSI (14)" },
          { color: "bg-neon-pink", label: "ADX / ±DI" },
        ]}
      />
      <ChartZone symbol={symbol} interval={interval} />
      <HudPanel title="차트 가이드" subtitle="BBDX 차트 읽는 법">
        <ul className="space-y-1.5 font-mono text-xs text-foreground/80">
          <li>
            · <span className="text-neon-cyan">BB Lower 근접 + RSI &lt; 38</span> = BBDX NUM path 진입 후보 (LONG)
          </li>
          <li>
            · <span className="text-neon-yellow">BB Riding (캔들이 upper 또는 lower 외부)</span> = 추세 가속 진행 중
          </li>
          <li>
            · <span className="text-neon-pink">ADX &gt; 25 + +DI &gt; -DI</span> = 강한 상승 추세 (NUM path 제한)
          </li>
          <li>
            · <span className="text-neon-red">ADX &gt; 30 + -DI 우위</span> = Falling Knife (진입 차단)
          </li>
        </ul>
      </HudPanel>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fibonacci — CandleChartLW 재사용 (fibLevels + trendlines overlay 지원)
// ---------------------------------------------------------------------------

function FibonacciChartContent({
  symbol,
  interval,
  setInterval,
}: {
  symbol: string;
  interval: TimeframeValue;
  setInterval: (tf: TimeframeValue) => void;
}) {
  const { analysis, candles, isLoading, error, fibTf } = useFibonacciDetail(symbol, interval);
  const currentPrice = candles[candles.length - 1]?.close ?? 0;
  const validTrendlines = analysis?.trendlines.filter((t) => t.isValid) ?? [];
  const fibLevelCount = analysis?.fibLevels.length ?? 0;

  return (
    <div className="space-y-3">
      <ChartControls
        interval={interval}
        setInterval={setInterval}
        legend={[
          { color: "bg-neon-cyan", label: "캔들" },
          { color: "bg-yellow-400", label: "Fib 61.8 (황금비)" },
          { color: "bg-neon-pink", label: "Fib 38.2 (황금비)" },
          { color: "bg-neon-green", label: "지지 추세선" },
          { color: "bg-neon-red", label: "저항 추세선" },
        ]}
      />
      {isLoading && (
        <HudPanel title="Fibonacci 차트" subtitle={`${symbol} · ${interval.toUpperCase()}`}>
          <div className="h-[400px] flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-neon-cyan" />
            <span className="font-mono text-xs text-muted-foreground">
              Fibonacci 차트 불러오는 중...
            </span>
          </div>
        </HudPanel>
      )}
      {error && !isLoading && (
        <HudPanel title="Fibonacci 차트" subtitle="오류" variant="danger">
          <div className="flex items-center gap-2 py-6">
            <AlertCircle className="h-4 w-4 text-neon-red" />
            <span className="font-mono text-xs text-neon-red">{error}</span>
          </div>
        </HudPanel>
      )}
      {analysis && !isLoading && (
        <HudPanel
          title="Fibonacci 차트"
          subtitle={`${symbol} · ${interval.toUpperCase()} (TF: ${fibTf}) · 캔들 ${candles.length}개 · Fib 레벨 ${fibLevelCount}개 · 추세선 ${validTrendlines.length}개`}
        >
          <CandleChartLW
            candles={candles}
            fibLevels={analysis.fibLevels}
            trendlines={analysis.trendlines}
            currentPrice={currentPrice}
          />
        </HudPanel>
      )}
      <HudPanel title="차트 가이드" subtitle="Fibonacci 차트 읽는 법">
        <ul className="space-y-1.5 font-mono text-xs text-foreground/80">
          <li>
            · <span className="text-yellow-400">Fib 61.8% (Golden Ratio)</span> = 강한 지지/저항 — 진입 후보
          </li>
          <li>
            · <span className="text-neon-pink">Fib 38.2%</span> = 가벼운 되돌림 — 단기 진입
          </li>
          <li>
            · <span className="text-neon-green">상승 추세선 + Fib 지지</span> = LONG confluence
          </li>
          <li>
            · <span className="text-neon-red">추세선 break + Fib 78.6% 이탈</span> = 추세 종료 신호
          </li>
        </ul>
      </HudPanel>
    </div>
  );
}

// ---------------------------------------------------------------------------
// VWAP — VwapChartPanel (캔들 + VWAP/EMA + ±σ 밴드) + Volume Profile
// ---------------------------------------------------------------------------

function VwapChartContent({
  symbol,
  interval,
  setInterval,
}: {
  symbol: string;
  interval: TimeframeValue;
  setInterval: (tf: TimeframeValue) => void;
}) {
  const vwapTf: "1h" | "4h" | "1d" =
    interval === "1h" || interval === "4h" || interval === "1d" ? interval : "4h";
  const { detail, isLoading, isError } = useVwapDetail(symbol, vwapTf);

  const fallbackNote =
    interval !== vwapTf ? `${interval.toUpperCase()} → ${vwapTf.toUpperCase()} (VWAP 미지원 TF)` : null;

  return (
    <div className="space-y-3">
      <ChartControls
        interval={interval}
        setInterval={setInterval}
        legend={[
          { color: "bg-white", label: "종가" },
          { color: "bg-neon-yellow", label: "VWAP" },
          { color: "bg-neon-cyan", label: "EMA(9)" },
          { color: "bg-neon-pink", label: "POC (VP)" },
          { color: "bg-muted-foreground", label: "±1/2/3σ 밴드" },
        ]}
      />
      {fallbackNote && (
        <div className="font-mono text-[10px] text-neon-yellow px-2">
          ⚠ {fallbackNote}
        </div>
      )}
      {isLoading && (
        <HudPanel title="VWAP 차트" subtitle="불러오는 중...">
          <div className="h-[400px] flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-neon-cyan" />
            <span className="font-mono text-xs text-muted-foreground">
              VWAP 차트 불러오는 중...
            </span>
          </div>
        </HudPanel>
      )}
      {isError && !isLoading && (
        <HudPanel title="VWAP 차트" subtitle="오류" variant="danger">
          <div className="flex items-center gap-2 py-6">
            <AlertCircle className="h-4 w-4 text-neon-red" />
            <span className="font-mono text-xs text-neon-red">
              VWAP 상세를 불러오지 못했습니다. 백엔드 vwap.detail 라우트를 확인하세요.
            </span>
          </div>
        </HudPanel>
      )}
      {detail && (
        <>
          <HudPanel
            title="VWAP 차트"
            subtitle={`${symbol} · ${vwapTf.toUpperCase()} · VWAP + EMA(9) + ±σ`}
          >
            <VwapChartPanel detail={detail} />
          </HudPanel>
          <HudPanel
            title="거래량 프로파일"
            subtitle="POC · HVN · LVN · Value Area"
          >
            <VolumeProfilePanel profile={detail.volumeProfile} />
          </HudPanel>
        </>
      )}
      <HudPanel title="차트 가이드" subtitle="VWAP 차트 읽는 법">
        <ul className="space-y-1.5 font-mono text-xs text-foreground/80">
          <li>
            · <span className="text-neon-yellow">VWAP</span> = 거래량 가중 평균가 (anchor)
          </li>
          <li>
            · <span className="text-neon-cyan">EMA(9) &gt; VWAP</span> + 가격 &gt; VWAP = LONG 동조
          </li>
          <li>
            · <span className="text-neon-pink">POC (HVN)</span> = 최다 거래량 가격대 — 강한 지지/저항
          </li>
          <li>
            · <span className="text-muted-foreground">±1σ / ±2σ</span> 도달 = 평균 회귀 또는 break-out 시점
          </li>
        </ul>
      </HudPanel>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CoinChartTab — 트래커 분기
// ---------------------------------------------------------------------------

export function CoinChartTab({ symbol, tracker = "bbdx" }: CoinChartTabProps) {
  const [interval, setInterval] = useState<TimeframeValue>("4h");

  switch (tracker) {
    case "fibonacci":
      return (
        <FibonacciChartContent
          symbol={symbol}
          interval={interval}
          setInterval={setInterval}
        />
      );
    case "vwap":
      return (
        <VwapChartContent
          symbol={symbol}
          interval={interval}
          setInterval={setInterval}
        />
      );
    case "bbdx":
    case "jeon-in-gu":
    default:
      return (
        <BbdxChartContent
          symbol={symbol}
          interval={interval}
          setInterval={setInterval}
        />
      );
  }
}
