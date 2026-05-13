/**
 * CoinBacktestTab — 코인 상세 페이지의 "백테스트" 탭.
 *
 * 기존 BacktestTab (단일 코인 백테스트 — MetricCards + EquityChart + TradeTable)
 * 그대로 재사용 + 30/90/365 일 rolling WinRateTab 추가 (서브 섹션).
 *
 * 명세: TRACKER_TAB_STANDARD §2.4.
 */

import { BacktestTab } from "../BacktestTab";
import { WinRateTab } from "../WinRateTab";
import { HudPanel } from "@/components/HudPanel";

interface CoinBacktestTabProps {
  symbol: string;
}

export function CoinBacktestTab({ symbol }: CoinBacktestTabProps) {
  return (
    <div className="space-y-4">
      {/* Rolling 승률 (30 / 90 / 365 days) */}
      <HudPanel title="Rolling 승률" subtitle="30 / 90 / 365 일 백테스트 캐시">
        <WinRateTab symbol={symbol} tf="4h" />
      </HudPanel>

      {/* Full 1년 백테스트 — Run 버튼 + 결과 */}
      <HudPanel title="1년 백테스트" subtitle="4H · BBDX 단일 코인 시뮬레이션">
        <BacktestTab symbol={symbol} />
      </HudPanel>
    </div>
  );
}
