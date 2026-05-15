/**
 * Macro Liquidity Tracker — Fed Balance Sheet (WALCL) detail.
 *
 * Phase 3a wiring (2026-05). Placeholder 가 아닌 실데이터 + 동적 해석.
 * FRED_API_KEY 미설정 상태에서는 정적 룰북 + 학술 레퍼런스 (Bernanke / Adrian
 * & Boyarchenko / JPM / Bitwise / Caballero & Simsek) + 역사적 사례
 * (2020-03 COVID QE / 2022-04 QT 시작 / 2023-03 BTFP / 2024-09 Fed pivot)
 * 를 표시 (stub-first 헌장 준수).
 *
 * primary 시리즈는 raw "WALCL" — Total Assets 절대 수준. FRED 백엔드 응답은
 * $M (millions) 단위로 옴 → UI 에서는 formatValue 로 $T 자동 환산.
 */
import { MacroIndicatorPage } from "@/components/macro/MacroIndicatorPage";

export default function MacroWalcl() {
  return (
    <MacroIndicatorPage
      indicatorKey="walcl"
      primarySeriesId="WALCL"
    />
  );
}
