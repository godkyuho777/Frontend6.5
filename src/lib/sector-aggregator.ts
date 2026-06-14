/**
 * Sector Pulse — sector 별 평균 24h 변동률 집계 (2026-05-17).
 *
 * Bybit 의 24h ticker 데이터를 받아 SECTOR_MEMBERSHIPS 매핑으로
 * sector 단위 평균을 계산한다.
 *
 * 집계 정책:
 *   - 평균: 단순 산술평균 (시총 가중치 X) — 작은 코인의 강한 반등도 포착
 *   - top performer: 24h % 변동률 최대 1개
 *   - bottom performer: 24h % 변동률 최소 1개 (drilldown 에 활용)
 *   - 24h volume 합산도 같이 노출
 */

import {
  SECTORS,
  SECTOR_MEMBERSHIPS,
  OTHER_SECTOR,
  symbolsInSector,
  sectorsOf,
  type SectorId,
  type SectorMeta,
} from "./sector-taxonomy";

export interface SectorTicker {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number; // turnover (USDT)
}

export interface SectorRow {
  sector: SectorMeta;
  /** 평균 24h % 변동 */
  avgChange24h: number;
  /** 섹터 내 코인 수 (TOP_COINS 안에서) */
  coinCount: number;
  /** 24h volume 합산 (USDT) */
  totalVolume24h: number;
  /** 상위 성과 코인 */
  topPerformer: SectorTicker | null;
  /** 하위 성과 코인 */
  bottomPerformer: SectorTicker | null;
  /** 섹터 전체 코인 리스트 (drill-down 용, 24h% desc) */
  coins: SectorTicker[];
}

/**
 * tickers map (symbol → SectorTicker) 을 받아 12 sector 별 통계 산출.
 *
 * @param tickers Bybit `fetchAll24hTickers` 결과를 SectorTicker[] 로 변환한 것
 * @returns 12 SectorRow (sector 순서는 SECTORS 배열 순서 유지)
 */
export function aggregateBySector(
  tickers: Map<string, SectorTicker>,
): SectorRow[] {
  const rows: SectorRow[] = SECTORS.map((sector) => {
    const symbols = symbolsInSector(sector.id);
    const coins: SectorTicker[] = [];
    for (const sym of symbols) {
      const t = tickers.get(sym);
      if (t && Number.isFinite(t.change24h)) {
        coins.push(t);
      }
    }

    // 24h% 내림차순 정렬
    coins.sort((a, b) => b.change24h - a.change24h);

    const avgChange24h =
      coins.length > 0
        ? coins.reduce((sum, c) => sum + c.change24h, 0) / coins.length
        : 0;
    const totalVolume24h = coins.reduce((sum, c) => sum + c.volume24h, 0);

    return {
      sector,
      avgChange24h,
      coinCount: coins.length,
      totalVolume24h,
      topPerformer: coins[0] ?? null,
      bottomPerformer: coins[coins.length - 1] ?? null,
      coins,
    };
  });

  // ── 기타(미분류) 버킷 — 명시 taxonomy 에 없는 모든 코인 ──────────
  // 유니버스가 바이비트 전체로 확장되면서 분류 안 된 신규 코인을 catch-all.
  const otherCoins: SectorTicker[] = [];
  for (const t of tickers.values()) {
    if (sectorsOf(t.symbol).length === 0 && Number.isFinite(t.change24h)) {
      otherCoins.push(t);
    }
  }
  if (otherCoins.length > 0) {
    otherCoins.sort((a, b) => b.change24h - a.change24h);
    const avgChange24h =
      otherCoins.reduce((s, c) => s + c.change24h, 0) / otherCoins.length;
    const totalVolume24h = otherCoins.reduce((s, c) => s + c.volume24h, 0);
    rows.push({
      sector: OTHER_SECTOR,
      avgChange24h,
      coinCount: otherCoins.length,
      totalVolume24h,
      topPerformer: otherCoins[0] ?? null,
      bottomPerformer: otherCoins[otherCoins.length - 1] ?? null,
      coins: otherCoins,
    });
  }

  return rows;
}

/**
 * Sector row 들을 변동률 desc 로 정렬 (디스커버리 UX — 상승 섹터 먼저).
 */
export function sortByPerformance(rows: SectorRow[]): SectorRow[] {
  return [...rows].sort((a, b) => b.avgChange24h - a.avgChange24h);
}

/**
 * Sector row 들을 절대값 desc 로 정렬 (volatility — 가장 큰 움직임 먼저).
 * 강세든 약세든 큰 변동성을 보이는 섹터를 우선 노출.
 */
export function sortByVolatility(rows: SectorRow[]): SectorRow[] {
  return [...rows].sort(
    (a, b) => Math.abs(b.avgChange24h) - Math.abs(a.avgChange24h),
  );
}

/**
 * TOP_COINS 중 어느 sector 에도 속하지 않은 미분류 코인 반환.
 * 분류 누락 모니터링용 (개발 시 console.warn 또는 admin 페이지).
 */
export function findUnclassified(topCoins: string[]): string[] {
  return topCoins.filter((sym) => !SECTOR_MEMBERSHIPS[sym]);
}

export type { SectorId, SectorMeta };
