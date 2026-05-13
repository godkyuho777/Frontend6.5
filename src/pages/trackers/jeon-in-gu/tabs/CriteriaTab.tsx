/**
 * 전인구 시그널 — 매매기준 탭.
 *
 * 명세: JEON_IN_GU_SIGNAL_TRACKER §3.6 [6.2] + TRACKER_TAB_STANDARD §3.1.
 * Phase 1.3+ backend 미완 상태에서도 매매기준은 명세서 기반으로 fully visible.
 */

import {
  CriteriaTab as CriteriaTabStandard,
  type CharterRow,
  type WeightRow,
} from "@/components/trackers/tabs";
import { PhasePendingCard } from "../components/PhasePendingCard";

const ENTRY_LONG = [
  "전인구 sentiment_score ≤ -0.3 (부정적 의견 — 역지표)",
  "sentiment_confidence ≥ 0.7 (LLM 분류 신뢰도)",
  "콘텐츠 발행 후 36시간 이내 (decay window)",
  "BBDX 최종 신뢰도 ≥ 50점 (단독 발행 X — 헌장 3)",
];

const ENTRY_SHORT = [
  "전인구 sentiment_score ≥ +0.3 (긍정적 의견 — 역지표)",
  "sentiment_confidence ≥ 0.7 (LLM 분류 신뢰도)",
  "콘텐츠 발행 후 36시간 이내 (decay window)",
  "BBDX 최종 신뢰도 ≥ 50점 (단독 발행 X — 헌장 3)",
];

const WEIGHTS: WeightRow[] = [
  {
    name: "전인구 (Contrarian)",
    value: 0.5,
    highlight: true,
    warning: "매우 높음",
  },
  { name: "BBDX 기본 (RSI+BB+ADX)", value: 0.3 },
  { name: "Wave (Trend / Sentiment)", value: 0.1 },
  { name: "Macro (FRED)", value: 0.1 },
  { name: "Onchain (7차원)", value: 0.1 },
];

const WEIGHTS_NOTE =
  "출처: 직관값 (Phase 5 calibration 미완). 매주 일요일 23:00 KST 자동 calibration 예정. " +
  "R² < 0.10 시 가중치 자동 감소 (0.50 → 0.40 → 0.30 → 0.20).";

const THRESHOLDS = {
  min_confidence: "0.70 (LLM 신뢰도)",
  decay_hours: "36 (시간 감쇠 윈도)",
  final_threshold: "50점 (BBDX 최종 신뢰도)",
  modifier_range: "[-0.50, +0.50]",
  calibration_interval: "7일 (매주 일요일 23:00 KST)",
  fallback_weight: "0.20 (alpha 미검증 시)",
};

const SAFETY: string[] = [
  "sentiment_confidence < 0.7 → modifier=0 자동 무시",
  "콘텐츠 36h 초과 → decay=0 자동 무시",
  "콘텐츠 0건 → modifier=0 (단독 발행 X)",
  "BBDX final_score < 50 → 진입 차단 (헌장 3 — modifier-only)",
  "alpha 미검증 (R² < 0.10) 시 가중치 자동 0.20 하향",
  "modifier_value clamp [-0.50, +0.50] 강제",
];

const EXIT: string[] = [
  "BBDX 표준 EXIT (TP1/TP2/STOP) 우선",
  "전인구 반대 방향 콘텐츠 신규 발행 + sentiment_score 강도 ≥ 0.5 → 즉시 청산 검토",
  "decay=0 도달 시 보유 포지션 modifier 영향 자연 소멸",
];

const CHARTER: CharterRow[] = [
  { rule: 1, status: "pass", label: "다차원 합의 (BBDX 7차원 + 전인구 6차원 거시 합의 시 발행)" },
  { rule: 2, status: "pass", label: "Lookahead-free (콘텐츠 publishedAt ≤ candle.ts 강제)" },
  {
    rule: 3,
    status: "pass",
    label: "Modifier-only (BBDX 단독 진입 발행, 전인구는 weight 만)",
  },
  {
    rule: "V",
    status: "warn",
    label: "검증 (Phase 5 calibration 누적 데이터 ≥ 90일 도달 후 통과 결정)",
  },
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
      footer={
        <PhasePendingCard
          phase="Phase 5 pending"
          title="가중치 calibration 자동화 미완"
          unlocksWhen="Phase 5 백테스트 + calibration cron 활성 후 매주 자동 검증"
        >
          <p className="font-mono text-xs text-foreground/80 leading-relaxed">
            현재 가중치 ±0.50 는 직관값. Phase 5 활성 전까지는{" "}
            <span className="text-neon-pink font-bold">±0.20 fallback</span> 로
            BBDX 합산에 진입. alpha 검증 통과 시에만 ±0.50 으로 승격.
          </p>
        </PhasePendingCard>
      }
    />
  );
}
