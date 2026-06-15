/**
 * 리서치 차트 데이터 — slug → 차트 스펙 (2026-06-14).
 *
 * 본문(bodyHtml)은 백엔드 tRPC seed 가 소스지만, 차트는 React(Recharts)로
 * 렌더해야 하므로 *프론트 전용 데이터 레이어*로 둔다(백엔드 타입 변경 불필요).
 * ResearchArticle 이 slug 로 이 모듈을 조회해 "주요 데이터" 섹션에 렌더한다.
 *
 * 데이터 정책 (기관 컨벤션):
 *   - 모든 차트는 *as-of 날짜 + 출처*를 캡션에 명시한다(스냅샷이지 실시간 아님).
 *   - 수치는 발행 시점 기준 보도값 — 라이브가 필요하면 본문이 /sectors 로 위임.
 *   - 시계열이 아닌 프레임워크 도식은 note 에 "개념도"로 명시한다.
 *
 * 헌장: 차트는 디스커버리/교육용 시각화. 단독 매매 시그널 아님.
 */

export type ResearchChartType = "line" | "area" | "bar";

export interface ResearchChartSeries {
  /** data row 의 키 */
  key: string;
  /** 범례/툴팁 라벨 */
  label: string;
  /** CSS color (생략 시 --primary) */
  color?: string;
}

export interface ResearchChartSpec {
  type: ResearchChartType;
  title: string;
  /** x축 키 (각 data row 의 카테고리/시간) */
  xKey: string;
  series: ResearchChartSeries[];
  data: Array<Record<string, string | number>>;
  /** y축/툴팁 숫자 포맷. "usd-b" = 값이 이미 10억(B) 단위. */
  format?: "usd" | "usd-b" | "pct" | "ratio" | "plain";
  /** bar 차트에서 값 부호로 색칠(+녹/−적). 단일 series bar 전용. */
  colorBySign?: boolean;
  /** "2026-06-12 기준" 등 */
  asOf: string;
  /** "출처: ..." */
  source: string;
  /** 주의/개념도 표기 */
  note?: string;
}

const UP = "#55ac57";
const DOWN = "#d33c3c";
const BLUE = "#185adb";
const AMBER = "#fc6736";

// ── slug → 차트들 ───────────────────────────────────────────────────
export const RESEARCH_CHARTS: Record<string, ResearchChartSpec[]> = {
  // 매크로 — 레짐 프레임 도식 (개념도)
  "macro-liquidity-regime-2026-06": [
    {
      type: "bar",
      title: "유동성 레짐별 권장 위험 예산 (개념도)",
      xKey: "regime",
      series: [{ key: "budget", label: "위험 예산", color: BLUE }],
      data: [
        { regime: "유동성 수축", budget: 30 },
        { regime: "중립", budget: 55 },
        { regime: "유동성 확장", budget: 80 },
      ],
      format: "pct",
      asOf: "프레임워크 도식",
      source: "Onramp — Macro Liquidity Cycle (개념 재구성)",
      note: "개념도 — 실측 시계열이 아니라 레짐→사이징 로직의 도식이다. 실제 비중은 기관의 위험 예산에 따른다.",
    },
  ],

  // 주간 시황 #13 — BTC ETF 주간 순유출
  "weekly-13-risk-off-rotation": [
    {
      type: "bar",
      title: "BTC 현물 ETF 주간 순유출 (6월 초, 4주 연속)",
      xKey: "week",
      series: [{ key: "flow", label: "주간 순유입(-유출)", color: DOWN }],
      data: [
        { week: "5월 4주", flow: -0.3 },
        { week: "6월 1주", flow: -0.7 },
        { week: "6월 2주", flow: -1.0 },
        { week: "6월 3주", flow: -3.4 },
      ],
      format: "usd-b",
      colorBySign: true,
      asOf: "2026-06-13 기준",
      source: "출처: Investing.com · SoSoValue (주간 분할은 근사, 4주 누적 ~-$5.4B)",
      note: "단일 주 -$3.4B 는 2024-01 출시 이후 최대 주간 순유출.",
    },
  ],

  // RWA — 온체인 시장 규모 성장
  "rwa-resilience-tokenized-2026-06": [
    {
      type: "area",
      title: "토큰화 RWA 온체인 시장 규모 (스테이블 제외)",
      xKey: "t",
      series: [{ key: "mcap", label: "온체인 가치", color: BLUE }],
      data: [
        { t: "2025-01", mcap: 5.4 },
        { t: "2025-07", mcap: 12 },
        { t: "2026-01", mcap: 20 },
        { t: "2026-06", mcap: 32 },
      ],
      format: "usd-b",
      asOf: "2026-06 기준",
      source: "출처: CoinGecko RWA Report · rwa.xyz (대략값)",
      note: "정의별 상이 — Binance 'active RWA' +589%, CoinGecko +256.7%. 본 차트는 분산가치 집계 기준.",
    },
  ],

  // AI — 토큰 1개월 수익률
  "ai-sector-relative-strength-2026-06": [
    {
      type: "bar",
      title: "주요 AI 토큰 1개월 수익률 (보도 기준)",
      xKey: "token",
      series: [{ key: "ret", label: "1개월 %", color: UP }],
      data: [
        { token: "WLD", ret: 120 },
        { token: "TAO", ret: 87 },
        { token: "NEAR", ret: 60 },
        { token: "FET", ret: 60 },
        { token: "RENDER", ret: 31 },
      ],
      format: "pct",
      colorBySign: true,
      asOf: "2026-06 보도 기준",
      source: "출처: CoinDesk·Decrypt·CMC (트레일링 30일, 상당분 3월 GTC 레그 포함)",
      note: "하락장 속 상대강도 — 절대 강세장 아님. 정확한 as-of 는 /sectors 라이브 참조.",
    },
  ],

  // DeFi — 스테이블코인 총공급
  "defi-bluechip-fee-switch-2026-06": [
    {
      type: "area",
      title: "스테이블코인 총공급 (사상 최고 부근)",
      xKey: "t",
      series: [{ key: "supply", label: "총공급", color: AMBER }],
      data: [
        { t: "2025-06", supply: 250 },
        { t: "2025-12", supply: 295 },
        { t: "2026-04", supply: 320 },
        { t: "2026-06", supply: 321 },
      ],
      format: "usd-b",
      asOf: "2026-06 기준",
      source: "출처: DefiLlama · KuCoin (USDT ~$185B · USDC ~$78B)",
      note: "온체인 '대기 자본'(dry powder) — 공급 증가가 곧 매수는 아님.",
    },
  ],
};

export function chartsForSlug(slug: string): ResearchChartSpec[] {
  return RESEARCH_CHARTS[slug] ?? [];
}
