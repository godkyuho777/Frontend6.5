import { MacroPlaceholder } from "@/components/macro/MacroPlaceholder";

export default function MacroDxyVix() {
  return (
    <MacroPlaceholder
      title="DXY / VIX"
      dimension="6차원 매크로"
      source="FRED DTWEXBGS (Broad Dollar Index) + CBOE VIXCLS"
      expectedQuarter="2026 Q3"
      description="달러 강도(DXY) + 공포 지수(VIX) 결합. 강달러·고변동성 동반 시 위험자산 multiplier 강하 (×0.6). v6.5 머지 후 cross-asset correlation 매핑 예정."
    />
  );
}
