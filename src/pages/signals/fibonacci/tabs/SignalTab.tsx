/**
 * Fibonacci & Trendline — 실시간 신호 탭.
 *
 * 기존 Fibonacci.tsx (코인 리스트 스캐너) 를 SignalTab 안에 직접 import.
 * 5-탭 wrapper 패턴 — 기존 페이지 코드는 손대지 않고 그대로 재사용.
 *
 * 명세: TRACKER_TAB_STANDARD §2.2 + Fibonacci 코인 리스트 (Fib zone + trendline
 * 활성도 + BUY/SELL 시그널 chip).
 */

import FibonacciLegacy from "@/pages/Fibonacci";

export function SignalTab() {
  return (
    <div className="-mt-2">
      {/* 기존 Fibonacci.tsx 의 헤더 (상단 타이틀) 가 wrapper 헤더와 중복되지만
          페이지 내용 핵심 (StatCard + 코인 테이블) 은 그대로 재사용. */}
      <FibonacciLegacy />
    </div>
  );
}
