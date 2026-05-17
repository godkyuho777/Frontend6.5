/**
 * Sector Pulse — 암호화폐 섹터 taxonomy (2026-05-17).
 *
 * TOP_COINS (95 개) 를 시장 통념에 따라 12개 sector 로 분류.
 * 한 코인은 1~3 sector 에 속할 수 있다 (예: ETH = Layer 1 + Smart Contract,
 * SOL = Layer 1 + Solana Eco). Sector Pulse 페이지는 코인의 24h % 변동률을
 * 각 sector 평균으로 집계하여 표시.
 *
 * 분류 기준:
 *   - CoinMarketCap / CoinGecko 의 카테고리 태깅
 *   - 프로젝트 공식 백서의 self-declared focus
 *   - 시장 통념 (Crypto Twitter / Messari narrative)
 *
 * 헌장: 본 taxonomy 는 *디스커버리 보조* 용도. BBDX 시그널과 무관 (Sector
 * Pulse 는 modifier 가 아님).
 */

import type { LucideIcon } from "lucide-react";
import {
  Layers,
  Network,
  Banknote,
  Smile,
  Cpu,
  Gamepad2,
  Sparkles,
  Globe,
  TrendingUp,
  Radar,
  Coins,
  Lock,
} from "lucide-react";

export type SectorId =
  | "layer-1"
  | "layer-2"
  | "defi"
  | "meme"
  | "ai"
  | "gaming"
  | "solana-eco"
  | "cosmos-eco"
  | "perp-dex"
  | "oracle-data"
  | "rwa"
  | "zk-privacy";

export interface SectorMeta {
  id: SectorId;
  name: string;
  description: string;
  icon: LucideIcon;
  /** Tailwind text color for sector card emphasis */
  color: string;
  /** Tailwind border + bg accent */
  accent: string;
}

export const SECTORS: SectorMeta[] = [
  {
    id: "layer-1",
    name: "Layer 1",
    description: "기본 블록체인 — 자체 합의 알고리즘 + 네이티브 토큰",
    icon: Layers,
    color: "text-neon-cyan",
    accent: "border-neon-cyan/40 bg-neon-cyan/5",
  },
  {
    id: "layer-2",
    name: "Layer 2",
    description: "L1 위 스케일링 솔루션 (Optimistic / ZK rollup, sidechain)",
    icon: Network,
    color: "text-purple-400",
    accent: "border-purple-400/40 bg-purple-400/5",
  },
  {
    id: "defi",
    name: "DeFi",
    description: "DEX · 대출 · 스테이블 · 유동성 — 탈중앙 금융 인프라",
    icon: Banknote,
    color: "text-neon-green",
    accent: "border-neon-green/40 bg-neon-green/5",
  },
  {
    id: "meme",
    name: "Meme",
    description: "밈 코인 — 커뮤니티 + 바이럴 driven, 변동성 ↑",
    icon: Smile,
    color: "text-neon-pink",
    accent: "border-neon-pink/40 bg-neon-pink/5",
  },
  {
    id: "ai",
    name: "AI",
    description: "AI / 머신러닝 · DePIN 컴퓨팅 인프라",
    icon: Cpu,
    color: "text-blue-400",
    accent: "border-blue-400/40 bg-blue-400/5",
  },
  {
    id: "gaming",
    name: "Gaming / Metaverse",
    description: "GameFi · NFT · 메타버스 · 스포츠",
    icon: Gamepad2,
    color: "text-orange-400",
    accent: "border-orange-400/40 bg-orange-400/5",
  },
  {
    id: "solana-eco",
    name: "Solana Eco",
    description: "Solana 위에서 동작하는 dApp / 토큰",
    icon: Sparkles,
    color: "text-violet-400",
    accent: "border-violet-400/40 bg-violet-400/5",
  },
  {
    id: "cosmos-eco",
    name: "Cosmos Eco",
    description: "IBC 기반 sovereign chain — 모듈러 + interchain",
    icon: Globe,
    color: "text-indigo-400",
    accent: "border-indigo-400/40 bg-indigo-400/5",
  },
  {
    id: "perp-dex",
    name: "Perp DEX",
    description: "탈중앙 영구 선물 거래소",
    icon: TrendingUp,
    color: "text-rose-400",
    accent: "border-rose-400/40 bg-rose-400/5",
  },
  {
    id: "oracle-data",
    name: "Oracle / Data",
    description: "오라클 · 인덱싱 · 분산 스토리지",
    icon: Radar,
    color: "text-teal-400",
    accent: "border-teal-400/40 bg-teal-400/5",
  },
  {
    id: "rwa",
    name: "RWA",
    description: "실물 자산 토큰화 (Real World Assets) + 국채 / Yield",
    icon: Coins,
    color: "text-amber-400",
    accent: "border-amber-400/40 bg-amber-400/5",
  },
  {
    id: "zk-privacy",
    name: "ZK / Privacy",
    description: "Zero-Knowledge · 프라이버시 · 모듈러 보안",
    icon: Lock,
    color: "text-emerald-400",
    accent: "border-emerald-400/40 bg-emerald-400/5",
  },
];

export const SECTOR_BY_ID: Record<SectorId, SectorMeta> = Object.fromEntries(
  SECTORS.map((s) => [s.id, s]),
) as Record<SectorId, SectorMeta>;

/**
 * Symbol → sector list 매핑.
 * 한 코인은 보통 1~2 sector 에 속함. SectorPulse 의 평균 계산 시 각 sector
 * 에 동일 가중치로 포함됨.
 */
export const SECTOR_MEMBERSHIPS: Record<string, SectorId[]> = {
  // ── Layer 1 (기반 블록체인) ─────────────────────────────
  BTCUSDT: ["layer-1"],
  ETHUSDT: ["layer-1"],
  SOLUSDT: ["layer-1", "solana-eco"],
  XRPUSDT: ["layer-1"],
  ADAUSDT: ["layer-1"],
  AVAXUSDT: ["layer-1"],
  DOTUSDT: ["layer-1"],
  NEARUSDT: ["layer-1", "ai"],
  APTUSDT: ["layer-1"],
  SUIUSDT: ["layer-1"],
  ATOMUSDT: ["layer-1", "cosmos-eco"],
  ALGOUSDT: ["layer-1"],
  ICPUSDT: ["layer-1"],
  HBARUSDT: ["layer-1"],
  TRXUSDT: ["layer-1"],
  XLMUSDT: ["layer-1"],
  KASUSDT: ["layer-1"],
  TONUSDT: ["layer-1"],
  LTCUSDT: ["layer-1"],
  BCHUSDT: ["layer-1"],
  VETUSDT: ["layer-1"],
  THETAUSDT: ["layer-1"],
  EGLDUSDT: ["layer-1"],
  MINAUSDT: ["layer-1", "zk-privacy"],
  XTZUSDT: ["layer-1"],
  KAVAUSDT: ["layer-1", "cosmos-eco"],
  ZILUSDT: ["layer-1"],
  ONEUSDT: ["layer-1"],
  XDCUSDT: ["layer-1"],
  FLOWUSDT: ["layer-1"],
  HYPEUSDT: ["layer-1", "perp-dex"],
  RVNUSDT: ["layer-1"],
  BNBUSDT: ["layer-1"],
  SEIUSDT: ["layer-1"],
  INJUSDT: ["layer-1", "cosmos-eco"],
  QNTUSDT: ["layer-1"],

  // ── Layer 2 (스케일링) ────────────────────────────────
  ARBUSDT: ["layer-2"],
  OPUSDT: ["layer-2"],
  MNTUSDT: ["layer-2"],
  IMXUSDT: ["layer-2", "gaming"],
  STXUSDT: ["layer-2"],
  POLUSDT: ["layer-2"],
  ALTUSDT: ["layer-2"],
  LRCUSDT: ["layer-2", "zk-privacy"],
  ZORAUSDT: ["layer-2"],

  // ── DeFi ──────────────────────────────────────────────
  AAVEUSDT: ["defi"],
  UNIUSDT: ["defi"],
  CRVUSDT: ["defi"],
  COMPUSDT: ["defi"],
  SNXUSDT: ["defi"],
  LDOUSDT: ["defi"],
  PENDLEUSDT: ["defi"],
  ENAUSDT: ["defi"],
  ONDOUSDT: ["defi", "rwa"],
  JUPUSDT: ["defi", "solana-eco"],
  ZRXUSDT: ["defi"],
  RUNEUSDT: ["defi", "cosmos-eco"],

  // ── Meme ──────────────────────────────────────────────
  DOGEUSDT: ["meme"],
  SHIBUSDT: ["meme"],
  PEPEUSDT: ["meme"],
  BONKUSDT: ["meme", "solana-eco"],
  WIFUSDT: ["meme", "solana-eco"],
  FLOKIUSDT: ["meme"],
  TRUMPUSDT: ["meme"],
  BASEDUSDT: ["meme"],
  MONUSDT: ["meme"],
  PENGUUSDT: ["meme"],
  FIGHTUSDT: ["meme"],

  // ── AI / DePIN ────────────────────────────────────────
  FETUSDT: ["ai"],
  RENDERUSDT: ["ai"],
  GRTUSDT: ["ai", "oracle-data"],
  WLDUSDT: ["ai"],
  VIRTUALUSDT: ["ai"],
  GRASSUSDT: ["ai"],

  // ── Gaming / Metaverse / NFT ───────────────────────────
  GALAUSDT: ["gaming"],
  AXSUSDT: ["gaming"],
  SANDUSDT: ["gaming"],
  MANAUSDT: ["gaming"],
  APEUSDT: ["gaming"],
  ENJUSDT: ["gaming"],
  CHZUSDT: ["gaming"],

  // ── Solana Ecosystem (이미 포함된 SOL/JUP/BONK/WIF 외) ──
  DRIFTUSDT: ["perp-dex", "solana-eco"],
  WUSDT: ["solana-eco"], // Wormhole — multichain bridge but Solana-anchored

  // ── Cosmos Ecosystem (이미 포함된 ATOM/KAVA/INJ/RUNE 외) ─
  TIAUSDT: ["cosmos-eco", "zk-privacy"], // Celestia 모듈러 DA

  // ── Perp DEX ──────────────────────────────────────────
  GMXUSDT: ["perp-dex", "defi"],
  DYDXUSDT: ["perp-dex", "defi"],

  // ── Oracle / Data / Storage ───────────────────────────
  LINKUSDT: ["oracle-data"],
  FILUSDT: ["oracle-data"],

  // ── RWA (실물자산) ────────────────────────────────────
  // ONDO 는 위에서 defi + rwa
  // 추가 RWA 토큰: 없음 (대부분 ONDO 가 대표)

  // ── ZK / Privacy / Modular ────────────────────────────
  ZROUSDT: ["zk-privacy"], // LayerZero — omnichain
  IPUSDT: ["zk-privacy"], // Story Protocol — IP layer

  // ── 미분류 / 기타 (single category) ────────────────────
  MASKUSDT: ["defi"], // MaskNetwork — social DeFi
  ANKRUSDT: ["oracle-data"], // Ankr — node infra
  LITUSDT: ["zk-privacy"], // Litentry — identity
  BATUSDT: ["ai"], // Brave Attention — ad/AI
  EDGEUSDT: ["oracle-data"], // Edge — infra
  XPLUSDT: ["rwa"], // Plume — RWA L2 (best guess)
};

/**
 * 특정 sector 에 속한 symbol 들 반환.
 * 정렬 기준 없음 — 호출자가 24h % 변동률 등으로 정렬.
 */
export function symbolsInSector(sectorId: SectorId): string[] {
  return Object.entries(SECTOR_MEMBERSHIPS)
    .filter(([, sectors]) => sectors.includes(sectorId))
    .map(([sym]) => sym);
}

/**
 * 특정 symbol 이 속한 sector 들 반환.
 * 미분류 코인은 빈 배열 반환.
 */
export function sectorsOf(symbol: string): SectorId[] {
  return SECTOR_MEMBERSHIPS[symbol] ?? [];
}
