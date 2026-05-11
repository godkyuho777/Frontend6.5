import { MacroPlaceholder } from "@/components/macro/MacroPlaceholder";

export default function MacroYieldCurve() {
  return (
    <MacroPlaceholder
      title="Yield Curve (10Y-2Y)"
      dimension="6차원 매크로"
      source="FRED T10Y2Y (10-Year Treasury Constant Maturity Minus 2-Year)"
      expectedQuarter="2026 Q3"
      description="장단기 금리 스프레드. 역전 (음수) 시 침체 신호. v6.5 머지 후 FRED 통합 + 역전 구간 위험 multiplier (×0.7) 매핑 예정."
    />
  );
}
