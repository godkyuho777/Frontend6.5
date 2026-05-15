/**
 * Macro Liquidity Tracker — Real Rate (10Y TIPS) + Breakeven detail.
 *
 * Phase 3d wiring (2026-05). Placeholder 가 아닌 실데이터 + 동적 해석.
 * FRED_API_KEY 미설정 상태에서는 정적 룰북 + 학술 레퍼런스 (Gürkaynak/
 * Sack/Wright 2010 / Krishnamurthy & Vissing-Jorgensen 2012 / Glassnode +
 * Coinbase 2024 / DeMiguel 2024 JFE / Choi & Yoon 2022) + 역사적 사례
 * (2020-08 -1.06% 최저 / 2022-10 +1.74% 10y high / 2024-09 1.40% pivot /
 * 2025-03 breakeven 2.45→2.15) 표시 (stub-first 헌장 준수).
 *
 * primary 시리즈는 raw "DFII10" — 10Y TIPS 실질금리. 0 라인 강조 (음수 영역
 * 진입 = bull spot).
 *
 * Derived 시리즈 "BREAKEVEN_10Y" = DGS10 - DFII10 = implied 기대인플레.
 * useMacroIndicator hook 의 deriveSpread 가 자동 계산하여 차트 및 카드에 표시.
 */
import { MacroIndicatorPage } from "@/components/macro/MacroIndicatorPage";

export default function MacroRealRate() {
  return (
    <MacroIndicatorPage
      indicatorKey="real-rate"
      primarySeriesId="DFII10"
      showZeroLine
    />
  );
}
