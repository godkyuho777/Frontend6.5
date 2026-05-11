import { TrackerHub } from "@/components/trackers/TrackerHub";

/**
 * Layer 1 — Signal Tracker Hub.
 *
 * 4H 캔들 단위의 BBDX(RSI+BB+ADX) 3-path 진입 룰을 구성하는 1·2·3·4 차원 modifier 들.
 * 모든 요소는 BBDX 신뢰도 multiplier 로만 작동 (헌장 규칙 3).
 */
export default function SignalTrackerHub() {
  return (
    <TrackerHub
      layer="signal"
      title="Signal Tracker"
      subtitle="Layer 1 — 4H 캔들 단위 진입 트리거"
      dimensionBadge="1·2·3·4 차원 커버"
      explanation={
        "BBDX (RSI+BB+ADX) 3-path 진입 룰의 핵심 입력. " +
        "캔들 단위 1·2·3·4 차원 modifier 들. " +
        "모든 요소는 BBDX 가중치(multiplier)로만 작동 — 단독 매매 신호 발행 X."
      }
    />
  );
}
