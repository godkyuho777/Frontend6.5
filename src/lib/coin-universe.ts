/**
 * 코인 유니버스 — 바이비트에 상장된 *전체* USDT 스팟 페어 (동적).
 *
 * 기존 정적 `TOP_COINS`(~95 큐레이션)는 selector / 인기코인 단축용으로 유지하고,
 * Signal Scanner 와 Sector Pulse 는 바이비트의 모든 USDT 스팟 코인을 사용한다.
 * `fetchAll24hTickers()` 한 번으로 전체 심볼을 얻을 수 있으므로(이미 USDT 필터),
 * 24h 거래대금 내림차순으로 정렬해 유동성 높은 코인이 앞 페이지에 오게 한다.
 *
 * 헌장: 유니버스 확장은 *디스커버리* 범위만 넓힐 뿐 BBDX 시그널 로직과 무관.
 */

import { fetchAll24hTickers } from "./bybit-client";
import { TOP_COINS } from "@shared/types";

// 레버리지 토큰(예: BTC3LUSDT, ETH3SUSDT, SOL2LUSDT)은 개별 암호화폐가 아니라
// 파생 상품이므로 유니버스에서 제외한다. (1000PEPE/1MBABYDOGE 같은 denom 변형은
// `\dL|S` 패턴이 아니므로 유지된다.)
const LEVERAGED_TOKEN_RE = /\d[LS]USDT$/;

/** 스캔/섹터 집계 대상에서 제외할 심볼인지(레버리지 토큰 등). */
export function isExcludedSymbol(symbol: string): boolean {
  return LEVERAGED_TOKEN_RE.test(symbol);
}

let universeCache: { symbols: string[]; ts: number } | null = null;
const UNIVERSE_TTL = 60 * 60 * 1000; // 1h — 상장 집합은 천천히 변함

/**
 * 바이비트 전체 USDT 스팟 코인 목록(24h 거래대금 desc). 1h 캐시.
 * 네트워크 실패 / 빈 응답 시 정적 `TOP_COINS` 로 graceful fallback.
 */
export async function getCoinUniverse(): Promise<string[]> {
  if (universeCache && Date.now() - universeCache.ts < UNIVERSE_TTL) {
    return universeCache.symbols;
  }
  try {
    const tickers = await fetchAll24hTickers();
    const symbols = Array.from(tickers.entries())
      .filter(([sym]) => !isExcludedSymbol(sym))
      .sort((a, b) => (b[1].volume24h || 0) - (a[1].volume24h || 0))
      .map(([sym]) => sym);
    if (symbols.length === 0) return TOP_COINS;
    universeCache = { symbols, ts: Date.now() };
    return symbols;
  } catch {
    return TOP_COINS;
  }
}

/** 캐시 무효화 — 강제 새로고침 시. */
export function clearUniverseCache(): void {
  universeCache = null;
}
