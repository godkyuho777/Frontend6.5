/**
 * VWAP Strategy — 매매기준 탭 (정적 룰).
 *
 * 명세: TRACKER_TAB_STANDARD §3 + VWAP 5-component (§9.1).
 *
 * VWAP + EMA(9) + Pullback v2 + Volume Profile 5-component 진입 룰을 정적
 * 표로 표시. fibMult 와 유사한 vwapMult [0.7, 1.3] 로 BBDX 점수에 곱.
 */

import {
  CriteriaTab as CriteriaTabStandard,
  type CharterRow,
  type WeightRow,
} from "@/components/trackers/tabs";

const ENTRY_LONG = [
  "가격 > VWAP (또는 AT)",
  "EMA(9) > VWAP — 단기 추세 동의",
  "Pullback v2 detected (5캔들 VWAP 터치 + 다음 캔들 반등)",
  "Volume Profile 지지 (HVN/POC 부근) + 구조 (LVN 위)",
  "BBDX 최종 신뢰도 ≥ 40 (단독 발행 X — modifier-only)",
];

const ENTRY_SHORT = [
  "가격 < VWAP (또는 AT)",
  "EMA(9) < VWAP — 단기 추세 동의",
  "Pullback v2 detected (5캔들 VWAP 터치 + 다음 캔들 거부)",
  "Volume Profile 저항 (HVN/POC 부근) + 구조 (LVN 아래)",
  "BBDX 최종 신뢰도 ≥ 40 (단독 발행 X — modifier-only)",
];

const WEIGHTS: WeightRow[] = [
  { name: "VWAP 거리 (1σ/2σ band)", value: 0.25, highlight: true },
  { name: "EMA(9) 위치", value: 0.20 },
  { name: "EMA 되돌림 (Pullback v2)", value: 0.25 },
  { name: "Volume Profile 지지 (HVN/POC)", value: 0.15 },
  { name: "Volume Profile 구조 (LVN 위)", value: 0.15 },
];

const WEIGHTS_NOTE =
  "VWAP 5-component (명세서 §9.1). 임시값 — Phase α calibration 대기. " +
  "Pullback 미감지 시 자동 ×0.5 감쇠. 1σ band 안일 때 ×1.0, 2σ 초과 시 ×1.2.";

const THRESHOLDS = {
  "최소 신뢰도": 40,
  "최종 신뢰도 임계": 50,
  "VWAP band σ": "1σ / 2σ / 3σ",
  "Pullback 윈도우": "5캔들 VWAP 터치",
  "Multi-TF 정합": "1H/4H/1D 동일 방향 시 +bonus",
};

const SAFETY: string[] = [
  "VwapSignal 단독 발행 → vwapMult (0.7~1.3) 로 변환 후 BBDX 진입에 곱",
  "단일 코인 max 5% 자본 (BBDX 표준)",
  "Pullback 미감지 시 weight 자동 0 (스킵)",
  "Volume Profile 데이터 미수신 → VP 차원 weight 자동 0",
  "vwapMult clamp [0.7, 1.3] 강제",
];

const EXIT: string[] = [
  "VWAP 반대 방향 cross — 즉시 청산 검토",
  "EMA(9) VWAP 반대 방향 break — STOP 트리거",
  "STOP LOSS: BB 반대 끝 (BBDX 표준)",
  "TP1: 다음 σ band (1σ → 2σ)",
];

const CHARTER: CharterRow[] = [
  {
    rule: 1,
    status: "pass",
    label:
      "rule1Exempt — VWAP 은 거래량/시장 구조 차원 (RSI/ADX 와 직교)",
  },
  {
    rule: 2,
    status: "warn",
    label: "임시값 calibration 미완 (Phase α D-005)",
  },
  {
    rule: 3,
    status: "pass",
    label: "modifier-only (vwapMult 0.7~1.3 곱)",
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
