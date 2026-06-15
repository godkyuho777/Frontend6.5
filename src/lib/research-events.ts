/**
 * 리서치 이벤트 캘린더 — 섹터별 알트코인 이벤트 (2026-06-15 리서치).
 *
 * 차트(research-charts.ts)와 같은 *프론트 전용 데이터 레이어* — 백엔드 타입
 * 변경 0. ResearchArticle 이 article.sector 로 조회해 "주요 이벤트" 섹션을
 * 렌더한다(섹터 리포트의 'catalysts to watch' 역할).
 *
 * 데이터: 2026-06 병렬 리서치(L1/L2 에이전트) + 1차 세션 섹터 브리프 종합.
 * 상태 플래그:
 *   - confirmed = 날짜·이벤트 1차 확인
 *   - target    = 팀의 목표/aspirational (슬립 이력 있음)
 *   - unconfirmed = 제안/루머/날짜 미정
 * 변동성 큰 수치(언락 $규모 등)는 발행 시점 보도값 — 라이브는 출처 확인.
 *
 * 헌장: 이벤트는 디스커버리/교육용. 단독 매매 시그널 아님.
 */

import type { ResearchSectorId } from "./research-types";

export type ResearchEventStatus = "confirmed" | "target" | "unconfirmed";

export interface ResearchEvent {
  /** 티커 (예: "ETH") 또는 "크로스" */
  coin: string;
  /** 이벤트 유형 한국어 라벨 */
  type: string;
  title: string;
  /** 표시용 날짜/기간 (예: "2026-06-16", "2026 Q3 목표") */
  date: string;
  /** 한 줄 임팩트 */
  impact: string;
  status: ResearchEventStatus;
  /** 1차 출처 URL */
  source?: string;
}

const L1_EVENTS: ResearchEvent[] = [
  {
    coin: "ARB",
    type: "토큰 언락",
    title: "분기 클리프 언락 — 92.65M ARB (~0.93% 공급)",
    date: "2026-06-16",
    impact: "인-윈도 주요 언락 — 약한 L2 수수료 매출 논쟁과 맞물림",
    status: "confirmed",
    source: "https://cryptodaily.co.uk/2026/06/arbitrum-june-16-unlock-revenue-proof",
  },
  {
    coin: "NEAR",
    type: "네트워크 업그레이드",
    title: "동적 리샤딩 v2.13 + 포스트양자 서명",
    date: "2026-06 목표",
    impact: "거버넌스 투표 없는 자동 스케일링 + PQ 안전 서명",
    status: "target",
    source: "https://www.coindesk.com/markets/2026/05/22/near-protocol-to-automate-its-own-growth-and-its-token-is-skyrocketing",
  },
  {
    coin: "ADA",
    type: "하드포크",
    title: "Van Rossem 하드포크 (프로토콜 v11)",
    date: "2026-06 말 목표",
    impact: "2026 첫 프로토콜 업그레이드 — Plutus 성능·노드 보안",
    status: "target",
    source: "https://www.kucoin.com/news/flash/cardano-to-launch-two-major-upgrades-in-2026-ouroboros-leios-and-van-rossem-hard-fork",
  },
  {
    coin: "ADA",
    type: "네트워크 업그레이드",
    title: "Ouroboros Leios 테스트넷 (10~65x 처리량 목표)",
    date: "2026-06 테스트넷",
    impact: "주요 스케일링 경로 — 메인넷은 아직 수개월 뒤",
    status: "target",
    source: "https://leios.cardano-scaling.org/docs/roadmap/",
  },
  {
    coin: "ETH",
    type: "네트워크 업그레이드",
    title: "Glamsterdam 하드포크 (ePBS·BAL·가스 리프라이싱)",
    date: "2026 Q3 목표",
    impact: "첫 enshrined 프로포저-빌더 분리(PBS) — MEV 개혁",
    status: "target",
    source: "https://ethereum.org/roadmap/glamsterdam/",
  },
  {
    coin: "SOL",
    type: "네트워크 업그레이드",
    title: "Alpenglow 컨센서스 (Votor+Rotor, ~100x finality)",
    date: "2026 Q3 목표",
    impact: "사상 최대 SOL 컨센서스 변경 — 서브초 finality",
    status: "target",
    source: "https://www.alchemy.com/blog/solana-alpenglow",
  },
  {
    coin: "SOL",
    type: "발행 변경",
    title: "SIMD-0411 — 인플레 추가 감축(15%→30%)",
    date: "2026 중반 (투표)",
    impact: "발행 일정 ~반감 → 공급측 tailwind (날짜 미확정)",
    status: "unconfirmed",
    source: "https://blockchain.news/news/solana-sol-proposes-new-inflation-reduction-plan-simd-0411",
  },
  {
    coin: "SUI",
    type: "토큰 언락",
    title: "Aug 1 트랜치 ≈ $167.6M (8월 단일 최대)",
    date: "2026-08-01",
    impact: "공급 오버행 — $규모는 가격연동, 발행 시점 확인 권장",
    status: "confirmed",
    source: "https://tokenomist.ai/sui",
  },
  {
    coin: "APT",
    type: "토큰 언락",
    title: "월간 베스팅 언락 ≈ $51.5M",
    date: "2026-08-10~15",
    impact: "8월 최대급 정기 공급",
    status: "confirmed",
    source: "https://tokenomist.ai/aptos/unlock-events",
  },
  {
    coin: "AVAX",
    type: "토큰 언락",
    title: "Foundation 분기 언락 ≈ $40M",
    date: "2026-08-10",
    impact: "정기 공급 — 완만한 매도 압력",
    status: "confirmed",
    source: "https://tokenomist.ai/avalanche-2",
  },
  {
    coin: "ATOM",
    type: "거버넌스",
    title: "토크노믹스 개편 — 인플레→수수료 모델 전환 RFP",
    date: "2026 (투표 미정)",
    impact: "효과 인플레 최대 ~60% 감축 가능 — 최대 관전 포인트",
    status: "unconfirmed",
    source: "https://www.bitget.com/news/detail/12560605084318",
  },
  {
    coin: "TON",
    type: "네트워크 업그레이드",
    title: "MTONGA 로드맵 (Pay 2.0·Teleport BTC) + 'Gram' 리브랜드",
    date: "2026 Q2~중반",
    impact: "텔레그램 주도 성능 + BTC 유동성 브리지",
    status: "target",
    source: "https://crypto.news/telegram-takes-back-ton-inside-the-2026-takeover/",
  },
  {
    coin: "LINK",
    type: "프로토콜",
    title: "Staking v0.3 (75M LINK 풀) + CCIP 실수수료 보상",
    date: "2026 진행",
    impact: "실수수료 기반 스테이킹 수익 — CCIP Q1 $18B+ 볼륨",
    status: "confirmed",
    source: "https://chain.link/economics/staking",
  },
];

const L2_EVENTS: ResearchEvent[] = [
  L1_EVENTS[0], // ARB 언락 (L2 에도 노출)
  {
    coin: "OP",
    type: "네트워크 업그레이드",
    title: "Superchain 네이티브 interop (ERC-7802, 원자적 크로스체인)",
    date: "2026 후반 목표",
    impact: "OP 스택 체인 간 단일 트랜잭션 조합성",
    status: "target",
    source: "https://finance.yahoo.com/news/everything-know-optimism-superchain-upgrade-104024963.html",
  },
  {
    coin: "POL",
    type: "네트워크 업그레이드",
    title: "Gigagas 로드맵 (100k TPS) + AggLayer 성숙",
    date: "2026",
    impact: "처리량·집계 레이어 — 인-윈도 하드포크는 4~5월 완료",
    status: "target",
    source: "https://polygon.technology/blog/polygons-gigagas-roadmap-to-100k-tps-move-your-money-faster-across-the-globe",
  },
];

const DEFI_EVENTS: ResearchEvent[] = [
  {
    coin: "UNI",
    type: "거버넌스",
    title: "수수료 스위치 8개 체인 확장 + 티어 기반 'default-on' 투표",
    date: "2026-06",
    impact: "UNI 바이백·소각 확대 — 실매출의 토큰 귀속",
    status: "target",
    source: "https://blog.uniswap.org/unification",
  },
  {
    coin: "CRV",
    type: "프로토콜 출시",
    title: "Llamalend v2 (LP 토큰 담보·격리 시장)",
    date: "2026-06-10",
    impact: "비-crvUSD admin fee → veCRV 매출 연동",
    status: "confirmed",
    source: "https://www.banklesstimes.com/articles/2026/06/11/curve-dao-token-jumps-22-tests-0-28-after-llamalend-v2-launch/",
  },
  {
    coin: "PENDLE",
    type: "마일스톤",
    title: "Fortune Crypto Innovators 선정 + Boros 확장",
    date: "2026-06-11",
    impact: "온체인 고정수익 내러티브 제도권 검증",
    status: "confirmed",
    source: "https://cryptobriefing.com/pendle-fortune-crypto-innovators-list/",
  },
  {
    coin: "ENA",
    type: "거버넌스",
    title: "Ethena 수수료 스위치 → sENA + ENA 바이백",
    date: "2026 진행",
    impact: "프로토콜 매출의 토큰 귀속 — USDe 펀딩 의존 리스크",
    status: "confirmed",
    source: "https://coinmarketcap.com/cmc-ai/ethena/latest-updates/",
  },
];

const AI_EVENTS: ResearchEvent[] = [
  {
    coin: "FET",
    type: "토큰 언락",
    title: "ASI Alliance 클리프 언락",
    date: "2026-06-28",
    impact: "FET 공급 역풍 — 변동성 확대 가능",
    status: "confirmed",
    source: "https://tokenomist.ai/fetch-ai",
  },
  {
    coin: "WLD",
    type: "발행 변경",
    title: "Worldcoin 발행 ~43% 감소 (5.1M→2.9M/일)",
    date: "2026-07-24",
    impact: "유통 공급 조임 — WLD 공급측 tailwind",
    status: "confirmed",
    source: "https://coinmarketcap.com/cmc-ai/worldcoin-org/latest-updates/",
  },
  {
    coin: "TAO",
    type: "ETF / 규제",
    title: "SEC 현물 TAO ETF 결정 (Grayscale GTAO·Bitwise)",
    date: "2026-08경",
    impact: "섹터 대장주 기관 접근 — 승인=호재, 거부=센티 타격",
    status: "target",
    source: "https://coinmarketcap.com/academy/article/grayscale-files-first-us-bittensor-tao-etp",
  },
  {
    coin: "NEAR",
    type: "네트워크 업그레이드",
    title: "동적 리샤딩 + PQ 서명 (AI 에이전트 인프라)",
    date: "2026-06 목표",
    impact: "'에이전트의 통화' 내러티브 뒷받침",
    status: "target",
    source: "https://decrypt.co/368737/near-protocol-jumps-28-on-privacy-ai-and-scaling-upgrades",
  },
];

const RWA_EVENTS: ResearchEvent[] = [
  {
    coin: "ONDO",
    type: "제품 출시",
    title: "Ondo Perps (토큰화 주식 20x) + Global Markets $1B TVL",
    date: "2026-06-09",
    impact: "수동 토큰화 → 능동 거래 레일 전환",
    status: "confirmed",
    source: "https://www.banklesstimes.com/articles/2026/06/04/ondo-finance-price-prediction-ahead-of-june-9-perps-launch/",
  },
  {
    coin: "ONDO",
    type: "인프라",
    title: "OUSG XRPL 24/7 + JPM·Mastercard·Ripple 국경간 정산",
    date: "2026-06-11",
    impact: "RWA = 합성·정산 가능한 레일임을 입증",
    status: "confirmed",
    source: "https://www.panewslab.com/en/articles/019e2b05-60b1-764a-b6e3-8be94dd2667c",
  },
  {
    coin: "BUIDL",
    type: "상품",
    title: "BlackRock 토큰화 MMF 2종 SEC 신청 (Securitize)",
    date: "2026-05 신청",
    impact: "미승인 — 승인·출시 일정 미정 (관전 포인트)",
    status: "unconfirmed",
    source: "https://www.coindesk.com/business/2026/05/09/blackrock-deepens-tokenization-push-with-new-onchain-fund-offerings",
  },
  {
    coin: "크로스",
    type: "규제",
    title: "CLARITY Act 상원 본회의 (2026 통과 ~59% 가격화)",
    date: "2026 (미정)",
    impact: "토큰화 증권 법적 지위 — 통과 시 step-change",
    status: "unconfirmed",
    source: "https://www.coindesk.com/policy/2026/05/14/live-senate-banking-committee-holds-key-hearing-to-advance-clarity-act",
  },
];

const BTC_EVENTS: ResearchEvent[] = [
  {
    coin: "BTC",
    type: "ETF / 자금흐름",
    title: "BTC 현물 ETF — 6월 초 사상 최대급 주간 순유출(~$3.4B)",
    date: "2026-06",
    impact: "금리 역풍 — 4주 누적 ~-$5.4B",
    status: "confirmed",
    source: "https://www.investing.com/analysis/bitcoins-34-billion-etf-bleed-looks-more-cyclical-than-structural-200681474",
  },
  {
    coin: "크로스",
    type: "ETF / 규제",
    title: "T. Rowe Active Crypto ETF 승인 (SOL·ADA·AVAX·DOT 포함)",
    date: "2026-06-12",
    impact: "알트 ETF 노출 확대 — 현물 알트 ETF 물결의 신호",
    status: "confirmed",
    source: "https://www.webopedia.com/crypto/learn/pending-crypto-etf-2026/",
  },
  {
    coin: "크로스",
    type: "규제",
    title: "SEC/CFTC — 스테이킹 보상 '비증권' 분류",
    date: "2026-03-17",
    impact: "현물 알트(SOL·ADA·LINK·AVAX·DOT…) ETF 장벽 제거",
    status: "confirmed",
    source: "https://www.webopedia.com/crypto/learn/pending-crypto-etf-2026/",
  },
  {
    coin: "BTC",
    type: "매크로",
    title: "FOMC — 케빈 워시 신임 의장 첫 회의",
    date: "2026-06-17",
    impact: "금리 동결 유력 — 점도표·톤이 위험자산 변수",
    status: "confirmed",
    source: "https://blog.kraken.com/economic-brief/june-10-2026",
  },
];

// ── 섹터 → 이벤트 ───────────────────────────────────────────────────
// ResearchSectorId 전체를 커버(미사용 섹터는 빈 배열)해 타입 완전성 보장.
export const RESEARCH_EVENTS: Record<ResearchSectorId, ResearchEvent[]> = {
  "layer-1": L1_EVENTS,
  "layer-2": L2_EVENTS,
  defi: DEFI_EVENTS,
  ai: AI_EVENTS,
  rwa: RWA_EVENTS,
  btc: BTC_EVENTS,
  depin: AI_EVENTS, // DePIN 은 AI/컴퓨팅과 이벤트 공유
  meme: [],
  gaming: [],
  "solana-eco": [],
  "cosmos-eco": [],
  "perp-dex": [],
  "oracle-data": [],
  "zk-privacy": [],
  other: [],
};

export function eventsForSector(sector: ResearchSectorId): ResearchEvent[] {
  return RESEARCH_EVENTS[sector] ?? [];
}
