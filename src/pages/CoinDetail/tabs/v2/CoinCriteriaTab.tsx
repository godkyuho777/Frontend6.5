/**
 * CoinCriteriaTab — 트래커 컨텍스트에 따라 다른 매매기준을 렌더링.
 *
 * 사용자 요구 (2026-05-13):
 *  - tracker=bbdx       → BBDX v6.6 (RSI+BB+ADX) 룰
 *  - tracker=fibonacci  → Fibonacci & Trendline 룰
 *  - tracker=vwap       → VWAP + EMA(9) 5-component 룰
 *  - 미지정             → bbdx default (기존 동작 유지)
 *
 * 명세: BBDX 헌장 + VWAP 명세서 §9.1 + Fibonacci spec.
 */

import {
  CriteriaTab as CriteriaTabStandard,
  type CharterRow,
  type WeightRow,
} from "@/components/trackers/tabs";
import type { TrackerContext } from "../../tracker-context";

interface CoinCriteriaTabProps {
  symbol: string;
  tracker?: TrackerContext;
}

// ---------------------------------------------------------------------------
// BBDX v6.6 — 기존 default
// ---------------------------------------------------------------------------

const BBDX_ENTRY_LONG = [
  "RSI ∈ [25, 38] AND close ≤ BB.lower × 1.02 AND ADX < 20 → NUM path",
  "강세 캔들 패턴 (Hammer / Bullish Engulfing / Morning Star) + BB lower 근접 + ADX < 25 → PTN path",
  "BB Structure: Lower Bounce / Riding / Middle Support / Squeeze + 확장 → BB path",
  "BBDX 최종 신뢰도 ≥ 40 (3-path 우선순위: BB → PTN → NUM)",
];

const BBDX_ENTRY_SHORT = [
  "RSI ∈ [62, 75] AND close ≥ BB.upper × 0.98 AND ADX < 20 → NUM path (대칭)",
  "약세 캔들 패턴 (Shooting Star / Bearish Engulfing / Evening Star) + BB upper 근접 → PTN path",
  "BB Structure: Upper Rejection / Bearish Riding + ADX > 20 → BB path",
  "v6.6 ENABLE_SHORT_SIGNALS=1 환경에서만 발행. v6.5 fallback 은 LONG only.",
];

const BBDX_WEIGHTS: WeightRow[] = [
  { name: "momentum (RSI)", value: 0.3, highlight: true },
  { name: "position (BB)", value: 0.25, highlight: true },
  { name: "trend (ADX/+DI/-DI)", value: 0.2 },
  { name: "volume (Volume Ratio)", value: 0.15 },
  { name: "action (Candle Pattern)", value: 0.1 },
];

const BBDX_THRESHOLDS = {
  "진입 최소 신뢰도": 40,
  "BBDX 최종 신뢰도": 50,
  "RSI Long 범위": "25 ~ 38",
  "RSI Short 범위": "62 ~ 75",
  "ADX (NUM path)": "< 20",
  "ADX (BB path)": "≥ 20",
  "Falling Knife 차단": "ADX > 30 & -DI > +DI",
};

const BBDX_SAFETY: string[] = [
  "Falling Knife detection — ADX > 30 + -DI 우위 시 진입 차단",
  "Lookahead-free — i 시점 결정은 i 이전 데이터만 참조 (헌장 2)",
  "Modifier-only — onchain / wave / vwap 등 보조 차원은 BBDX 곱셈 multiplier 로만 (헌장 3)",
  "BB 폭 < 3% 시 squeeze 진입 차단",
  "v6.6 LONG ↔ SHORT 동시 발생 시 양쪽 차단 (conflict resolution: both_blocked)",
];

const BBDX_EXIT: string[] = [
  "TP1 — entry × (1 + ATR-based factor) 또는 BB middle 도달",
  "TP2 — BB upper 도달 또는 RSI ≥ 70 (LONG) / RSI ≤ 30 (SHORT)",
  "STOP — BB.lower × 0.97 (LONG) / min(BB.upper × 1.03, entry × 1.02) (SHORT v6.6)",
  "Trailing stop — entry 이후 +2% 도달 시 break-even 로 이동",
  "Time-based exit — outcomeWindow 캔들 후 강제 청산 (백테스트 기준)",
];

const BBDX_CHARTER: CharterRow[] = [
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

function BbdxCriteria({ symbol }: { symbol: string }) {
  const baseSymbol = symbol.replace(/USDT$/, "");
  return (
    <CriteriaTabStandard
      entry_rules={{ long: BBDX_ENTRY_LONG, short: BBDX_ENTRY_SHORT }}
      weights={BBDX_WEIGHTS}
      weights_source_note={
        "BBDX 5-component (모멘텀 + 위치 + 추세 + 거래량 + 액션). 코인 별 self-backtest " +
        `calibrated weight 는 SignalTab 의 WeightSourceBadge 로 별도 표시. (현재 코인: ${baseSymbol})`
      }
      thresholds={BBDX_THRESHOLDS}
      safety_mechanisms={BBDX_SAFETY}
      exit_rules={BBDX_EXIT}
      charter_compliance={BBDX_CHARTER}
    />
  );
}

// ---------------------------------------------------------------------------
// Fibonacci & Trendline
// ---------------------------------------------------------------------------

const FIB_ENTRY_LONG = [
  "Fib 38.2% golden zone 근접 + 상승 추세선 intact → LONG 진입 후보",
  "Fib 50.0% / 61.8% (golden ratio) 지지 + 추세선 미파괴",
  "최근 swing high / swing low 식별 + ATR 기반 zone tolerance ±0.5%",
  "Trendline strength score ≥ 60 + Volume confirmation (volume ratio ≥ 1.0)",
];

const FIB_ENTRY_SHORT = [
  "Fib 38.2% 저항 + 하락 추세선 intact → SHORT 진입 후보",
  "Fib 50.0% / 61.8% 저항 거부 + 추세선 미파괴",
  "패턴 confluence (Shooting Star, Bearish Engulfing) + 거래량 spike",
  "Trendline strength score ≥ 60 + 상위 TF 정합 (1H/4H/1D 동일 방향)",
];

const FIB_WEIGHTS: WeightRow[] = [
  { name: "Fib zone proximity", value: 0.4, highlight: true },
  { name: "Trendline strength", value: 0.3, highlight: true },
  { name: "Volume confirmation", value: 0.2 },
  { name: "Pattern confluence", value: 0.1 },
];

const FIB_THRESHOLDS = {
  "진입 최소 신뢰도": 50,
  "Fib zone 거리": "±2% 이내",
  "Trendline strength": "≥ 60 (점수)",
  "Volume ratio": "≥ 1.0",
  "Tolerance (zone)": "±0.5%",
  "추세선 touch count": "≥ 2",
};

const FIB_SAFETY: string[] = [
  "추세선 break 즉시 진입 차단 (false break filter — wick 만 통과 시 유지)",
  "Lookahead-free — swing 식별은 i 이전 캔들만 사용 (헌장 2)",
  "Modifier-only — Fibonacci 신호는 BBDX multiplier (fibMult) 형태로 통합 (헌장 3)",
  "Fib zone 미존재 (insufficient swing data) 시 신호 발행 X",
  "Trendline duration < 5 candles 시 신뢰도 감점",
];

const FIB_EXIT: string[] = [
  "TP1 — Fib 100% 또는 다음 swing high/low 도달",
  "TP2 — 추세선 break (break-out 시 trailing stop)",
  "STOP — Fib 78.6% 이탈 또는 swing low/high 갱신",
  "Time stop — outcomeWindow 캔들 후 강제 청산",
];

const FIB_CHARTER: CharterRow[] = [
  {
    rule: 1,
    status: "pass",
    label: "다차원 — 시장구조 (5번 차원) 단일 사용 (Fibonacci + Trendline)",
  },
  {
    rule: 2,
    status: "pass",
    label: "Lookahead-free — swing 식별은 i 이전 캔들만 (analyzeFibonacci 의 historical only)",
  },
  {
    rule: 3,
    status: "pass",
    label: "Modifier-only — BBDX 단독 시그널 X (보강 차원으로만 통합 예정)",
  },
  {
    rule: "V",
    status: "warn",
    label: "검증 미완 — calibration 대기 (D-003 self-backtest)",
  },
];

function FibonacciCriteria({ symbol }: { symbol: string }) {
  const baseSymbol = symbol.replace(/USDT$/, "");
  return (
    <CriteriaTabStandard
      entry_rules={{ long: FIB_ENTRY_LONG, short: FIB_ENTRY_SHORT }}
      weights={FIB_WEIGHTS}
      weights_source_note={
        "Fibonacci 4-component (zone proximity + trendline strength + volume + pattern). " +
        `직관값 — calibration 대기 (현재 코인: ${baseSymbol}).`
      }
      thresholds={FIB_THRESHOLDS}
      safety_mechanisms={FIB_SAFETY}
      exit_rules={FIB_EXIT}
      charter_compliance={FIB_CHARTER}
    />
  );
}

// ---------------------------------------------------------------------------
// VWAP + EMA(9) — 명세서 §9.1
// ---------------------------------------------------------------------------

const VWAP_ENTRY_LONG = [
  "가격 > VWAP (위치 component)",
  "EMA(9) > VWAP (또는 AT VWAP) — 단기 추세 동조",
  "Pullback v2 — 최근 5캔들 내 VWAP/EMA(9) 터치 + 후속 캔들 반등 confirmed",
  "HVN (High Volume Node) / POC 지지 — Volume Profile 신뢰",
  "LVN 위 (구조) — 가격이 thin zone 을 통과한 상태",
];

const VWAP_ENTRY_SHORT = [
  "가격 < VWAP (위치 component, LONG 대칭)",
  "EMA(9) < VWAP (또는 AT) — 단기 하락 추세",
  "Pullback v2 SHORT — VWAP/EMA(9) 반등 후 거부",
  "Volume Profile: 상단 HVN/POC 저항 + 하단 LVN 통과",
  "Multi-TF alignment — 1H/4H/1D 같은 방향 SHORT 정합",
];

const VWAP_WEIGHTS: WeightRow[] = [
  { name: "VWAP 거리", value: 0.25, highlight: true },
  { name: "EMA(9) 위치", value: 0.2 },
  { name: "EMA 되돌림 (Pullback v2)", value: 0.25, highlight: true },
  { name: "Volume Profile 지지 (HVN/POC)", value: 0.15 },
  { name: "Volume Profile 구조 (LVN 위)", value: 0.15 },
];

const VWAP_THRESHOLDS = {
  "최소 진입 신뢰도": 40,
  "최종 신뢰도": 50,
  "Pullback proximity": "0.5% 이내",
  "Multi-TF 정합": "1H/4H/1D 같은 방향",
  "VWAP multiplier 범위": "0.7 ~ 1.3",
  "Alignment ×": "aligned ×1.15 / partial ×1.05 / mixed ×0.95",
};

const VWAP_SAFETY: string[] = [
  "VWAP 반대 방향 cross 시 즉시 청산 (whipsaw 방지)",
  "Lookahead-free — VWAP/EMA 계산은 i 이전 데이터만 (anchored VWAP)",
  "Modifier-only — vwapMult (0.7~1.3) 로 BBDX 진입 신뢰도에만 합산 (헌장 3)",
  "Volume Profile bin 데이터 부족 (< 20 candles) 시 시그널 보류",
  "Multi-TF 정합 mixed → multiplier ×0.95 (감점)",
];

const VWAP_EXIT: string[] = [
  "VWAP 반대 방향 cross — 즉시 청산",
  "STOP — Bollinger Bands 반대 끝 (LONG: BB.lower / SHORT: BB.upper)",
  "Time stop — variable bars (TF 별 다름, 명세서 §9.3)",
  "Take profit — +1σ / +2σ / +3σ 밴드 도달 시 단계별 분할 청산",
];

const VWAP_CHARTER: CharterRow[] = [
  {
    rule: 1,
    status: "pass",
    label: "다차원 — 거래량 (4번) + 시장구조 (5번) — rule1Exempt (각도 다름)",
  },
  {
    rule: 2,
    status: "pass",
    label: "Lookahead-free — anchored VWAP / EMA 모두 i 이전 캔들만",
  },
  {
    rule: 3,
    status: "pass",
    label: "Modifier-only — vwapMult (0.7~1.3) BBDX multiplier 로만 통합",
  },
  {
    rule: "V",
    status: "warn",
    label: "임시값 (D-005 calibration 대기) — 가중치 0.25 + 0.20 + 0.25 + 0.15 + 0.15",
  },
];

function VwapCriteria({ symbol }: { symbol: string }) {
  const baseSymbol = symbol.replace(/USDT$/, "");
  return (
    <CriteriaTabStandard
      entry_rules={{ long: VWAP_ENTRY_LONG, short: VWAP_ENTRY_SHORT }}
      weights={VWAP_WEIGHTS}
      weights_source_note={
        "VWAP 5-component (명세서 §9.1). VWAP 거리 0.25 + EMA(9) 위치 0.20 + Pullback v2 0.25 + " +
        `VP 지지 0.15 + VP 구조 0.15. D-005 calibration 대기 (현재 코인: ${baseSymbol}).`
      }
      thresholds={VWAP_THRESHOLDS}
      safety_mechanisms={VWAP_SAFETY}
      exit_rules={VWAP_EXIT}
      charter_compliance={VWAP_CHARTER}
    />
  );
}

// ---------------------------------------------------------------------------
// CoinCriteriaTab — 트래커 분기
// ---------------------------------------------------------------------------

export function CoinCriteriaTab({ symbol, tracker = "bbdx" }: CoinCriteriaTabProps) {
  switch (tracker) {
    case "fibonacci":
      return <FibonacciCriteria symbol={symbol} />;
    case "vwap":
      return <VwapCriteria symbol={symbol} />;
    case "bbdx":
    case "jeon-in-gu":
    default:
      return <BbdxCriteria symbol={symbol} />;
  }
}
