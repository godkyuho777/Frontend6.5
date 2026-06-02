import { useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";

import { HudPanel } from "@/components/HudPanel";
import { RefreshIconButton } from "@/components/RefreshIconButton";
import { CharterFooter } from "@/components/strategies/CharterFooter";
import { Badge } from "@/components/ui/badge";
import { MacroStatusBadge } from "@/components/macro/MacroStatusBadge";
import { MacroCurrentValueCards } from "@/components/macro/MacroCurrentValueCards";
import { MacroTimeSeriesChart } from "@/components/macro/MacroTimeSeriesChart";
import { MacroRegimeCard } from "@/components/macro/MacroRegimeCard";
import { MacroInterpretation } from "@/components/macro/MacroInterpretation";
import { MacroBbdxImpactCard } from "@/components/macro/MacroBbdxImpactCard";
import {
  useMacroIndicator,
  type MacroPeriod,
} from "@/hooks/useMacroIndicator";
import type { MacroIndicatorKey } from "@shared/macro-indicator-types";

/**
 * Macro Liquidity Tracker — 5개 detail 페이지 공통 골격.
 *
 * `useMacroIndicator(key)` 한 번 호출로 모든 sub-component 가 필요한
 * 데이터를 받는다. stub / live / stale / error 상태를 page-level 에서 처리하고,
 * sub-component 는 각자 fallback UI 를 표시.
 *
 *  + Header (제목 + 차원 + LIVE/STUB/STALE 배지 + 새로고침)
 *  + Stub 안내 카드 (status="stub" 일 때만 상단 표시)
 *  + CurrentValueCards (현재 수치)
 *  + 좌: TimeSeriesChart / 우: RegimeCard
 *  + Interpretation (가장 중요한 동적 분석)
 *  + BbdxImpactCard (regime 시뮬레이터)
 *  + CharterFooter (R3 면책)
 */
interface MacroIndicatorPageProps {
  indicatorKey: MacroIndicatorKey;
  /** 차트 1줄 요약 / interpretation 에 강조할 시리즈 ID (보통 derived). */
  primarySeriesId?: string;
  /** TimeSeriesChart 에 0 라인 표시 (spread 류). */
  showZeroLine?: boolean;
}

export function MacroIndicatorPage({
  indicatorKey,
  primarySeriesId,
  showZeroLine,
}: MacroIndicatorPageProps) {
  const [period, setPeriod] = useState<MacroPeriod>("1y");
  const macro = useMacroIndicator(indicatorKey, { period });
  const { meta, layer, status, series, ageHours, freshnessMult, refetch, isLoading } = macro;

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
              {meta.title}
            </h1>
            <Badge variant="outline" className="font-mono text-[10px]">
              {meta.dimension}
            </Badge>
            <MacroStatusBadge status={status} />
          </div>
          <p className="text-xs font-mono text-muted-foreground">
            {meta.description}
          </p>
          <p className="text-[11px] font-mono text-neon-cyan/80">
            {meta.tagline}
          </p>
        </div>
        <RefreshIconButton
          onClick={refetch}
          label={`${meta.title} 새로고침`}
          isLoading={isLoading}
        />
      </div>

      {/* Loading top-level */}
      {isLoading && !layer ? (
        <HudPanel>
          <div className="py-12 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-neon-cyan" />
            <span className="ml-3 font-mono text-xs text-muted-foreground">
              스냅샷을 불러오는 중...
            </span>
          </div>
        </HudPanel>
      ) : null}

      {/* Stub 안내 카드 (상단) */}
      {status === "stub" && (
        <HudPanel variant="highlight">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-orange-300 mt-0.5 shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-display text-sm font-bold text-orange-300">
                  FRED_API_KEY 등록 대기 중
                </span>
                <Badge
                  variant="outline"
                  className="font-mono text-[9px] border-orange-400/60 text-orange-300 bg-orange-500/10"
                >
                  STUB
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Railway 백엔드 환경변수에 <code className="font-mono text-neon-cyan">FRED_API_KEY</code>{" "}
                를 등록하면 본 페이지의 실데이터 + 동적 해석이 즉시 활성화됩니다.
                현재는 정적 룰북 기반 일반 해석 + 학술 레퍼런스 + 역사적 사례를
                표시합니다.
              </p>
              <p className="text-[11px] font-mono text-muted-foreground/80">
                FRED 무료 키 발급:{" "}
                <a
                  href="https://fred.stlouisfed.org/docs/api/api_key.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-neon-cyan"
                >
                  fred.stlouisfed.org/docs/api/api_key.html
                </a>
              </p>
            </div>
          </div>
        </HudPanel>
      )}

      {status === "stale" && (
        <HudPanel>
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-neon-yellow mt-0.5 shrink-0" />
            <div className="flex-1">
              <div className="font-display text-sm font-bold text-neon-yellow">
                데이터 경과 48시간 초과 (STALE)
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                FRED 응답은 받았지만 스냅샷이 오래되었습니다. 신선도 multiplier가
                자동 적용되어 BBDX 영향이 감쇄됩니다.
              </p>
            </div>
          </div>
        </HudPanel>
      )}

      {/* Current values */}
      <MacroCurrentValueCards
        keys={meta.currentValueKeys}
        layer={layer}
        status={status}
        series={series}
        primarySeriesId={primarySeriesId}
      />

      {/* Chart + Regime */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <MacroTimeSeriesChart
            series={series}
            period={period}
            onPeriodChange={setPeriod}
            showZeroLine={showZeroLine}
            isLoading={isLoading}
          />
        </div>
        <MacroRegimeCard
          layer={layer}
          status={status}
          ageHours={ageHours}
          freshnessMult={freshnessMult}
        />
      </div>

      {/* Interpretation */}
      <MacroInterpretation
        meta={meta}
        layer={layer}
        status={status}
        series={series}
        primarySeriesId={primarySeriesId}
      />

      {/* BBDX impact simulator */}
      <MacroBbdxImpactCard layer={layer} status={status} />

      {/* Charter footer */}
      <CharterFooter
        isBeta={status === "stub" || status === "stale"}
        extraNote={
          status === "stub"
            ? "현재 stub 모드 — FRED_API_KEY 등록 후 실데이터 활성화."
            : undefined
        }
      />
    </div>
  );
}
