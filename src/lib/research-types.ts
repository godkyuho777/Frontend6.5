/**
 * 리서치 퍼블리싱 허브 — presentation 메타 + 백엔드 추론 타입 (2026-06-14).
 *
 * 데이터(기사 목록/본문)는 백엔드 tRPC (`trpc.research.list/detail/related`)
 * 가 단일 소스다. 이 모듈은 *프론트 전용 presentation 메타* 만 보유한다:
 *   · RESEARCH_SECTORS / researchSectorMeta — 섹터 배지 색맵(의미색, 백엔드로 안 감)
 *   · RESEARCH_TYPE_LABEL                   — 타입 → 한국어 라벨
 *   · formatResearchDate                    — ISO → 한국어 날짜
 *
 * 응답 모델 타입(`ResearchSummary` / `ResearchDetail`)은 백엔드 router 에서
 * 추론한다(drift 방지). 컴포넌트는 이 추론 타입에만 의존하므로 백엔드 shape 이
 * 바뀌면 타입 체크가 즉시 잡는다.
 *
 * 헌장: 리서치는 *디스커버리/교육* 콘텐츠. BBDX 시그널 시스템과 무관하며
 * 단독 매매 시그널을 발행하지 않는다.
 */

import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@tradelab/backend/router";
import type { SectorId } from "./sector-taxonomy";

// ── 백엔드 추론 응답 타입 (drift 방지 — mock interface 대체) ─────────
type ResearchOutputs = inferRouterOutputs<AppRouter>["research"];

/** 목록/관련 기사 카드 — bodyHtml 제외 요약 (`research.list` / `research.related`) */
export type ResearchSummary = ResearchOutputs["list"][number];
/** 단일 기사 상세 — bodyHtml 포함 (`research.detail`, null 제거) */
export type ResearchDetail = NonNullable<ResearchOutputs["detail"]>;

/** 리서치 타입 — 백엔드 union 에서 파생 */
export type ResearchType = ResearchSummary["type"];

export const RESEARCH_TYPE_LABEL: Record<ResearchType, string> = {
  weekly: "주간 시황",
  deepdive: "섹터 딥다이브",
  flash: "플래시 노트",
};

/**
 * 리서치 섹터 키 — `sector-taxonomy` 의 `SectorId` 를 재사용하되, 리서치
 * 분류상 필요한 항목(BTC · DePIN) 을 확장한다. taxonomy 자체는 디스커버리
 * 집계(코인 멤버십)용이라 수정하지 않고, 리서치 표시용 색/이름은 아래
 * `RESEARCH_SECTORS` 가 단일 소스로 보유한다.
 *
 * 주의: 백엔드 `ResearchSectorId` 와 멤버 집합이 동일해야 한다(백엔드
 * shared/research-types.ts 가 같은 union 을 self-contained 로 보유).
 */
export type ResearchSectorId = SectorId | "btc" | "depin";

export interface ResearchSectorMeta {
  id: ResearchSectorId;
  /** 배지/칩에 노출되는 짧은 이름 (지표·티커 영어 유지) */
  label: string;
  /** 단색 tint 배경 (네온/글로우 금지 — 옅은 면) */
  bg: string;
  /** 같은 계열 진한 글자색 */
  text: string;
}

/**
 * 리서치 섹터 색 맵 — 단색 tint + 같은 계열 진한 글자.
 * 디자인 토큰 시스템과 톤을 맞춘 옅은 면 색이며, raw hex 는 *배지 tint 한정*
 * 으로만 사용한다(섹터 식별을 위한 의미색). 카드/보더/텍스트 등 구조 색은
 * 전역 토큰(bg-card · border · text-muted-foreground) 을 사용한다.
 */
export const RESEARCH_SECTORS: Record<ResearchSectorId, ResearchSectorMeta> = {
  rwa: { id: "rwa", label: "RWA", bg: "#E6F1FB", text: "#0C447C" },
  defi: { id: "defi", label: "DeFi", bg: "#EAF3DE", text: "#27500A" },
  depin: { id: "depin", label: "DePIN", bg: "#EEEDFE", text: "#3C3489" },
  "layer-2": { id: "layer-2", label: "Layer 2", bg: "#E1F5EE", text: "#085041" },
  btc: { id: "btc", label: "BTC", bg: "#FAEEDA", text: "#633806" },
  ai: { id: "ai", label: "AI", bg: "#FAECE7", text: "#712B13" },
  "layer-1": { id: "layer-1", label: "Layer 1", bg: "#E8EEF6", text: "#27406B" },
  meme: { id: "meme", label: "Meme", bg: "#FCEAF1", text: "#7A1D45" },
  // taxonomy 의 나머지 SectorId — 리서치에서 미사용이지만 타입 완전성을 위해 매핑
  gaming: { id: "gaming", label: "Gaming", bg: "#FBEFE2", text: "#6B3A0E" },
  "solana-eco": { id: "solana-eco", label: "Solana", bg: "#EFEAFB", text: "#3F2B7A" },
  "cosmos-eco": { id: "cosmos-eco", label: "Cosmos", bg: "#E9ECFB", text: "#2A3380" },
  "perp-dex": { id: "perp-dex", label: "Perp DEX", bg: "#FBEAEE", text: "#7A1D33" },
  "oracle-data": { id: "oracle-data", label: "Oracle", bg: "#E2F4F2", text: "#0C4A45" },
  "zk-privacy": { id: "zk-privacy", label: "ZK", bg: "#E5F4EC", text: "#0E4D31" },
  other: { id: "other", label: "기타", bg: "#ECECEC", text: "#555555" },
};

export function researchSectorMeta(id: ResearchSectorId): ResearchSectorMeta {
  return RESEARCH_SECTORS[id] ?? RESEARCH_SECTORS["layer-1"];
}

/** "2026년 6월 13일" 형식 한국어 날짜 */
export function formatResearchDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}
