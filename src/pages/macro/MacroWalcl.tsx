import { MacroPlaceholder } from "@/components/macro/MacroPlaceholder";

export default function MacroWalcl() {
  return (
    <MacroPlaceholder
      title="Fed Balance Sheet (WALCL)"
      dimension="6차원 매크로"
      source="FRED WALCL (Total Assets of All Federal Reserve Banks)"
      expectedQuarter="2026 Q3"
      description="Fed 대차대조표 규모 — QE/QT 사이클 추적. 30일 변화율 + 6개월 추세로 regime (expanding/neutral/contracting) 분류 예정. Overview 탭에 이미 통합되어 있으나 단독 detail 탭으로 분리 예정."
    />
  );
}
