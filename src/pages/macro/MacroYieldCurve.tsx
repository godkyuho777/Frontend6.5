/**
 * Macro Liquidity Tracker — Yield Curve (10Y-2Y) detail.
 *
 * Phase 3b wiring (2026-05). Placeholder 가 아닌 실데이터 + 동적 해석.
 * FRED_API_KEY 미설정 상태에서는 정적 룰북 + 학술 레퍼런스 (Estrella &
 * Mishkin / Bauer & Mertens / Aramonte BIS / Hu & Hong) + 역사적 사례
 * (2019-08 first inversion / 2022-07 inversion / 2023-07 max inversion /
 * 2024-09 un-inversion) 를 표시 (stub-first 헌장 준수).
 *
 * primary 시리즈는 T10Y2Y (DGS10-DGS2 derived) — 0 라인 강조 (역전 신호).
 *
 * C4 Cycle Phase 카드는 categorical (pre_recession / recession_imminent /
 * fed_pivot / crypto_rally / neutral) — 색상 매핑 적용.
 */
import { MacroIndicatorPage } from "@/components/macro/MacroIndicatorPage";

export default function MacroYieldCurve() {
  return (
    <MacroIndicatorPage
      indicatorKey="yield-curve"
      primarySeriesId="T10Y2Y"
      showZeroLine
    />
  );
}
