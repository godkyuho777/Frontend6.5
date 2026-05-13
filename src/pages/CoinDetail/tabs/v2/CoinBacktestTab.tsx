/**
 * CoinBacktestTab — 트래커 컨텍스트에 따라 다른 백테스트 전략을 표시.
 *
 * 사용자 요구 (2026-05-13):
 *  - tracker=bbdx       → BBDX v6.6 (RSI+BB+ADX) 백테스트 (기존)
 *  - tracker=fibonacci  → Fibonacci & Trendline 전략 (백엔드 미지원 → placeholder)
 *  - tracker=vwap       → VWAP + EMA(9) 전략 (백엔드 미지원 → placeholder)
 *
 * 백엔드 trpc.backtest.run / trpc.winRate.rolling 모두 현재 strategy 파라미터를
 * 받지 않음 — BBDX 전용 결과만 반환. Fibonacci / VWAP 는 fully-wired backend
 * route 가 추가될 때까지 placeholder + /backtest 페이지로 유도.
 *
 * 명세: TRACKER_TAB_STANDARD §2.4.
 */

import { BacktestTab } from "../BacktestTab";
import { WinRateTab } from "../WinRateTab";
import { HudPanel } from "@/components/HudPanel";
import { Info } from "lucide-react";
import { Link } from "wouter";
import type { TrackerContext } from "../../tracker-context";

interface CoinBacktestTabProps {
  symbol: string;
  tracker?: TrackerContext;
}

interface BacktestStrategyMeta {
  id: string;
  label: string;
  description: string;
  wired: boolean;
}

function getTrackerBacktestStrategy(tracker: TrackerContext): BacktestStrategyMeta {
  switch (tracker) {
    case "fibonacci":
      return {
        id: "fibonacci",
        label: "Fibonacci & Trendline",
        description:
          "Fib 38.2/61.8 zone proximity + 추세선 break-out 기반 진입. 코인별 self-backtest 미지원.",
        wired: false,
      };
    case "vwap":
      return {
        id: "vwap",
        label: "VWAP + EMA(9)",
        description:
          "VWAP/EMA(9) Pullback v2 + Volume Profile 기반. D-005 calibration 대기 — 백엔드 strategy 파라미터 미배포.",
        wired: false,
      };
    case "bbdx":
    case "jeon-in-gu":
    default:
      return {
        id: "bbdx",
        label: "BBDX v6.6 (RSI + BB + ADX)",
        description:
          "3-path (BB → PTN → NUM) 진입 + Bollinger Band 기반 청산. trpc.backtest.run 의 default 전략.",
        wired: true,
      };
  }
}

function PlaceholderBacktest({ strategy }: { strategy: BacktestStrategyMeta }) {
  return (
    <HudPanel
      title={`${strategy.label} 백테스트`}
      subtitle="STRATEGY-SPECIFIC BACKTEST"
    >
      <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
        <Info className="h-6 w-6 text-neon-yellow" />
        <p className="font-mono text-sm text-foreground">
          {strategy.label} 전용 백테스트는 아직 wire 되지 않았습니다.
        </p>
        <p className="font-mono text-xs text-muted-foreground max-w-md leading-relaxed">
          {strategy.description}
        </p>
        <p className="font-mono text-xs text-muted-foreground max-w-md leading-relaxed">
          현재 단일 코인 백테스트는 BBDX 전략만 지원. 멀티 전략 비교는{" "}
          <Link
            href="/backtest"
            className="text-neon-cyan underline hover:text-neon-pink transition-colors"
          >
            /backtest
          </Link>{" "}
          페이지 사용 (BBDX modifier 포함 전 차원 통합 결과).
        </p>
      </div>
    </HudPanel>
  );
}

export function CoinBacktestTab({ symbol, tracker = "bbdx" }: CoinBacktestTabProps) {
  const strategy = getTrackerBacktestStrategy(tracker);

  if (!strategy.wired) {
    return (
      <div className="space-y-4">
        <HudPanel title="전략 정보" subtitle="STRATEGY METADATA">
          <dl className="space-y-1.5 font-mono text-xs">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">전략 라벨</dt>
              <dd className="text-neon-cyan">{strategy.label}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">백엔드 strategy ID</dt>
              <dd className="text-foreground">{strategy.id}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Wire 상태</dt>
              <dd className="text-neon-yellow">PENDING (placeholder)</dd>
            </div>
          </dl>
        </HudPanel>
        <PlaceholderBacktest strategy={strategy} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <HudPanel title="전략 정보" subtitle="STRATEGY METADATA">
        <dl className="space-y-1.5 font-mono text-xs">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">전략 라벨</dt>
            <dd className="text-neon-cyan">{strategy.label}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">백엔드 strategy ID</dt>
            <dd className="text-foreground">{strategy.id}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Wire 상태</dt>
            <dd className="text-neon-green">FULL (trpc.backtest.run + trpc.winRate.rolling)</dd>
          </div>
        </dl>
      </HudPanel>

      {/* Rolling 승률 (30 / 90 / 365 days) — BBDX 기준 */}
      <HudPanel title="Rolling 승률" subtitle="30 / 90 / 365 일 백테스트 캐시">
        <WinRateTab symbol={symbol} tf="4h" />
      </HudPanel>

      {/* Full 1년 백테스트 */}
      <HudPanel title="1년 백테스트" subtitle="4H · BBDX 단일 코인 시뮬레이션">
        <BacktestTab symbol={symbol} />
      </HudPanel>
    </div>
  );
}
