import { MacroPlaceholder } from "@/components/macro/MacroPlaceholder";

export default function MacroRealRate() {
  return (
    <MacroPlaceholder
      title="Real Rate (10Y TIPS)"
      dimension="6차원 매크로"
      source="FRED DFII10 (10-Year Treasury Inflation-Indexed Securities)"
      expectedQuarter="2026 Q3"
      description="명목금리 - 기대인플레 = 실질금리. 실질금리 상승은 위험자산에 직접 역풍. v6.5 머지 후 6개월 추세 + Fed dot plot cross-check 매핑 예정."
    />
  );
}
