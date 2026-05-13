/**
 * EMA + ADX 정배열 추세 — 매매기준 탭.
 * 5 보조지표 합성 룰 + 가중치 + 임계 + 헌장 통과 검증.
 */

import { CriteriaTab as CriteriaTabStandard } from "@/components/trackers/tabs";

export function CriteriaTab() {
  return (
    <CriteriaTabStandard
      entry_rules={{
        long: [
          "EMA 정배열 — EMA(9) > EMA(21) > EMA(50)",
          "ADX(14) ≥ 20 (추세 존재)",
          "+DI > -DI (강세 우위)",
          "SMA(50) 상승 + 가격 > SMA(50) (장기 컨텍스트)",
          "HH/HL 구조 — 직전 5캔들 high/low 평균이 그 이전 5캔들보다 위 (10캔들 Williams 단순화)",
          "Final confidence (가중치 합성) ≥ 55점",
        ],
        short: [
          "EMA 역배열 — EMA(9) < EMA(21) < EMA(50)",
          "ADX(14) ≥ 20",
          "-DI > +DI (약세 우위)",
          "SMA(50) 하락 + 가격 < SMA(50)",
          "LH/LL 구조 — 직전 5캔들 high/low 평균이 그 이전 5캔들보다 아래",
          "Final confidence ≥ 55점",
        ],
      }}
      weights={[
        { name: "EMA 정배열 강도", value: 0.30, highlight: true },
        { name: "ADX 추세 강도", value: 0.25 },
        { name: "±DI 방향 우위", value: 0.20 },
        { name: "SMA(50) 기울기", value: 0.15 },
        { name: "HH/HL 가격 구조", value: 0.10 },
      ]}
      weights_source_note="직관값 — Bybit API 기반 backtest calibration 미완. 향후 Wilson 95% CI + Profit Factor 기반 자동 재조정 예정."
      thresholds={{
        "Entry threshold (final confidence)": "≥ 55",
        "ADX 최소": "≥ 20",
        "ADX strong": "≥ 30 (DI_DIFF 정규화 cap)",
        "+DI - -DI strong": "≥ 10",
        "HH/HL lookback": "10 캔들 (Williams 5-bar 단순화)",
        "Hard gate (필수)": "EMA 정배열 + ADX + ±DI 셋 동시 통과",
      }}
      safety_mechanisms={[
        "Hard gate — 정배열·ADX·±DI 셋 미통과 시 final confidence 무관 진입 차단",
        "Stop loss — max(EMA21 × 0.99, entry × 0.97) — 추세 추종 손절 (좁지 않게)",
        "Target1 — min(직전 20캔들 swing high × 1.005, entry × 1.04)",
        "Target2 — min(직전 20캔들 swing high × 1.03, entry × 1.07)",
        "Lookahead-free — 모든 지표 계산은 현 캔들 이전 데이터만 사용",
        "LONG/SHORT 충돌 — 둘 다 발생 시 finalConfidence 높은 쪽 채택",
      ]}
      exit_rules={[
        "Target1 도달 — 50% 익절 (tier 1)",
        "Target2 도달 — 잔여 50% 익절 (tier 2)",
        "Stop loss 도달 — 전량 청산",
        "EMA 정배열/역배열 깨짐 — 시스템적 청산 (다음 캔들)",
        "ADX < 15 회귀 — 추세 소멸 신호로 보유 포지션 익절 검토",
      ]}
      charter_compliance={[
        { rule: 1, status: "pass", label: "다차원 합의 — 모멘텀(EMA) + 추세(ADX) + 구조(HH/HL) 3개 차원 합성" },
        { rule: 2, status: "warn", label: "Backtest 알파 검증 — calibration 미완 (직관값 임계 사용 중)" },
        { rule: 3, status: "pass", label: "Standalone 진입 — primary signal layer (BBDX/Fibonacci/VWAP 와 동급, modifier 가 아님)" },
        { rule: "V", status: "pass", label: "Lookahead-free — 현 캔들 이전 데이터만 사용" },
      ]}
    />
  );
}
