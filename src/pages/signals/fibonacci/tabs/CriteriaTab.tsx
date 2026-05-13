/**
 * Fibonacci & Trendline — 매매기준 탭 (정적 룰).
 *
 * 명세: TRACKER_TAB_STANDARD §3 · BBDX 헌장 (Fibonacci 는 시장 구조 차원).
 *
 * Fibonacci 38.2/50/61.8/78.6 + 추세선 break/bounce 룰을 정적 표로 표시.
 * 본 페이지는 실제 백테스트/모듈 가중치가 아닌 *전략 명세* 를 보여줌.
 */

import {
  CriteriaTab as CriteriaTabStandard,
  type CharterRow,
  type WeightRow,
} from "@/components/trackers/tabs";

const ENTRY_LONG = [
  "Fibonacci 0.618 (Golden Pocket) 또는 0.5/0.382 retracement 지지",
  "추세선 (active trendline ≥ 1) bullish bounce 확인",
  "ADX ≥ 20 (추세 강도) + +DI > -DI (방향 일치)",
  "BBDX 최종 신뢰도 ≥ 40 (단독 발행 X — modifier-only)",
];

const ENTRY_SHORT = [
  "Fibonacci extension 1.272/1.618 또는 0.786 저항 break-down",
  "추세선 (active trendline ≥ 1) bearish break 또는 거부",
  "ADX ≥ 20 + -DI > +DI",
  "BBDX 최종 신뢰도 ≥ 40 (단독 발행 X — modifier-only)",
];

const WEIGHTS: WeightRow[] = [
  { name: "Fib Zone (0.382~0.618 Golden)", value: 0.30, highlight: true },
  { name: "Trendline 활성도", value: 0.25 },
  { name: "Fib Extension (1.272/1.618)", value: 0.20 },
  { name: "BBDX confluence (RSI+BB+ADX)", value: 0.15 },
  { name: "Multi-TF 정합 (4h/1d)", value: 0.10 },
];

const WEIGHTS_NOTE =
  "Fibonacci + Trendline 5-component (시장 구조 차원). 임시값 — Phase α calibration 대기. " +
  "Golden Pocket (0.382~0.618) 진입 시 가중치 ×1.0, 외부 zone 시 ×0.5 자동 감쇠.";

const THRESHOLDS = {
  "최소 신뢰도": 40,
  "Golden Pocket 범위": "0.382 ~ 0.618",
  "Extension 저항": "1.272 / 1.618",
  "Active trendline 최소": 1,
  "ADX 임계": "≥ 20 (추세 진입 조건)",
};

const SAFETY: string[] = [
  "Fib zone 미식별 (Out of range) → fibMult=1.0 중립값 적용",
  "Trendline 0개 → 추세선 차원 weight 자동 0 (스킵)",
  "BBDX final_score < 40 → 진입 차단 (헌장 3 — modifier-only)",
  "Falling knife (BB 폭 < 3%) 시 진입 차단",
  "fibMult clamp [0.7, 1.3] 강제",
];

const EXIT: string[] = [
  "BBDX 표준 EXIT (TP1/TP2/STOP) 우선",
  "Fibonacci 다음 level 도달 시 TP 분할 청산 검토",
  "추세선 break (반대 방향) 시 STOP 트리거",
  "BB 반대 끝 도달 시 STOP LOSS",
];

const CHARTER: CharterRow[] = [
  {
    rule: 1,
    status: "pass",
    label: "다차원 합의 (Fib + Trendline + BBDX + Multi-TF)",
  },
  {
    rule: 2,
    status: "pass",
    label: "Lookahead-free (Fib 계산은 i 이전 swing high/low 만 참조)",
  },
  {
    rule: 3,
    status: "pass",
    label: "Modifier-only (fibMult 로 BBDX 진입에 곱)",
  },
  { rule: "V", status: "warn", label: "검증 (Phase α 백테스트 calibration 대기)" },
];

export function CriteriaTab() {
  return (
    <CriteriaTabStandard
      entry_rules={{ long: ENTRY_LONG, short: ENTRY_SHORT }}
      weights={WEIGHTS}
      weights_source_note={WEIGHTS_NOTE}
      thresholds={THRESHOLDS}
      safety_mechanisms={SAFETY}
      exit_rules={EXIT}
      charter_compliance={CHARTER}
    />
  );
}
