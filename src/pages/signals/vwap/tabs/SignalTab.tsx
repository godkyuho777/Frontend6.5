/**
 * VWAP Strategy — 실시간 신호 탭.
 *
 * 기존 Vwap.tsx (코인 리스트 + Deep Dive 패널 + VwapDetailPanels) 를 SignalTab
 * 안에 직접 import. 5-탭 wrapper 패턴 — 기존 페이지 코드는 손대지 않고 그대로
 * 재사용 (회귀 0).
 *
 * 명세: TRACKER_TAB_STANDARD §2.2 + VWAP 5-component card.
 */

import VwapLegacy from "@/pages/Vwap";

export function SignalTab() {
  return (
    <div className="-mt-2">
      {/* 기존 Vwap.tsx 의 헤더가 wrapper 헤더와 중복 표시되지만 페이지 내용 핵심
          (StatCard + 코인 테이블 + VwapDetailPanels 하단 Deep Dive) 은 그대로 재사용. */}
      <VwapLegacy />
    </div>
  );
}
