/**
 * Macro Liquidity Tracker — DXY / VIX detail.
 *
 * Phase 3c wiring (2026-05). Placeholder 가 아닌 실데이터 + 동적 해석.
 * FRED_API_KEY 미설정 상태에서는 정적 룰북 + 학술 레퍼런스 (Adrian/Crump/
 * Vogt / Bekaert / Glassnode / CME / Bruno & Shin) + 역사적 사례
 * (2020-03 DXY+8% / 2022-09 DXY peak 114.78 / 2024-08 VIX 65 yen carry
 * unwind / 2025-04 DXY reversal -3%) 를 표시 (stub-first 헌장 준수).
 *
 * primary 시리즈는 raw "VIXCLS" — VIX 절대 수준이 layer 에 직접 포함됨.
 * (DXY 절대 수준은 layer 에 없음 — dxy_change_30d_pct 가 primary 카드 역할)
 *
 * Current Values 카드 3개: DXY 30d Change (primary) / VIX Level / C2 Risk-On.
 */
import { MacroIndicatorPage } from "@/components/macro/MacroIndicatorPage";

export default function MacroDxyVix() {
  return (
    <MacroIndicatorPage
      indicatorKey="dxy-vix"
      primarySeriesId="VIXCLS"
    />
  );
}
