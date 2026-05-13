/**
 * 각 코인별 용도 / 목적 / 비전 — 정적 메타 데이터.
 *
 * 사용자 요청 (2026-05-11): "코인 정보" 탭에 각 코인의 *무엇을 하는 코인인지*
 * 정리. 백엔드 coin-meta.ts 는 시총/거래량 같은 market 데이터를 다루는 반면,
 * 본 데이터는 *서사적/근본적* 설명 (project category, raison d'être).
 *
 * 데이터는 frontend 정적 import — 변동성 거의 없고 빌드 시점에 묶여도 OK.
 * 새 코인 추가 시 본 파일에 항목 추가만 하면 자동 반영.
 */

export interface CoinInfo {
  /** 정식 명칭 */
  name: string;
  /** 약식 카테고리 (예: "Layer 1", "Layer 2", "Meme", "DeFi", "Oracle"...) */
  category: string;
  /** 1줄 핵심 요약 — 라벨 옆에 표기 */
  tagline: string;
  /** 용도 — 무엇을 위해 만들어졌고 어떤 문제를 해결하는가 */
  purpose: string;
  /** 비전 — 장기 목표, 생태계 위치 */
  vision: string;
  /** 주요 활용 사례 (3~5개) */
  useCases: string[];
  /** 핵심 기술 / 차별점 (선택) */
  techHighlights?: string[];
  /** 공식 사이트 URL (선택) */
  website?: string;
}

/**
 * 심볼 → 정보 매핑.
 * 백엔드 SYMBOL_TO_CG_ID (coin-meta.ts) 와 동일한 화이트리스트 기준.
 */
export const COIN_INFO: Record<string, CoinInfo> = {
  BTCUSDT: {
    name: "Bitcoin",
    category: "Layer 1 · Store of Value",
    tagline: "디지털 금 (Digital Gold) — 탈중앙 P2P 화폐",
    purpose:
      "중앙 기관 없이 전 세계 누구나 가치를 저장하고 송금할 수 있는 검열 저항적 디지털 화폐. 2,100만 개로 발행량이 고정되어 인플레이션 헷지 자산으로 자리매김.",
    vision:
      "글로벌 reserve asset — 금을 대체하는 디지털 가치 저장 수단. 기관 자금 유입과 ETF 승인으로 macro asset class 의 한 축으로 확장 중.",
    useCases: [
      "장기 가치 저장 (Store of Value)",
      "국가 간 송금 / 인플레이션 회피",
      "기관 포트폴리오 alternative asset",
      "Lightning Network 기반 마이크로 결제",
    ],
    techHighlights: ["PoW (SHA-256)", "21M cap", "10분 블록", "Lightning L2"],
    website: "https://bitcoin.org",
  },
  ETHUSDT: {
    name: "Ethereum",
    category: "Layer 1 · Smart Contract Platform",
    tagline: "프로그래머블 블록체인 — 탈중앙 앱(dApp) 의 기반",
    purpose:
      "스마트 컨트랙트 기반 dApp / DeFi / NFT / DAO 의 글로벌 정산 레이어. PoS 전환(Merge) 후 에너지 효율과 보안을 동시에 확보.",
    vision:
      "탈중앙 인터넷 (Web3) 의 기반 계층. 모든 가치 이동·금융·디지털 자산이 ETH 네트워크 위에서 정산되는 'World Computer'.",
    useCases: [
      "DeFi (탈중앙 금융 — Uniswap, Aave, Compound)",
      "NFT 발행 / 유통 (ERC-721/1155)",
      "Layer 2 (Arbitrum, Optimism) 의 정산 레이어",
      "Staking yield (PoS)",
      "DAO governance",
    ],
    techHighlights: ["PoS (Casper)", "EVM", "EIP-1559 burn", "Sharding 로드맵"],
    website: "https://ethereum.org",
  },
  SOLUSDT: {
    name: "Solana",
    category: "Layer 1 · High-throughput",
    tagline: "초고속 단일 체인 — 65,000 TPS 처리 목표",
    purpose:
      "Proof of History + Proof of Stake 결합으로 초고속 거래 처리(저레이턴시·저수수료). DEX·NFT·게임·소셜앱 등 mass-market 활용 지향.",
    vision:
      "Web2 수준의 UX 를 Web3 에 도입 — 수수료 $0.0001 + 1초 이내 finality 로 일반 사용자도 부담 없이 사용하는 main-stream 블록체인.",
    useCases: [
      "고빈도 DEX 거래 (Jupiter, Raydium)",
      "NFT 마켓 (Tensor, Magic Eden)",
      "Solana Pay 결제 인프라",
      "DePIN (Helium, Hivemapper) 인프라 토큰",
    ],
    techHighlights: ["PoH + PoS", "Single shard", "Sealevel parallel exec"],
    website: "https://solana.com",
  },
  XRPUSDT: {
    name: "XRP (Ripple)",
    category: "Payments · CBDC Infra",
    tagline: "은행 간 정산 — 3초 finality 의 cross-border 송금",
    purpose:
      "기존 SWIFT 대비 빠르고 저렴한 국가 간 송금. 은행과 PSP 가 활용하는 ODL(On-Demand Liquidity) 의 정산 자산.",
    vision:
      "글로벌 결제 인프라 — 각국 CBDC 와 stablecoin 의 cross-chain 정산 허브. SEC 소송 일부 승소 후 institutional adoption 확대.",
    useCases: [
      "은행 간 cross-border 송금 (ODL)",
      "CBDC 정산 레이어",
      "마이크로 결제 (0.00001 XRP / 거래)",
    ],
    techHighlights: ["XRPL Consensus", "3.5s finality", "1,500 TPS"],
    website: "https://ripple.com",
  },
  AAVEUSDT: {
    name: "Aave",
    category: "DeFi · Lending Protocol",
    tagline: "탈중앙 머니마켓 — 담보 기반 대출/예치",
    purpose:
      "스마트컨트랙트 기반 무허가 대출 시장. 사용자가 암호화폐를 담보로 다른 자산을 빌리거나, 예치하여 이자를 받는 글로벌 lending pool.",
    vision:
      "전통 금융의 신용 시스템을 탈중앙으로 대체 — 은행 없이 누구나 신용 접근 가능한 글로벌 머니마켓.",
    useCases: [
      "암호화폐 담보 대출 (USDC/USDT 차입)",
      "수동 yield farming (예치 이자)",
      "Flash Loan (블록 단위 무담보 대출)",
      "GHO 스테이블코인 발행",
    ],
    techHighlights: ["Liquidation 엔진", "aToken 자동 이자", "Cross-chain"],
    website: "https://aave.com",
  },
  DOGEUSDT: {
    name: "Dogecoin",
    category: "Meme · Payment Coin",
    tagline: "최초의 밈코인 — 친근한 P2P 디지털 화폐",
    purpose:
      "2013년 Litecoin 포크로 출발한 농담성 코인이 강한 커뮤니티와 일론 머스크 후원으로 P2P 결제 토큰으로 성장. 인플레이션 무제한 발행.",
    vision:
      "장벽 낮은 일상 결제 — Twitter/X 결제 통합 가능성과 SpaceX의 DOGE-1 미션 등 mass-market 브랜드 코인.",
    useCases: [
      "팁/소액 결제 (Reddit, Twitter)",
      "온라인 머천트 결제",
      "기부 / 자선 (Jamaica 봅슬레이 팀 등)",
    ],
    techHighlights: ["Scrypt PoW", "1분 블록", "무제한 발행"],
    website: "https://dogecoin.com",
  },
  SUIUSDT: {
    name: "Sui",
    category: "Layer 1 · Move VM",
    tagline: "Object-centric 데이터 모델의 차세대 L1",
    purpose:
      "Meta 의 Diem 출신 팀이 만든 Move 언어 기반 L1. 자산을 object 로 다루어 병렬 처리 효율 극대화 — 게임/NFT 같은 고빈도 인터랙션 최적화.",
    vision:
      "Web3 게임과 소셜앱이 native 로 작동하는 인프라. Aptos 와 함께 Move 생태계 양강.",
    useCases: [
      "온체인 게임 (Sui 8192 등)",
      "Object NFT (조립/변형 가능)",
      "Web3 소셜앱 (zk-Login)",
    ],
    techHighlights: ["Move VM", "Object-centric", "Parallel exec", "zkLogin"],
    website: "https://sui.io",
  },
  PEPEUSDT: {
    name: "Pepe",
    category: "Meme · Community",
    tagline: "2023년 최대 밈코인 — 펩 더 프록 커뮤니티 토큰",
    purpose:
      "Matt Furie 의 'Pepe the Frog' 캐릭터를 모티브로 한 ERC-20 밈코인. 유틸리티 없이 community-driven 으로 거래 활동 자체가 가치.",
    vision:
      "Meme 사이클의 대표 자산 — DOGE/SHIB 다음 세대 밈코인 리더 자리. 유틸리티 추가 (DEX, NFT) 시도 진행 중.",
    useCases: [
      "Meme 사이클 투자",
      "커뮤니티 토큰 (Telegram, Discord)",
      "단기 거래 / 유동성 제공",
    ],
    techHighlights: ["ERC-20", "재단 holdings burned", "Pepe DAO"],
  },
  AVAXUSDT: {
    name: "Avalanche",
    category: "Layer 1 · Subnet Architecture",
    tagline: "Subnet 기반 다중 체인 플랫폼",
    purpose:
      "Avalanche Consensus 와 Subnet 아키텍처로 EVM 호환 빠른 처리 + 기관/게임 전용 맞춤 체인 발행 가능.",
    vision:
      "기관·게임·기업이 자체 Subnet 을 만들어 운영하는 multi-chain 인프라. RWA(Real-World Asset) 토큰화 허브.",
    useCases: [
      "Subnet — 게임/기관 전용 체인 (DeFi Kingdoms 등)",
      "Avalanche C-Chain DeFi (Trader Joe, Benqi)",
      "RWA 토큰화 (JP Morgan Onyx 파트너십)",
    ],
    techHighlights: ["Avalanche Consensus", "Subnet", "EVM 호환"],
    website: "https://avax.network",
  },
  ADAUSDT: {
    name: "Cardano",
    category: "Layer 1 · Research-driven",
    tagline: "Peer-reviewed 학술 기반 PoS 블록체인",
    purpose:
      "Ethereum 공동 창업자 Charles Hoskinson 이 만든 layered architecture (정산 + 컴퓨테이션 분리) PoS 체인. 학계 peer review 기반 신중한 업그레이드.",
    vision:
      "개발도상국 정부 / 신원 인증 / 학적 발급 같은 government-grade 인프라. 아프리카 정부 파트너십 다수.",
    useCases: [
      "Plutus 스마트컨트랙트 (Haskell)",
      "Cardano Stake Pool 위임",
      "Atala PRISM — 디지털 신원 (Ethiopia 학생증)",
    ],
    techHighlights: ["Ouroboros PoS", "UTxO 모델", "Haskell"],
    website: "https://cardano.org",
  },
};

/** 정보 미등록 코인 fallback. */
export const COIN_INFO_FALLBACK: CoinInfo = {
  name: "정보 미등록",
  category: "Unknown",
  tagline: "본 코인의 상세 정보가 아직 등록되지 않았습니다.",
  purpose:
    "이 코인에 대한 용도 / 비전 설명은 향후 추가될 예정입니다. 일반적인 거래 메트릭은 다른 탭에서 확인 가능합니다.",
  vision:
    "프로젝트 공식 사이트나 CoinGecko 페이지를 참고해주세요.",
  useCases: [],
};

export function getCoinInfo(symbol: string): CoinInfo {
  return COIN_INFO[symbol.toUpperCase()] ?? COIN_INFO_FALLBACK;
}
