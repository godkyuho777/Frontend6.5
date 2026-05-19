/**
 * useThrottledValue — leading-edge + trailing-edge throttle hook (2026-05-20).
 *
 * 입력 value 가 ms 간격보다 자주 바뀌어도 출력은 최대 한 번 / ms 동안만
 * 갱신된다. 마지막 값을 절대 누락하지 않기 위해 trailing-edge 도 보장.
 *
 * 사용 예 — Simulator.tsx 의 ticker 250ms throttle:
 *   const throttledTicker = useThrottledValue(ticker, 250);
 *
 *   useEffect(() => {
 *     // throttledTicker 갱신마다 mark-to-market 1회 실행 (≤ 250ms).
 *   }, [throttledTicker]);
 *
 * 동작:
 *   1) 마지막 갱신 후 ms 가 지났으면 → 즉시 setThrottled(value).
 *   2) 안 지났으면 → 남은 시간 후 setThrottled(value) (trailing).
 *
 * 주의:
 *   - 본 hook 은 reference equality 기반 — `value` 가 매 render 새 object 면
 *     매번 effect 재실행. 호출자가 stable 한 값 (primitive / memoized object) 을
 *     넘겨야 effective.
 *   - timer cleanup 은 effect deps 가 바뀔 때 자동 — race condition 없음.
 *
 * INVESTMENT_SIMULATOR_AUDIT.md Phase 3 #3 (분봉 버벅거림 최적화).
 */

import { useEffect, useRef, useState } from "react";

export function useThrottledValue<T>(value: T, ms: number): T {
  const [throttled, setThrottled] = useState<T>(value);
  const lastUpdateRef = useRef<number>(Date.now());

  useEffect(() => {
    const now = Date.now();
    const elapsed = now - lastUpdateRef.current;
    if (elapsed >= ms) {
      // Leading edge — 즉시 갱신.
      setThrottled(value);
      lastUpdateRef.current = now;
      return;
    }
    // Trailing edge — 남은 시간 후 갱신.
    const remaining = ms - elapsed;
    const t = setTimeout(() => {
      setThrottled(value);
      lastUpdateRef.current = Date.now();
    }, remaining);
    return () => clearTimeout(t);
  }, [value, ms]);

  return throttled;
}
