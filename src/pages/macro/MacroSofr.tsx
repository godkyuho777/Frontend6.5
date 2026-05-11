import { MacroPlaceholder } from "@/components/macro/MacroPlaceholder";

export default function MacroSofr() {
  return (
    <MacroPlaceholder
      title="SOFR-IORB Spread"
      dimension="6차원 매크로"
      source="FRED SOFR + IORB (Secured Overnight Financing Rate vs Interest on Reserve Balances)"
      expectedQuarter="2026 Q3"
      description="단기 자금조달 스트레스 지표. SOFR 가 IORB 를 초과하면 자금 경색 신호. v6.5 머지 후 FRED API 통합 + multiplier 매핑 (regime: tight/neutral/easy) 활성화 예정."
    />
  );
}
