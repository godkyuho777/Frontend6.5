/**
 * CoinCriteriaTab — BBDX 매매기준 정적 룰 (코인 상세 페이지 안).
 *
 * 트래커별 매매기준은 정적 명세 (BBDX v6.1+ 헌장). 코인별 calibrated 값은
 * SignalTab 의 WeightSourceBadge 가 별도 표시. 본 탭은 *전략 명세* 만.
 *
 * 명세: BBDX 헌장 + TRACKER_TAB_STANDARD §2.1.
 */

import {
  CriteriaTab as CriteriaTabStandard,
  type CharterRow,
  type WeightRow,
} from "@/components/trackers/tabs";

interface CoinCriteriaTabProps {
  symbol: string;
}

const ENTRY_LONG = [
  "RSI ∈ [25, 38] AND close ≤ BB.lower × 1.02 AND ADX < 20 → NUM path",
  "강세 캔들 패턴 (Hammer / Bullish Engulfing / Morning Star) + BB lower 근접 + ADX < 25 → PTN path",
  "BB Structure: Lower Bounce / Riding / Middle Support / Squeeze + 확장 → BB path",
  "BBDX 최종 신뢰도 ≥ 40 (3-path 우선순위: BB → PTN → NUM)",
];

const ENTRY_SHORT = [
  "RSI ∈ [62, 75] AND close ≥ BB.upper × 0.98 AND ADX < 20 → NUM path (대칭)",
  "약세 캔들 패턴 (Shooting Star / Bearish Engulfing / Evening Star) + BB upper 근접 → PTN path",
  "BB Structure: Upper Rejection / Bearish Riding + ADX > 20 → BB path",
  "v6.6 ENABLE_SHORT_SIGNALS=1 환경에서만 발행. v6.5 fallback 은 LONG only.",
];

const WEIGHTS: WeightRow[] = [
  { name: "momentum (RSI)", value: 0.30, highlight: true },
  { name: "position (BB)", value: 0.25, highlight: true },
  { name: "trend (ADX/+DI/-DI)", value: 0.20 },
  { name: "volume (Volume Ratio)", value: 0.15 },
  { name: "action (Candle Pattern)", value: 0.10 },
];

const WEIGHTS_NOTE =
  "BBDX 5-component (모멘텀 + 위치 + 추세 + 거래량 + 액션). 코인 별 self-backtest " +
  "calibrated weight 는 SignalTab 의 WeightSourceBadge 로 별도 표시.";

const THRESHOLDS = {
  "진입 최소 신뢰도": 40,
  "BBDX 최종 신뢰도": 50,
  "RSI Long 범위": "25 ~ 38",
  "RSI Short 범위": "62 ~ 75",
  "ADX (NUM path)": "< 20",
  "ADX (BB path)": "≥ 20",
  "Falling Knife 차단": "ADX > 30 & -DI > +DI",
};

const SAFETY: string[] = [
  "Falling Knife detection — ADX > 30 + -DI 우위 시 진입 차단",
  "Lookahead-free — i 시점 결정은 i 이전 데이터만 참조 (헌장 2)",
  "Modifier-only — onchain / wave / vwap 등 보조 차원은 BBDX 곱셈 multiplier 로만 (헌장 3)",
  "BB 폭 < 3% 시 squeeze 진입 차단",
  "v6.6 LONG ↔ SHORT 동시 발생 시 양쪽 차단 (conflict resolution: both_blocked)",
];

const EXIT: string[] = [
  "TP1 — entry × (1 + ATR-based factor) 또는 BB middle 도달",
  "TP2 — BB upper 도달 또는 RSI ≥ 70 (LONG) / RSI ≤ 30 (SHORT)",
  "STOP — BB.lower × 0.97 (LONG) / min(BB.upper × 1.03, entry × 1.02) (SHORT v6.6)",
  "Trailing stop — entry 이후 +2% 도달 시 break-even 로 이동",
  "Time-based exit — outcomeWindow 캔들 후 강제 청산 (백테스트 기준)",
];

const CHARTER: CharterRow[] = [
  {
    rule: 1,
    status: "pass",
    label: "다차원 합의 (5-component BBDX + onchain/wave/vwap modifier)",
  },
  {
    rule: 2,
    status: "pass",
    label: "Lookahead-free (signal-extractor.ts 의 i-1 보장)",
  },
  {
    rule: 3,
    status: "pass",
    label: "Modifier-only (BBDX 단독 진입, 보조 차원은 multiplier)",
  },
  {
    rule: "V",
    status: "warn",
    label: "검증 (코인별 self-backtest calibration 진행 중)",
  },
];

export function CoinCriteriaTab({ symbol }: CoinCriteriaTabProps) {
  const baseSymbol = symbol.replace(/USDT$/, "");
  return (
    <CriteriaTabStandard
      entry_rules={{ long: ENTRY_LONG, short: ENTRY_SHORT }}
      weights={WEIGHTS}
      weights_source_note={`${WEIGHTS_NOTE} (현재 코인: ${baseSymbol})`}
      thresholds={THRESHOLDS}
      safety_mechanisms={SAFETY}
      exit_rules={EXIT}
      charter_compliance={CHARTER}
    />
  );
}
