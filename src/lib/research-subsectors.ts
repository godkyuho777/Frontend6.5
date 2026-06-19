/**
 * 리서치 서브섹터 분해 — 섹터 → 하위 서브섹터 (2026-06-15, 이터레이션 1+보강).
 *
 * charts·events 와 같은 *프론트 전용 데이터 레이어*(백엔드 타입 변경 0).
 * ResearchArticle 이 article.sector 로 조회해 "서브섹터 분해" 섹션을 렌더한다.
 * Messari 식 다층 분류(섹터→서브섹터) 적용 — 섹터 분석을 한 단계 더 정교하게.
 *
 * 데이터: 2026-06 병렬 서브섹터 리서치 2건(AI/DeFi · RWA/L1/L2) + 세션 브리프.
 * 정책:
 *   - strength = 발행 시점 상대강도(주도/중립/후행) 정성 판단. 라이브는 /sectors.
 *   - 토큰 *가격*과 서브섹터 *테마 강도*는 다를 수 있음(예: L2 — 사용량↑·토큰↓).
 *   - 수치는 출처별 편차 큼 → 본문은 범위/방향성으로, 하드코딩 지양.
 *   - ⚠️ 미검증·날조 정보 배제(예: "Anthropic Fable5/Mythos5 셧다운"은 날조 SEO).
 * 헌장: 디스커버리/교육용, 단독 시그널 아님.
 */

import type { ResearchSectorId } from "./research-types";

export type SubSectorStrength = "leading" | "neutral" | "lagging";

export interface SubSector {
  /** 서브섹터명 */
  name: string;
  /** 1줄 정의 */
  what: string;
  /** 대표 토큰 티커 */
  tokens: string[];
  /** 발행 시점 상대강도 */
  strength: SubSectorStrength;
  /** 현재 상태/이유 (1~2문장, as-of) */
  note: string;
  /** 1차 출처 URL */
  source?: string;
}

const AI_SUBSECTORS: SubSector[] = [
  {
    name: "데이터·추론 네트워크",
    what: "분산 학습·추론·모델 마켓 (서브넷 경제)",
    tokens: ["TAO", "FET"],
    strength: "leading",
    note: "AI 섹터 최강 — TAO 가 대장(120+ 서브넷, Q1 ~$43M 매출로 가장 신뢰도 높은 '실사용' 스토리), ~8월 현물 ETF 결정 대기. FET 는 같은 내러티브지만 훨씬 약함.",
    source: "https://coinmarketcap.com/cmc-ai/bittensor/latest-updates/",
  },
  {
    name: "신원·프라이버시 AI",
    what: "인간 증명(PoP)·신원 — AI 에이전트 시대 인프라",
    tokens: ["WLD"],
    strength: "leading",
    note: "6월 최고 모멘텀 — WLD 월 +70%대(7/24 발행 ~43% 감소 예정). 단 펀더멘털보다 내러티브·기관 트레저리 수요 주도. (※ '$2.87B AI 유입/모델 셧다운' 류 인용은 날조 SEO — 배제.)",
    source: "https://www.banklesstimes.com/articles/2026/06/16/worldcoin-price-prediction-top-3-reasons-wld-token-is-soaring/",
  },
  {
    name: "분산 컴퓨팅 (GPU·DePIN)",
    what: "탈중앙 GPU·컴퓨팅 마켓",
    tokens: ["RENDER", "AKT", "IO"],
    strength: "neutral",
    note: "분화됨 — RENDER 는 기관 선호 'AI 컴퓨팅' 프록시. 그러나 Akash 는 펀더멘털 경고(리스 +27%인데 매출 -45%·GPU 가동률 ~34%) — 가격이 유료 수요를 앞섬. io.net 은 6/11 바이백·소각 시작.",
    source: "https://coinmarketcap.com/cmc-ai/akash-network/latest-updates/",
  },
  {
    name: "AI 에이전트",
    what: "온체인 AI 에이전트·런치패드",
    tokens: ["VIRTUAL", "AIXBT"],
    strength: "lagging",
    note: "2025 버블에서 가장 크게 디플레이트된 AI 하위. VIRTUAL 은 안정화됐으나 고점 대비 부진, AIXBT ~-97%. 생존자는 에이전트 결제 레일(ACP)로 피벗 중.",
    source: "https://www.coingecko.com/en/coins/virtual-protocol",
  },
];

const DEFI_SUBSECTORS: SubSector[] = [
  {
    name: "파생·Perps DEX",
    what: "탈중앙 영구선물 거래소",
    tokens: ["HYPE", "GMX", "DYDX"],
    strength: "leading",
    note: "현재 DeFi 최강 하위지만 극단적 집중 — Hyperliquid 가 perp-DEX 거래량의 ~32~44%, 카테고리 주간 >$40B. 단 4월 Drift 해킹(~$285M)이 꼬리위험을 상기.",
    source: "https://coinmarketcap.com/currencies/hyperliquid/",
  },
  {
    name: "대출·머니마켓",
    what: "초과담보 대출·예치",
    tokens: ["AAVE", "MORPHO", "COMP"],
    strength: "leading",
    note: "사상 최대 TVL(~$54~55B). Aave 지배(~$14.6B+, 활성 대출 ~48%), Morpho 가 돌파 도전자(~$2B 밸류 라운드, 모듈러). Compound 는 퇴색.",
    source: "https://www.theblock.co/post/358368/defi-lending-hits-record-55-billion-tvl-as-aave-maple-and-morpho-lead-the-charge",
  },
  {
    name: "현물 DEX",
    what: "AMM 현물 거래소",
    tokens: ["UNI", "CRV"],
    strength: "leading",
    note: "Uniswap 거래량 압도적(#1) + 디플레이션 전환(UNIfication 통과·100M UNI 소각). 펀더멘털은 개선됐으나 토큰 가격은 횡보 — '실매출 → 토큰' 스토리의 시험대.",
    source: "https://blockworks.co/news/uniswap-fee-switch",
  },
  {
    name: "수익·고정수익",
    what: "수익률 토큰화(PT/YT)·온체인 고정수익",
    tokens: ["PENDLE"],
    strength: "neutral",
    note: "틈새 지배자 — Boros 로 펀딩률·금리 파생까지 확장(토큰화 수익 RWA 의 거래 장소). 사용 강하나 토큰은 소프트.",
    source: "https://metamask.io/price/pendle",
  },
  {
    name: "스테이블코인·합성달러",
    what: "크립토 네이티브·델타뉴트럴 합성달러",
    tokens: ["ENA", "SKY"],
    strength: "neutral",
    note: "제품 강·토큰 약 — USDe 공급 >$6B·누적매출 >$250M(상위 합성달러)이나 ENA 는 발행 오버행. **Ethena 수수료 스위치 전제조건 충족 → 거버넌스 투표** 가 핵심 가치포착 촉매.",
    source: "https://coinmarketcap.com/cmc-ai/ethena/latest-updates/",
  },
  {
    name: "유동 스테이킹·재스테이킹 (LST/LRT)",
    what: "스테이킹 유동화 + 재스테이킹",
    tokens: ["LDO", "EIGEN", "ETHFI"],
    strength: "neutral",
    note: "크고 안정적 — Lido ~$39B(대장)·EigenLayer ~$19.6B·ether.fi ~$6.8B(최대 LRT). LDO 월 +70%대로 신뢰 회복. 재스테이킹 수익은 완만(AVS ~+0.3~1.5%).",
    source: "https://coingape.com/top-liquid-staking-platforms/",
  },
  {
    name: "온체인 사모신용",
    what: "기관 대출·사모신용의 온체인화",
    tokens: ["SYRUP", "CFG"],
    strength: "neutral",
    note: "작지만 가장 빠르게 성장(~$5B 분산, 일부 집계 ~$18B). Maple(SYRUP) ~$2.1B, 8~12% 수익. ⚠️ '2025~2026 사모신용 위기' 거론 — 사실이면 오프체인 디폴트 전염에 가장 노출(범위 미검증, 관전).",
    source: "https://www.vaasblock.com/news/rwa-private-credit-onchain-maple-goldfinch-centrifuge-2026/",
  },
];

const RWA_SUBSECTORS: SubSector[] = [
  {
    name: "토큰화 주식·펀드",
    what: "1:1 백킹 온체인 주식·ETF (24/7 거래)",
    tokens: ["ONDO"],
    strength: "leading",
    note: "가장 빠른 성장(+422% YoY·30일 +39%, ~$1.68B). Kraken xStocks(Solana ~47%)·Ondo Global Markets(Ethereum ~37%, 231종목) 양강. xStocks 누적 거래 $25B 돌파.",
    source: "https://www.theblock.co/post/390537/tokenized-xstocks-surpass-25-billion-total-transaction-volume-kraken",
  },
  {
    name: "토큰화 국채·MMF",
    what: "미국 단기국채·MMF 토큰 래퍼",
    tokens: ["ONDO", "BUIDL", "BENJI"],
    strength: "leading",
    note: "최대·성숙(~$7~13B, 출처별 상이). BlackRock BUIDL 선두(~$2.9B·~40% 점유), BUIDL+Ondo+Franklin '트라이오폴리'. 온체인의 '기준금리'. 연준 완화로 수익률 압축이 최대 적.",
    source: "https://www.pistachio.fi/blog/tokenized-treasuries-2026-blackrock-buidl",
  },
  {
    name: "온체인 사모신용",
    what: "실물·기관 대출 풀의 온체인화",
    tokens: ["SYRUP", "CFG"],
    strength: "leading",
    note: "일부 집계상 국채를 추월한 최대 비-스테이블 RWA. Maple(SYRUP) ~$2.1B 로 최대 기관 대출. ⚠️ 사모신용 위기설은 범위 미검증이나 이 하위의 핵심 꼬리위험.",
    source: "https://bitcoinfoundation.org/news/defi/top-rwa-crypto-projects-2026-ondo-maple-centrifuge/",
  },
  {
    name: "원자재·금",
    what: "금 등 실물 1:1 백킹 토큰",
    tokens: ["PAXG", "XAUT"],
    strength: "neutral",
    note: "토큰화 금 ~$6B(세계 2위 금 투자상품 by volume). XAUT+PAXG 가 ~96%. 2026 금 랠리·risk-off 수요 수혜.",
    source: "https://bingx.com/en/news/post/tokenized-gold-market-cap-tops-billion-on-february-led-by-xaut-and-paxg",
  },
  {
    name: "RWA 인프라 체인",
    what: "RWA 발행·컴플라이언스 전용 체인",
    tokens: ["PLUME"],
    strength: "neutral",
    note: "Plume RWA TVL ~$6억대, Centrifuge V3·RWA 런치패드 첫 통합. ⚠️ 티커 혼동 — Plume 토큰은 PLUME(XPL 은 Plasma).",
    source: "https://messari.io/project/plume-network",
  },
];

const L1_SUBSECTORS: SubSector[] = [
  {
    name: "스마트컨트랙트 메인",
    what: "범용 스마트컨트랙트 정산 레이어",
    tokens: ["ETH", "SOL"],
    strength: "leading",
    note: "두 대장 — ETH(정산·TVL·기관, ETF 누적 ~$12B, 28.9% 스테이킹), SOL(처리량, Firedancer 1M TPS 공개 테스트 통과→H2 2026 메인넷, 현물 ETF $1B+). 둘 다 Q3 대형 업그레이드 대기.",
    source: "https://financefeeds.com/solana-price-eyes-250-in-2026-as-firedancer-hits-1m-tps-eth-holders-watching/",
  },
  {
    name: "고성능·병렬실행",
    what: "병렬 실행 고처리량 L1",
    tokens: ["SUI", "APT", "MON"],
    strength: "neutral",
    note: "경쟁적·혼조 — SUI 가 선두(~$3B, Mysticeti ~390ms). Monad 메인넷 라이브(2025-11), 6/9 업그레이드 +25% 속도. SUI(8/1 ~$167M)·APT(8월) 대형 언락이 공급 역풍.",
    source: "https://www.theblock.co/post/380094/monad-mainnet-launches",
  },
  {
    name: "비트코인 스테이킹",
    what: "BTC 네이티브 스테이킹 보안 레이어",
    tokens: ["BTC", "BABY"],
    strength: "neutral",
    note: "Babylon 이 최대 BTC 스테이킹(~56,000 BTC ≈ $5.6B TVL) — 래핑·브리지 없이 BTC 수익. 6/5 Upbit BABY/KRW 상장으로 거래량 +641%.",
    source: "https://coinmarketcap.com/cmc-ai/babylon/latest-updates/",
  },
  {
    name: "대체 L1 생태계",
    what: "주요 비-ETH/SOL L1",
    tokens: ["NEAR", "AVAX", "ADA", "TON", "ATOM"],
    strength: "lagging",
    note: "대체로 메이저 대비 부진·내러티브 주도. TON 이 이 그룹 최대 — **6/15 TON→GRAM 리브랜드**(텔레그램 'TON 재장악' 뉴스로 +36%). NEAR 리샤딩·ADA Van Rossem·ATOM 인플레 개편 등 개별 이벤트. ⚠️ TON→GRAM 티커 변경 주의.",
    source: "https://finance.yahoo.com/markets/crypto/articles/ton-surges-36-telegram-replaces-113411253.html",
  },
  {
    name: "모듈러·DA",
    what: "롤업용 데이터 가용성 레이어",
    tokens: ["TIA"],
    strength: "neutral",
    note: "Celestia 가 '이더리움의 경쟁자'에서 '스케일링 파트너'로 재포지셔닝(블록 8MB→1GB/s 로드맵). 토큰 가치 포착이 핵심 변수.",
    source: "https://www.dextools.io/tutorials/what-is-celestia-tia-modular-guide",
  },
];

const L2_SUBSECTORS: SubSector[] = [
  {
    name: "옵티미스틱 롤업",
    what: "Optimistic Rollup (7일 사기증명 윈도)",
    tokens: ["ARB", "OP"],
    strength: "leading",
    note: "TVL 지배 아키텍처 — Arbitrum ~$13.8B(~40%), Base ~$11.2B(토큰 없음), OP ~$5.6B. **그러나 ARB·OP 토큰은 고점 대비 -95~99%** — 언락 희석 + '수수료 매출 공백'. ARB 6/16 ~92.65M 언락.",
    source: "https://crypto-economy.com/arbitrums-unlock-reveals-the-revenue-void-beneath-layer-2-scale/",
  },
  {
    name: "ZK 롤업",
    what: "Zero-Knowledge 유효성 증명 L2",
    tokens: ["ZK", "STRK", "LINEA"],
    strength: "neutral",
    note: "기술적 우위·TVL/토큰은 약함. zkSync TVL 최고지만 출처 편차 극심($404M vs $4~5B). Linea 활동 최고(MetaMask 배포). Starknet 최약(에어드랍 후 사용자 급감, STRK 사상 최저).",
    source: "https://unchainedcrypto.com/starknets-strk-plunges-to-all-time-low-as-key-metrics-show-persistent-decline/",
  },
  {
    name: "앱체인·슈퍼체인",
    what: "OP Stack·Orbit 등 L2 프레임워크",
    tokens: ["OP", "ARB"],
    strength: "neutral",
    note: "OP Stack 이 슈퍼체인(Base 등) 기반 — 강점은 호스팅 체인을 통해 발현. 체인 수 폭증이 단편화 vs 네트워크효과 논쟁을 부른다.",
    source: "https://www.spotedcrypto.com/ethereum-layer-2-guide-2026-optimistic-vs-zk-rollups/",
  },
];

// ── 섹터 → 서브섹터 ─────────────────────────────────────────────────
export const RESEARCH_SUBSECTORS: Record<ResearchSectorId, SubSector[]> = {
  ai: AI_SUBSECTORS,
  defi: DEFI_SUBSECTORS,
  rwa: RWA_SUBSECTORS,
  "layer-1": L1_SUBSECTORS,
  "layer-2": L2_SUBSECTORS,
  depin: AI_SUBSECTORS, // DePIN 은 AI/컴퓨팅 서브섹터 공유
  // 시장 개요(매크로·주간·플래시) 섹터는 서브섹터 분해 미적용
  btc: [],
  meme: [],
  gaming: [],
  "solana-eco": [],
  "cosmos-eco": [],
  "perp-dex": [],
  "oracle-data": [],
  "zk-privacy": [],
  other: [],
};

export function subsectorsForSector(sector: ResearchSectorId): SubSector[] {
  return RESEARCH_SUBSECTORS[sector] ?? [];
}
