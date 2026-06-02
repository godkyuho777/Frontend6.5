/**
 * CoinSignalTab — 트래커 컨텍스트에 따라 다른 실시간 신호를 렌더링.
 *
 * 사용자 요구 (2026-05-13):
 *  - tracker=bbdx       → BBDX SignalCard + ShortSignalCard + DimensionBreakdown
 *  - tracker=fibonacci  → Fibonacci zone + trendlines + BUY/SELL chip
 *  - tracker=vwap       → VwapMultChip + 5-component + Pullback v2 + Multi-TF Alignment
 *
 * Layout (md+):
 *   ┌────────────────────────────────────┬────────────────────────┐
 *   │ Tracker-specific signal panels     │ CoinInfoCard           │
 *   │                                    │ UpcomingEvents         │
 *   └────────────────────────────────────┴────────────────────────┘
 */

import { useState } from "react";
import type { TimeframeValue } from "@shared/types";
import { TIMEFRAMES } from "@shared/types";
import { cn } from "@/lib/utils";
import { Clock, TrendingUp, TrendingDown, AlertCircle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { HudPanel } from "@/components/HudPanel";
import { SignalCard } from "../../panels/SignalCard";
import { ShortSignalCard } from "../../panels/ShortSignalCard";
import { CoinInfoCard } from "../../panels/CoinInfoCard";
import { UpcomingEvents } from "../../panels/UpcomingEvents";
import { DimensionBreakdown } from "../DimensionBreakdown";
import { useCoinSignal } from "../../hooks/useCoinSignal";
import { useCoinMeta } from "../../hooks/useCoinMeta";
import { useUpcomingEvents } from "../../hooks/useUpcomingEvents";
import { useVwapDetail } from "../../hooks/useVwapDetail";
import { useTrendAnalysis } from "../../hooks/useTrendAnalysis";
import { useBbdxV66Flags } from "@/hooks/useBbdxV66Flags";
import { useBbdxV66Current } from "@/hooks/useBbdxV66Current";
import { useFibonacciDetail } from "@/hooks/useFibonacciDetail";
import {
  VwapMultChip,
  SignalCardV2,
  AlignmentCard,
  PullbackQualityCard,
  VolumeProfilePanel,
} from "@/pages/Vwap/VwapDetailPanels";
import type { TrackerContext } from "../../tracker-context";

interface CoinSignalTabProps {
  symbol: string;
  tracker?: TrackerContext;
}

// ---------------------------------------------------------------------------
// TF Selector — 공통 inline bar
// ---------------------------------------------------------------------------

function TfSelectorBar({
  interval,
  onChange,
  rightLabel,
}: {
  interval: TimeframeValue;
  onChange: (tf: TimeframeValue) => void;
  rightLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-1.5 bg-card/50 border border-border/30 rounded-sm px-2 py-1">
        <Clock className="h-3 w-3 text-neon-cyan" />
        <div className="flex gap-0.5">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.value}
              onClick={() => onChange(tf.value as TimeframeValue)}
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
      <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
        {rightLabel ?? `${interval.toUpperCase()} · LIVE`}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// BBDX — 기존 default
// ---------------------------------------------------------------------------

function BbdxSignalContent({
  symbol,
  interval,
  setInterval,
}: {
  symbol: string;
  interval: TimeframeValue;
  setInterval: (tf: TimeframeValue) => void;
}) {
  const { signal } = useCoinSignal(symbol, interval);
  const { meta } = useCoinMeta(symbol);
  const { events, isAvailable: eventsAvailable } = useUpcomingEvents(symbol);

  const vwapTf: "1h" | "4h" | "1d" =
    interval === "1h" || interval === "4h" || interval === "1d" ? interval : "4h";
  const { detail: vwapDetail } = useVwapDetail(symbol, vwapTf);
  const { data: trendData } = useTrendAnalysis(symbol);

  const { isV66, shortEnabled } = useBbdxV66Flags();
  const v66Tf: "1h" | "4h" | "1d" =
    interval === "1h" || interval === "4h" || interval === "1d" ? interval : "4h";
  const { short: v66Short, meta: v66Meta } = useBbdxV66Current(symbol, v66Tf, {
    enabled: isV66,
  });
  const isConflict = !!v66Meta && v66Meta.bothTriggered === true && !("note" in v66Meta);

  return (
    <div className="space-y-4">
      <TfSelectorBar interval={interval} onChange={setInterval} />
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="md:col-span-8 space-y-3">
          <SignalCard
            signal={signal}
            vwapMult={vwapDetail?.vwapMult}
            waveMult={trendData?.waveMult}
            symbol={symbol}
            tf={v66Tf}
            showWeightBadge={isV66}
            conflict={isConflict}
          />
          {isV66 && shortEnabled ? (
            <ShortSignalCard
              symbol={symbol}
              tf={v66Tf}
              short={v66Short}
              conflict={isConflict}
            />
          ) : (
            <ShortSignalCard
              symbol={symbol}
              tf={v66Tf}
              short={null}
              inactiveNote={
                !isV66
                  ? "BBDX v6.6 미활성 (BBDX_VERSION=v6.5). 백엔드 env BBDX_VERSION=v6.6 + ENABLE_SHORT_SIGNALS=1 설정 시 SHORT 시그널 표시."
                  : "SHORT 시그널 비활성 (ENABLE_SHORT_SIGNALS=0). 백엔드 env 에서 활성 가능."
              }
            />
          )}
          <DimensionBreakdown signal={signal} vwapDetail={vwapDetail} />
        </div>
        <div className="md:col-span-4 space-y-3">
          <CoinInfoCard meta={meta} />
          <UpcomingEvents events={events} isAvailable={eventsAvailable} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fibonacci & Trendline
// ---------------------------------------------------------------------------

function FibonacciSignalContent({
  symbol,
  interval,
  setInterval,
}: {
  symbol: string;
  interval: TimeframeValue;
  setInterval: (tf: TimeframeValue) => void;
}) {
  const { analysis, candles, isLoading, error } = useFibonacciDetail(symbol, interval);
  const { meta } = useCoinMeta(symbol);
  const { events, isAvailable: eventsAvailable } = useUpcomingEvents(symbol);

  const currentPrice = candles[candles.length - 1]?.close ?? 0;
  const validTrendlines = analysis?.trendlines.filter((t) => t.isValid) ?? [];
  const supportLines = validTrendlines.filter((t) => t.type === "support");
  const resistanceLines = validTrendlines.filter((t) => t.type === "resistance");
  const inZoneLevel = analysis?.fibLevels.find(
    (l) => currentPrice >= l.zoneLow && currentPrice <= l.zoneHigh
  );

  return (
    <div className="space-y-4">
      <TfSelectorBar interval={interval} onChange={setInterval} />

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="md:col-span-8 space-y-3">
          {/* Loading / error */}
          {isLoading && (
            <HudPanel title="Fibonacci 분석" subtitle={`${symbol} · ${interval.toUpperCase()}`}>
              <div className="flex items-center justify-center gap-2 py-8">
                <Loader2 className="h-4 w-4 animate-spin text-neon-cyan" />
                <span className="font-mono text-xs text-muted-foreground">
                  Fibonacci 분석 중...
                </span>
              </div>
            </HudPanel>
          )}
          {error && !isLoading && (
            <HudPanel title="Fibonacci 분석" subtitle={`${symbol} · ${interval.toUpperCase()}`}>
              <div className="flex items-center gap-2 py-6">
                <AlertCircle className="h-4 w-4 text-neon-red" />
                <span className="font-mono text-xs text-neon-red">{error}</span>
              </div>
            </HudPanel>
          )}

          {/* Main signal */}
          {analysis && !isLoading && (
            <>
              <HudPanel
                title="Fibonacci 신호"
                subtitle={`${symbol} · ${interval.toUpperCase()}`}
                variant={
                  analysis.signal.type === "BUY"
                    ? "highlight"
                    : analysis.signal.type === "SELL"
                      ? "danger"
                      : "default"
                }
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                      {analysis.signal.type === "BUY" ? (
                        <Badge className="bg-neon-green/20 text-neon-green border-neon-green/40 font-mono text-xs px-2 py-0.5">
                          <TrendingUp className="h-3 w-3 mr-0.5" />
                          BUY
                        </Badge>
                      ) : analysis.signal.type === "SELL" ? (
                        <Badge className="bg-neon-red/20 text-neon-red border-neon-red/40 font-mono text-xs px-2 py-0.5">
                          <TrendingDown className="h-3 w-3 mr-0.5" />
                          SELL
                        </Badge>
                      ) : (
                        <Badge className="bg-muted/30 text-muted-foreground border-border/40 font-mono text-xs px-2 py-0.5">
                          관망
                        </Badge>
                      )}
                      <span className="font-mono text-xs text-muted-foreground uppercase tracking-wider">
                        추세:{" "}
                        <span
                          className={cn(
                            analysis.trend === "UP"
                              ? "text-neon-green"
                              : analysis.trend === "DOWN"
                                ? "text-neon-red"
                                : "text-muted-foreground"
                          )}
                        >
                          {analysis.trend}
                        </span>
                      </span>
                    </div>
                    <span className="font-display text-xl font-bold text-neon-cyan">
                      {analysis.signal.strength}
                      <span className="text-muted-foreground text-sm">/100</span>
                    </span>
                  </div>

                  <div className="h-1.5 bg-muted/30 rounded-sm overflow-hidden">
                    <div
                      className={cn(
                        "h-full transition-all",
                        analysis.signal.strength >= 60
                          ? "bg-neon-green"
                          : analysis.signal.strength >= 30
                            ? "bg-neon-yellow"
                            : "bg-neon-cyan"
                      )}
                      style={{ width: `${analysis.signal.strength}%` }}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/20">
                    <div>
                      <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                        현재 구간
                      </div>
                      <div className="font-mono text-sm text-neon-cyan">
                        {analysis.currentZone}
                      </div>
                    </div>
                    <div>
                      <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                        활성 추세선
                      </div>
                      <div className="font-mono text-sm text-foreground">
                        <span className="text-neon-green">{supportLines.length}↑</span>
                        {" / "}
                        <span className="text-neon-red">{resistanceLines.length}↓</span>
                      </div>
                    </div>
                  </div>

                  {analysis.signal.reasons.length > 0 && (
                    <div className="pt-2 border-t border-border/20">
                      <ul className="space-y-0.5">
                        {analysis.signal.reasons.slice(0, 5).map((r, i) => (
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
                    ⚠ Fibonacci 시그널은 BBDX 보조 차원 (modifier-only). 단독 매매 신호 X. 헌장 규칙 3.
                  </p>
                </div>
              </HudPanel>

              {/* Fibonacci levels list */}
              <HudPanel title="Fib 레벨" subtitle="±0.5% 허용 구간">
                <div className="space-y-1">
                  {analysis.fibLevels.map((level) => {
                    const inZone = inZoneLevel?.ratio === level.ratio;
                    const isGolden = level.ratio === 0.618 || level.ratio === 0.382;
                    return (
                      <div
                        key={level.ratio}
                        className={cn(
                          "flex items-center justify-between px-2 py-1.5 rounded-sm",
                          inZone
                            ? "bg-neon-yellow/10 border border-neon-yellow/30"
                            : "border border-transparent"
                        )}
                      >
                        <span
                          className={cn(
                            "font-mono text-xs font-bold",
                            level.ratio === 0.618
                              ? "text-yellow-400"
                              : level.ratio === 0.382
                                ? "text-neon-pink"
                                : "text-foreground"
                          )}
                        >
                          {level.label}
                          {isGolden && (
                            <span className="ml-1 text-[9px] text-muted-foreground">
                              황금비
                            </span>
                          )}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground">
                          ${level.price < 1 ? level.price.toPrecision(4) : level.price.toFixed(2)}
                        </span>
                        {inZone && (
                          <span className="font-mono text-[10px] text-neon-yellow font-bold">
                            구간 진입
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </HudPanel>

              {/* Trendlines */}
              <HudPanel
                title="감지된 추세선"
                subtitle={`유효 ${validTrendlines.length}개 · 약함 ${analysis.trendlines.length - validTrendlines.length}개`}
              >
                {validTrendlines.length === 0 ? (
                  <p className="font-mono text-xs text-muted-foreground py-4 text-center">
                    유효 추세선 없음 — 캔들 부족 또는 swing 미식별.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {validTrendlines.slice(0, 4).map((tl, i) => {
                      const distance =
                        ((currentPrice - tl.currentPrice) / tl.currentPrice) * 100;
                      return (
                        <div
                          key={i}
                          className={cn(
                            "flex items-center justify-between gap-3 px-3 py-2 rounded-sm",
                            tl.type === "support"
                              ? "border border-neon-green/30 bg-neon-green/5"
                              : "border border-neon-red/30 bg-neon-red/5"
                          )}
                        >
                          <span
                            className={cn(
                              "font-mono text-xs font-bold uppercase",
                              tl.type === "support" ? "text-neon-green" : "text-neon-red"
                            )}
                          >
                            {tl.type === "support" ? "▲ 지지" : "▼ 저항"}
                          </span>
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {tl.touchCount}회 터치 · {tl.durationDays.toFixed(0)}일
                          </span>
                          <span
                            className={cn(
                              "font-mono text-xs",
                              distance >= 0 ? "text-neon-green" : "text-neon-red"
                            )}
                          >
                            {distance >= 0 ? "+" : ""}
                            {distance.toFixed(2)}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </HudPanel>
            </>
          )}
        </div>

        <div className="md:col-span-4 space-y-3">
          <CoinInfoCard meta={meta} />
          <UpcomingEvents events={events} isAvailable={eventsAvailable} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// VWAP — useVwapDetail 우선, BBDX modifier 시각화
// ---------------------------------------------------------------------------

function VwapSignalContent({
  symbol,
  interval,
  setInterval,
}: {
  symbol: string;
  interval: TimeframeValue;
  setInterval: (tf: TimeframeValue) => void;
}) {
  // VWAP detail 은 1H/4H/1D 만 지원 — 그 외 TF 는 4H 로 대체.
  const vwapTf: "1h" | "4h" | "1d" =
    interval === "1h" || interval === "4h" || interval === "1d" ? interval : "4h";
  const { detail, isLoading, isError } = useVwapDetail(symbol, vwapTf);
  const { meta } = useCoinMeta(symbol);
  const { events, isAvailable: eventsAvailable } = useUpcomingEvents(symbol);

  const fallbackNote =
    interval !== vwapTf
      ? `${interval.toUpperCase()} 는 VWAP 미지원 → ${vwapTf.toUpperCase()} 로 표시`
      : undefined;

  return (
    <div className="space-y-4">
      <TfSelectorBar
        interval={interval}
        onChange={setInterval}
        rightLabel={fallbackNote ?? `${vwapTf.toUpperCase()} · LIVE`}
      />

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="md:col-span-8 space-y-3">
          {/* VwapMult chip — 헌장 규칙 3 (BBDX multiplier) */}
          {detail && (
            <HudPanel title="VWAP 가중치" subtitle="BBDX 진입 신뢰도 가중치">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <VwapMultChip vwapMult={detail.vwapMult} />
                <span className="font-mono text-[10px] text-muted-foreground">
                  헌장 규칙 3 — VWAP 시그널은 단독 매매 신호 X (multiplier-only)
                </span>
              </div>
            </HudPanel>
          )}

          {/* Loading state */}
          {isLoading && (
            <HudPanel title="VWAP 신호 v2" subtitle="불러오는 중...">
              <div className="flex items-center justify-center gap-2 py-8">
                <Loader2 className="h-4 w-4 animate-spin text-neon-cyan" />
                <span className="font-mono text-xs text-muted-foreground">
                  VWAP 상세 불러오는 중...
                </span>
              </div>
            </HudPanel>
          )}

          {/* Error state */}
          {isError && !isLoading && (
            <HudPanel title="VWAP 신호 v2" subtitle="오류" variant="danger">
              <div className="flex items-center gap-2 py-4">
                <AlertCircle className="h-4 w-4 text-neon-red" />
                <span className="font-mono text-xs text-neon-red">
                  VWAP 상세를 불러오지 못했습니다. 백엔드 vwap.detail 라우트를 확인하세요.
                </span>
              </div>
            </HudPanel>
          )}

          {/* Detail panels */}
          {detail && (
            <>
              <SignalCardV2 detail={detail} />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <PullbackQualityCard pullback={detail.pullbackV2} />
                <AlignmentCard alignment={detail.multiTfAlignment} />
              </div>
              <HudPanel title="거래량 프로파일" subtitle="POC · HVN · LVN · Value Area">
                <VolumeProfilePanel profile={detail.volumeProfile} />
              </HudPanel>
            </>
          )}
        </div>

        <div className="md:col-span-4 space-y-3">
          <CoinInfoCard meta={meta} />
          <UpcomingEvents events={events} isAvailable={eventsAvailable} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CoinSignalTab — 트래커 분기
// ---------------------------------------------------------------------------

export function CoinSignalTab({ symbol, tracker = "bbdx" }: CoinSignalTabProps) {
  const [interval, setInterval] = useState<TimeframeValue>("4h");

  switch (tracker) {
    case "fibonacci":
      return (
        <FibonacciSignalContent
          symbol={symbol}
          interval={interval}
          setInterval={setInterval}
        />
      );
    case "vwap":
      return (
        <VwapSignalContent
          symbol={symbol}
          interval={interval}
          setInterval={setInterval}
        />
      );
    case "bbdx":
    case "jeon-in-gu":
    default:
      return (
        <BbdxSignalContent symbol={symbol} interval={interval} setInterval={setInterval} />
      );
  }
}
