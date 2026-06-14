/**
 * Risk band → 한글 라벨 + cyberpunk neon 색상 클래스의 단일 소스.
 *
 * 모든 리스크 UI (RiskBadge, RiskGauge, 시장 리스크 게이지 등) 가 이 헬퍼를
 * 통해 색상/라벨을 가져온다. band → 색상 매핑을 한 곳에서만 관리하기 위함.
 *
 * 매핑 (LOCKED CONTRACT):
 *   low      0–24   안정   neon-green
 *   moderate 25–49  주의   neon-yellow
 *   high     50–74  경계   orange-400  (전용 orange neon 토큰이 없어 Tailwind fallback)
 *   extreme  75–100 위험   neon-red
 */

export type RiskBand = "low" | "moderate" | "high" | "extreme";

export interface RiskBandMeta {
  /** 한글 라벨 — 안정 / 주의 / 경계 / 위험 */
  label: string;
  /** 텍스트 색상 클래스 */
  textClass: string;
  /** 배경 색상 클래스 (badge / chip 용) */
  bgClass: string;
  /** 테두리 색상 클래스 */
  borderClass: string;
  /** 막대(bar)/원형 게이지 채움용 background 색상 클래스 */
  fillClass: string;
}

const META: Record<RiskBand, RiskBandMeta> = {
  low: {
    label: "안정",
    textClass: "text-neon-green",
    bgClass: "bg-neon-green/15",
    borderClass: "border-neon-green/40",
    fillClass: "bg-neon-green",
  },
  moderate: {
    label: "주의",
    textClass: "text-neon-yellow",
    bgClass: "bg-neon-yellow/15",
    borderClass: "border-neon-yellow/40",
    fillClass: "bg-neon-yellow",
  },
  high: {
    label: "경계",
    textClass: "text-orange-400",
    bgClass: "bg-orange-400/20",
    borderClass: "border-orange-400/40",
    fillClass: "bg-orange-400",
  },
  extreme: {
    label: "위험",
    textClass: "text-neon-red",
    bgClass: "bg-neon-red/15",
    borderClass: "border-neon-red/40",
    fillClass: "bg-neon-red",
  },
};

/** 알 수 없는 band 일 때의 중립 fallback (데이터 미수신 등) */
const NEUTRAL: RiskBandMeta = {
  label: "—",
  textClass: "text-muted-foreground",
  bgClass: "bg-muted/30",
  borderClass: "border-border/40",
  fillClass: "bg-muted-foreground",
};

/** band → 라벨 + 색상 클래스. band 미정 시 중립 fallback 반환. */
export function riskBandMeta(band?: RiskBand | null): RiskBandMeta {
  if (!band) return NEUTRAL;
  return META[band] ?? NEUTRAL;
}

/**
 * 점수(0-100) → band 파생. 백엔드가 band 를 주지만, score 만 있고 band 가
 * 없는 경우(예: 스캐너 row 의 riskBand 누락)를 위한 보조 헬퍼.
 */
export function bandFromScore(score: number): RiskBand {
  if (score >= 75) return "extreme";
  if (score >= 50) return "high";
  if (score >= 25) return "moderate";
  return "low";
}
