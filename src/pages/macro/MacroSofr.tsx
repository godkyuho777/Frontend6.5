/**
 * Macro Liquidity Tracker — SOFR-IORB Spread detail.
 *
 * Phase 2 wiring (2026-05). Placeholder 가 아닌 실데이터 + 동적 해석.
 * FRED_API_KEY 미설정 상태에서는 정적 룰북 + 학술 레퍼런스 + 역사적 사례
 * 표시 (stub-first 헌장 준수).
 *
 * primary 시리즈는 derived "SOFR_IORB_SPREAD" — 라벨 단위 bp, 차트에 0 라인
 * 표시 (역사적 위기 영역 5bp+ 가시화).
 */
import { MacroIndicatorPage } from "@/components/macro/MacroIndicatorPage";

export default function MacroSofr() {
  return (
    <MacroIndicatorPage
      indicatorKey="sofr-iorb"
      primarySeriesId="SOFR_IORB_SPREAD"
      showZeroLine
    />
  );
}
