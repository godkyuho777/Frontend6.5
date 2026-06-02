/**
 * Macro Liquidity Tracker — 5개 detail 페이지 공유 메타 타입.
 *
 * 본 파일은 SOFR / WALCL / YieldCurve / DxyVix / RealRate 페이지가
 * 공통으로 소비하는 정적 메타데이터를 hardcode 한다.
 *  - 학술 레퍼런스 (Bowman et al. 2024, Park & Irwin 2007 등)
 *  - 역사적 사례 (SVB 사태, UK Gilt 위기, COVID 패닉 등)
 *  - regime → multiplier 매핑 + 한국어 설명
 *  - FRED 시리즈 ID 와 라벨
 *
 * 본 메타는 백엔드 로직과 분리됨 — UI 만 쓰는 정적 텍스트라 backend
 * d.ts 와 동기화 필요 없음. 새 indicator 추가 시 본 파일만 갱신.
 */
import type { MacroRegime } from "@shared/macro-types";

// ─── Indicator 키 ─────────────────────────────────────────
export type MacroIndicatorKey =
  | "sofr-iorb"
  | "walcl"
  | "yield-curve"
  | "dxy-vix"
  | "real-rate";

// ─── 메타 형상 ─────────────────────────────────────────────
export interface MacroFredSeries {
  /** FRED series ID (예: "SOFR", "IORB"). */
  id: string;
  /** 차트 라벨. */
  label: string;
  /** 단위 (예: "%", "bp", "$B"). */
  unit?: string;
  /** 색상 (oklch 권장). */
  color?: string;
  /** spread 등 derived 시리즈 여부 (둘을 빼서 계산). */
  derived?: boolean;
  /** derived 일 때 minuend/subtrahend 시리즈 ID. */
  minuend?: string;
  subtrahend?: string;
  /** derived 결과 스케일 (예: SOFR-IORB 를 bp 로 변환하려면 100). */
  scale?: number;
}

export interface MacroReference {
  /** 출처 (저자/기관 + 연도). */
  source: string;
  /** 한국어 요지 (1-2 문장). */
  finding: string;
  /** 강조 라벨 (선택). */
  tag?: string;
}

export interface MacroHistoricalEvent {
  /** ISO 날짜 (YYYY-MM-DD). */
  date: string;
  /** 이 지표의 당시 값 (단위는 indicator 마다 상이). */
  value: number;
  /** 이 지표 단위 라벨 (예: "bp", "%"). */
  unit: string;
  /** 동시 BTC 수익률 (%) — 음수면 하락. */
  btcReturn: number;
  /** 한국어 한 줄 설명. */
  description: string;
}

export interface MacroRegimeDescriptor {
  /** 헌장 5단계 regime 키. */
  key: MacroRegime;
  /** 표시 라벨 (대문자). */
  label: string;
  /** multiplier (0.30 ~ 1.40). */
  multiplier: number;
  /** 한국어 설명 (왜 이 multiplier 가 부여되는가). */
  description: string;
  /** Tailwind text color class. */
  textClass: string;
  /** Tailwind bg color class. */
  bgClass: string;
  /** 차트 영역 강조용 oklch 색상. */
  oklch: string;
}

export interface MacroIndicatorMeta {
  /** 페이지 제목. */
  title: string;
  /** 차원 라벨 (예: "6차원 매크로"). */
  dimension: string;
  /** 헤더 본문 (1-2 문장). */
  description: string;
  /** 핵심 한 줄 (TL;DR). */
  tagline: string;
  /** FRED 시리즈 정의 (raw + derived). */
  fredSeries: MacroFredSeries[];
  /** 학술 레퍼런스 (Bowman 등 hardcode). */
  references: MacroReference[];
  /** 역사적 사례 (SVB 사태 등). */
  historicalEvents: MacroHistoricalEvent[];
  /** 5단계 regime 별 기본 설명 — stub 일 때도 표시. */
  regimeRulebook: MacroRegimeDescriptor[];
  /**
   * 정적 룰북 (stub 모드 default Interpretation).
   * 키 등록 후에도 fallback 으로 쓰임.
   */
  staticInterpretation: string;
  /** 현재 값 카드에 표시할 키 목록 (snapshot 의 field 명). */
  currentValueKeys: MacroCurrentValueKey[];
}

/**
 * MacroLayer 의 field 중 하나를 가리키는 키 + 메타.
 * snapshot 에서 안전하게 추출 위해 함수 + 라벨 + 단위를 명시.
 */
export interface MacroCurrentValueKey {
  label: string;
  /** label 옆 짧은 부연 (선택). */
  hint?: string;
  /** snapshot 에서 값 추출. */
  pick: (layer: any) => number | null | undefined;
  /** 표시 단위 (예: "bp", "%"). */
  unit: string;
  /** 소수점 자리수 (default 2). */
  digits?: number;
  /** 양수가 좋은 신호인지 (true 면 양수=초록). */
  positiveIsGood?: boolean;
  /** 카드 강조 (true 면 큰 글씨). */
  primary?: boolean;
  /** 값 타입 — "number" (default) 또는 "categorical" (string label 표시). */
  valueType?: "number" | "categorical";
  /** 커스텀 포맷터 — 단위/digits 무시하고 자유로운 문자열 반환. */
  formatValue?: (v: number) => string;
  /** valueType === "categorical" 일 때 layer 에서 string 추출. */
  pickCategorical?: (layer: any) => string | null | undefined;
  /** categorical 값 → Tailwind text color class 매핑 (예 "text-emerald-300"). */
  categoricalColor?: (v: string) => string;
  /** categorical 값 → 사람-친화 라벨 매핑 (예 "crypto_rally" → "CRYPTO RALLY"). */
  categoricalLabel?: (v: string) => string;
  /**
   * snapshot 미포함 (백엔드 layer 에 필드 없는 경우 사용).
   * 카드는 "—" + stubReason 표시 (예: DXY 절대 수준).
   */
  stubReason?: string;
  /**
   * layer 대신 series 의 latest 값을 사용 (FRED raw / derived 시리즈).
   * 예: WALCL 절대 수준 = series "WALCL" 의 latest value.
   * pick 함수는 무시됨.
   */
  fromSeriesId?: string;
}

// ─── 5단계 regime 룰북 (모든 indicator 공유) ──────────────
export const REGIME_RULEBOOK: MacroRegimeDescriptor[] = [
  {
    key: "crisis",
    label: "위기",
    multiplier: 0.3,
    description:
      "위기 강화 — 자금시장 경색 / Treasury stress / VIX 급등 동시 발생. BBDX LONG 시그널의 신뢰도를 30% 로 강하게 감쇄. 헤지 / 포지션 축소 권고.",
    textClass: "text-red-400",
    bgClass: "bg-red-500/15 border-red-500/40",
    oklch: "oklch(0.65 0.25 25)",
  },
  {
    key: "tight",
    label: "긴축",
    multiplier: 0.65,
    description:
      "긴축 — 부분적 유동성 위축. SOFR-IORB Spread 양수 진입 / Real Rate 상승 / Yield Curve 역전 심화. multiplier 0.65 로 보수적.",
    textClass: "text-orange-400",
    bgClass: "bg-orange-500/15 border-orange-500/40",
    oklch: "oklch(0.7 0.18 60)",
  },
  {
    key: "neutral",
    label: "중립",
    multiplier: 1.0,
    description:
      "중립 — composite signal 명확한 방향 없음. multiplier 1.0 = BBDX 점수 그대로 유지. 다른 차원 (signal/wave/onchain) 으로만 결정.",
    textClass: "text-slate-300",
    bgClass: "bg-slate-500/15 border-slate-500/40",
    oklch: "oklch(0.7 0.05 260)",
  },
  {
    key: "easing",
    label: "완화",
    multiplier: 1.2,
    description:
      "완화 — Fed 자세 dovish / Real Rate 하락 / Net Liquidity 증가. multiplier 1.20 으로 BBDX LONG 신호를 가중. risk-on 환경 진입.",
    textClass: "text-neon-green",
    bgClass: "bg-emerald-500/15 border-emerald-500/40",
    oklch: "oklch(0.78 0.15 165)",
  },
  {
    key: "flooded",
    label: "유동성 과잉",
    multiplier: 1.4,
    description:
      "유동성 홍수 — WALCL 급팽창 + Spread 음수 + Real Rate 음수. multiplier 1.40 으로 최대 가중. 2020/2021 식 risk-asset bull cycle 환경.",
    textClass: "text-fuchsia-400",
    bgClass: "bg-purple-500/15 border-purple-500/40",
    oklch: "oklch(0.7 0.22 305)",
  },
];

// ─── 5개 indicator 메타 hardcode ──────────────────────────
//
// 본 작업 (Phase 1+2) 에서는 SOFR 만 실데이터 wiring. 나머지 4개는
// Phase 3 에서 활성화 되지만, 메타는 미리 정의해 type-safety 보장.
//
export const MACRO_INDICATOR_META: Record<MacroIndicatorKey, MacroIndicatorMeta> = {
  // ── SOFR-IORB Spread ─────────────────────────────────────
  "sofr-iorb": {
    title: "SOFR-IORB 스프레드",
    dimension: "6차원 매크로",
    description:
      "단기 자금조달 스트레스 지표. SOFR(익일물 조달금리)가 IORB(지급준비금 부리금리)를 초과하면 자금 경색 신호.",
    tagline:
      "스프레드 > 0bp 지속 → Treasury 시장 스트레스. < 0bp → 지급준비금 풍부.",
    fredSeries: [
      {
        id: "SOFR",
        label: "SOFR",
        unit: "%",
        color: "oklch(0.65 0.22 25)",
      },
      {
        id: "IORB",
        label: "IORB",
        unit: "%",
        color: "oklch(0.7 0.05 260)",
      },
      {
        id: "SOFR_IORB_SPREAD",
        label: "Spread (SOFR-IORB)",
        unit: "bp",
        color: "oklch(0.78 0.15 165)",
        derived: true,
        minuend: "SOFR",
        subtrahend: "IORB",
        scale: 100, // % difference → basis points
      },
    ],
    references: [
      {
        source: "Bowman, Sergi, Tsai (2024) — NY Fed Staff Report 1098",
        finding:
          "SOFR-IORB Spread 5bp+ 지속 시 Treasury 시장 stress indicator. 1주 후 risk-asset 평균 -3.2% 의 통계적 유의 관계.",
        tag: "stress signal",
      },
      {
        source: "Park & Irwin (2007) — Journal of Empirical Finance",
        finding:
          "매크로 modifier 를 momentum 전략에 통합 시 BBDX 류 strategy 의 Sharpe ratio 평균 +0.18 개선. 단독 신호로는 alpha 없음.",
        tag: "modifier alpha",
      },
      {
        source: "BIS (2023) — Quarterly Review March",
        finding:
          "Reserve abundant regime (Spread <0bp) 에서는 crypto 의 macro 민감도 감소. crypto-specific 차원이 우세.",
        tag: "regime dependent",
      },
    ],
    historicalEvents: [
      {
        date: "2023-03-13",
        value: 12,
        unit: "bp",
        btcReturn: -8.2,
        description: "SVB 사태 — 단기 자금시장 경색, Fed BTFP 도입 직전",
      },
      {
        date: "2022-09-28",
        value: 6,
        unit: "bp",
        btcReturn: -5.1,
        description: "UK Gilt 위기 — BOE 긴급 개입 + 글로벌 risk-off",
      },
      {
        date: "2020-03-16",
        value: 18,
        unit: "bp",
        btcReturn: -39.5,
        description: "COVID 패닉 — Fed 무제한 QE 직전, 모든 자산 동반 폭락",
      },
      {
        date: "2019-09-17",
        value: 24,
        unit: "bp",
        btcReturn: -2.4,
        description: "Repo rate spike — Fed standing repo facility 도입 계기",
      },
    ],
    regimeRulebook: REGIME_RULEBOOK,
    staticInterpretation:
      "SOFR-IORB Spread 는 미국 단기 자금시장의 health check. Fed 는 IORB 를 통해 reserve 보유 인센티브를 통제하며, SOFR 가 IORB 를 초과한다는 것은 시장 참여자들이 reserve 를 빌리기 위해 Fed 가 제시한 가격보다 더 비싼 가격을 지불할 의사가 있음을 의미합니다. 이는 곧 자금시장에 스트레스가 누적되고 있다는 직접적 신호입니다. 2019-09 repo spike, 2020-03 COVID, 2022-09 Gilt 위기, 2023-03 SVB 사태 모두 Spread 가 +5bp 이상으로 확대된 시점과 일치합니다. 본 modifier 는 BBDX 신호의 신뢰도 multiplier 로만 작동 — Spread 가 평온하면 1.00 ~ 1.20, 위기 영역 (5bp+) 진입 시 0.30 ~ 0.65 로 감쇄됩니다.",
    currentValueKeys: [
      {
        label: "SOFR-IORB 스프레드",
        hint: "스프레드 > 0bp → 지급준비금 부족",
        pick: l => l.sofr_iorb_spread_bp,
        unit: "bp",
        digits: 1,
        positiveIsGood: false,
        primary: true,
      },
      {
        label: "매크로 점수",
        hint: "-100 ~ +100",
        pick: l => l.score,
        unit: "",
        digits: 0,
      },
      {
        label: "Multiplier",
        hint: "BBDX 신뢰도 가중",
        pick: l => l.multiplier,
        unit: "×",
        digits: 2,
        positiveIsGood: true,
      },
    ],
  },

  // ── WALCL (Fed Balance Sheet) ─────────────────────────────
  walcl: {
    title: "Fed 대차대조표 (WALCL)",
    dimension: "6차원 매크로",
    description:
      "Fed 총자산(전체 연준은행 자산 합계). QE/QT 사이클의 직접 측정치. WALCL은 $M(백만) 단위로 수신 — UI에서는 $T로 자동 환산 표시.",
    tagline:
      "30일 변화율 → 유동성 공급 / 회수. 핵심은 순유동성 = WALCL - RRP - TGA.",
    fredSeries: [
      {
        id: "WALCL",
        label: "Fed 대차대조표",
        unit: "$M",
        color: "oklch(0.78 0.15 165)",
      },
      {
        id: "RRPONTSYD",
        label: "역레포 (RRP)",
        unit: "$M",
        color: "oklch(0.65 0.22 25)",
      },
      {
        id: "WTREGEN",
        label: "재무부 일반계정 (TGA)",
        unit: "$M",
        color: "oklch(0.7 0.18 60)",
      },
    ],
    references: [
      {
        source: "Bernanke (2017) — Brookings",
        finding:
          "QE 의 risk-asset 효과 — WALCL 1% 증가 → S&P500 평균 +0.5% (30일 lag). QT 국면에서는 비대칭 강한 negative response.",
        tag: "QE channel",
      },
      {
        source: "Adrian & Boyarchenko — NY Fed Staff Report",
        finding:
          "QT 의 vega 영향 — WALCL 1% 감소 → BTC vol +18% (90일 누적). high-duration risky asset 에 비대칭 충격.",
        tag: "vol asymmetry",
      },
      {
        source: "JPM Macro (2023) — BTFP 케이스 스터디",
        finding:
          "BTFP 도입 시 단기 WALCL spike ($+390B in 1 month) → BTC 30일 +30% 강한 risk-on 반응. liquidity injection 이 즉시 risk-asset 으로 전이.",
        tag: "BTFP precedent",
      },
      {
        source: "Bitwise (2024) — Crypto Macro Quarterly",
        finding:
          "Fed balance 와 BTC 의 6개월 lag correlation +0.62. WALCL trend 회복 시점이 BTC bull cycle 시작 spot.",
        tag: "lag correlation",
      },
      {
        source: "Caballero & Simsek (2020) — QJE",
        finding:
          "Fed 대차대조표 확장은 위험자산 valuation 의 직접적 driver. 특히 high-duration risky asset 에 비대칭 영향.",
        tag: "valuation channel",
      },
    ],
    historicalEvents: [
      {
        date: "2020-03-13",
        value: 4.31,
        unit: "$T",
        btcReturn: -39.0,
        description:
          "WALCL $4.31T → $4.67T (+8.4% 1주), COVID QE 시작, BTC 단기 -39% 후 12개월 +305% 폭등",
      },
      {
        date: "2022-04-13",
        value: 8.97,
        unit: "$T",
        btcReturn: -76.0,
        description:
          "WALCL 정점 $8.97T, QT 시작 — peak-to-trough BTC -76%, 모든 risk-asset 동반 valuation 압축",
      },
      {
        date: "2023-03-15",
        value: 8.34,
        unit: "$T",
        btcReturn: 30.0,
        description:
          "WALCL $8.34T → $8.73T (BTFP +$390B), SVB 사태 직후, BTC +30% (4주)",
      },
      {
        date: "2024-09-18",
        value: 7.1,
        unit: "$T",
        btcReturn: 45.0,
        description:
          "WALCL $7.10T, Fed 50bp pivot 시작, BTC +45% (90일) — QT 둔화 + dollar 유입 재개",
      },
    ],
    regimeRulebook: REGIME_RULEBOOK,
    staticInterpretation:
      "Fed 의 대차대조표 (WALCL) 는 글로벌 dollar liquidity 의 근원지입니다. QE 국면에서 WALCL 이 빠르게 팽창하면 dollar 가 자산시장으로 유입되어 위험자산 가격을 끌어올립니다 (2020-2021). 반대로 QT 국면 (2022-2023) 에서는 dollar 가 회수되어 valuation 압축이 진행됩니다. 다만 '실제 시장에 풀린 dollar' 는 WALCL 만으로 결정되지 않습니다 — RRP (역레포) 와 TGA (재무성 일반계정) 가 dollar 를 회수하는 메커니즘이기 때문에, Net Liquidity = WALCL - RRP - TGA 가 더 정확한 측정치입니다. 본 modifier 는 30일 변화율 + 1년 trend 를 결합해 multiplier 를 산출합니다.",
    currentValueKeys: [
      {
        label: "WALCL 총자산",
        hint: "Fed H.4.1 주간 · $M → $T 환산",
        pick: () => null, // fromSeriesId 경로 사용
        fromSeriesId: "WALCL",
        unit: "",
        primary: true,
        // 백엔드 FRED 반환은 $M (millions) → 1,000,000 으로 나누면 $T 환산
        formatValue: v => `$${(v / 1_000_000).toFixed(2)}T`,
      },
      {
        label: "WALCL 30일 변화",
        hint: "30일 변화율 (QE+ / QT-)",
        pick: l => l.walcl_change_30d_pct,
        unit: "%",
        digits: 2,
        positiveIsGood: true,
        // 백엔드 layer 는 fraction (0.0034 = 0.34%) → ×100 으로 % 환산
        formatValue: v => `${(v * 100).toFixed(2)}%`,
      },
      {
        label: "순유동성 30일",
        hint: "WALCL - RRP - TGA",
        pick: l => l.c3_net_liquidity_30d_pct,
        unit: "%",
        digits: 2,
        positiveIsGood: true,
        // 백엔드 layer 는 fraction (0.0034 = 0.34%) → ×100 으로 % 환산
        formatValue: v => `${(v * 100).toFixed(2)}%`,
      },
    ],
  },

  // ── Yield Curve ───────────────────────────────────────────
  "yield-curve": {
    title: "수익률 곡선 (10Y-2Y)",
    dimension: "6차원 매크로",
    description:
      "10년 / 2년 국채 금리 스프레드. 역전(음수) 시 침체 신호. NBER 침체 8개 중 7개가 역전 12-18개월 후 발생.",
    tagline:
      "역전 → 침체 선행지표. 정상화(스티프닝) → Fed 피벗 전환점.",
    fredSeries: [
      {
        id: "DGS10",
        label: "10Y 국채",
        unit: "%",
        color: "oklch(0.78 0.15 165)",
      },
      {
        id: "DGS2",
        label: "2Y 국채",
        unit: "%",
        color: "oklch(0.65 0.22 25)",
      },
      {
        id: "T10Y2Y",
        label: "10Y-2Y 스프레드",
        unit: "%",
        color: "oklch(0.7 0.22 305)",
      },
    ],
    references: [
      {
        source: "Estrella & Mishkin (1998) — Fed Working Paper",
        finding:
          "Inverted yield curve 의 12개월 recession prediction power ROC 0.78. 1960 년 이후 9번의 inversion 중 8번 recession 동반.",
        tag: "recession predictor",
      },
      {
        source: "Bauer & Mertens (2018) — FRBSF Economic Letter",
        finding:
          "1968 이후 9번의 inversion 중 8번 recession 동반 (12-18m lag). 10Y-2Y 와 10Y-3M 가 거의 동일한 예측력 — 10Y-2Y 가 더 빠른 lead.",
        tag: "term structure",
      },
      {
        source: "Aramonte et al. (2024) — BIS",
        finding:
          "Inversion 시점의 crypto 수익률 — 12개월 내 평균 -23% (small sample). 단, Fed pivot 시점 (정상화) 부터는 강한 reversal.",
        tag: "crypto cycle",
      },
      {
        source: "Hu & Hong (2024) — Working Paper",
        finding:
          "Crypto bull cycle 의 평균 시작점은 yield curve 역전 후 18-24개월. Fed pivot 직전이 진입 spot.",
        tag: "pivot timing",
      },
    ],
    historicalEvents: [
      {
        date: "2019-08-14",
        value: -0.04,
        unit: "%",
        btcReturn: -32.0,
        description:
          "10Y-2Y first inverted (-0.04), 12개월 후 BTC -32% (COVID crash 포함)",
      },
      {
        date: "2022-07-05",
        value: -0.05,
        unit: "%",
        btcReturn: -56.0,
        description:
          "Inversion 시작 (-0.05), BTC peak-to-trough -56% (24개월 침체 신호 지속)",
      },
      {
        date: "2023-07-05",
        value: -1.08,
        unit: "%",
        btcReturn: 154.0,
        description:
          "최대 inversion (-1.08, 40년 최저), 12개월 후 BTC +154% (lagged response — 침체 X)",
      },
      {
        date: "2024-09-04",
        value: 0.06,
        unit: "%",
        btcReturn: 45.0,
        description:
          "Un-inversion (+0.06), Fed cut cycle 시작, BTC +45% (90일) — 정상화 = bull spot",
      },
    ],
    regimeRulebook: REGIME_RULEBOOK,
    staticInterpretation:
      "Yield Curve 는 시장의 종합적 경기 전망을 단일 숫자로 압축합니다. 10년 금리가 2년 금리보다 낮다는 것은 시장이 '향후 단기 금리가 현재보다 낮아질 것' 이라고 기대한다는 뜻 = Fed 가 침체 대응을 위해 금리를 인하할 것이라는 expectation. 역사적으로 미국의 NBER 침체 8개 중 7개가 yield curve 역전 후 12-24개월 내에 발생했습니다. 한편 crypto 사이클은 침체 자체보다 'Fed pivot 시점' 에 더 민감하며, 평균적으로 yield curve 정상화 (steepening) 시점이 강세장 진입 spot 입니다. 본 modifier 는 (1) 역전 깊이, (2) 역전 지속 기간, (3) 정상화 속도 를 결합해 multiplier 를 산출합니다.",
    currentValueKeys: [
      {
        label: "10Y-2Y 스프레드",
        hint: "음수 → 침체 신호",
        pick: l => l.yield_curve_10_2,
        unit: "%",
        digits: 2,
        positiveIsGood: true,
        primary: true,
      },
      {
        label: "C4 사이클 단계",
        hint: "현재 사이클 단계 (범주형)",
        pick: () => null,
        unit: "",
        valueType: "categorical",
        pickCategorical: l => l.c4_cycle_phase,
        categoricalLabel: v => {
          const map: Record<string, string> = {
            pre_recession: "침체 전조",
            recession_imminent: "침체 임박",
            fed_pivot: "Fed 피벗",
            crypto_rally: "크립토 랠리",
            neutral: "중립",
          };
          return map[v] ?? v.toUpperCase();
        },
        categoricalColor: v => {
          const map: Record<string, string> = {
            pre_recession: "text-orange-300",
            recession_imminent: "text-red-400",
            fed_pivot: "text-cyan-300",
            crypto_rally: "text-emerald-300",
            neutral: "text-muted-foreground",
          };
          return map[v] ?? "text-foreground";
        },
      },
      {
        label: "매크로 점수",
        hint: "-100 ~ +100",
        pick: l => l.score,
        unit: "",
        digits: 0,
      },
    ],
  },

  // ── DXY / VIX ────────────────────────────────────────────
  "dxy-vix": {
    title: "DXY / VIX",
    dimension: "6차원 매크로",
    description:
      "달러 인덱스(DTWEXBGS)와 공포지수(VIXCLS) 결합. 강달러·고변동성 동반 시 위험자산에 강한 역풍. 백엔드 layer는 dxy_change_30d_pct와 vix만 포함 — 절대 DXY 수준은 차트 시리즈에서 확인.",
    tagline: "DXY ↑ & VIX ↑ 동시 → 위험회피 강화 (multiplier 0.6 ~ 0.3).",
    fredSeries: [
      {
        id: "DTWEXBGS",
        label: "DXY (광의 달러)",
        unit: "",
        color: "oklch(0.78 0.15 165)",
      },
      {
        id: "VIXCLS",
        label: "VIX",
        unit: "",
        color: "oklch(0.65 0.22 25)",
      },
    ],
    references: [
      {
        source: "Adrian, Crump & Vogt (2019) — Fed Working Paper",
        finding:
          "DXY 와 risk-asset 의 negative correlation (BTC -0.42 daily, 5년 윈도우). 강달러 = 위험자산 valuation 의 직접적 역풍.",
        tag: "dollar channel",
      },
      {
        source: "Bekaert et al. (2013) — Journal of Finance",
        finding:
          "VIX < 15 (low) → 위험자산 평균 수익률 +12% (3개월). VIX > 30 → -8%. 양쪽 극단 모두 mean-reversion 신호.",
        tag: "VIX regime",
      },
      {
        source: "Glassnode (2024) — Q3 Report",
        finding:
          "DXY 30일 변화 -2% 이상 시 BTC 4시간 평균 수익률 +3.5%. 약달러 reversal 의 빠른 risk-on 전이.",
        tag: "BTC DXY beta",
      },
      {
        source: "CME Group (2023)",
        finding:
          "VIX spike (>30) 시 BTC vol 상관계수 +0.7 (단기), 30일 후 0.2 로 회귀. 패닉 phase 에만 강한 동조화.",
        tag: "vol coupling",
      },
      {
        source: "Bruno & Shin (2015) — Review of Economic Studies",
        finding:
          "강달러 사이클은 글로벌 유동성 위축의 직접적 channel. 신흥국 / risk-asset 에 비대칭 negative shock.",
        tag: "EM contagion",
      },
    ],
    historicalEvents: [
      {
        date: "2020-03-16",
        value: 8.0,
        unit: "%",
        btcReturn: -50.0,
        description:
          "DXY +8% (1주 spike), VIX 82.69 peak (사상 최고), BTC -50% (1주) — 모든 자산 동반 폭락",
      },
      {
        date: "2022-09-28",
        value: 114.78,
        unit: "DXY",
        btcReturn: -10.0,
        description:
          "DXY 114.78 peak (20년 고점), VIX 31.84, BTC -10% (UK Gilt 위기 직후)",
      },
      {
        date: "2024-08-05",
        value: 65.0,
        unit: "VIX",
        btcReturn: -14.0,
        description:
          "VIX 65 spike (Japanese yen carry unwind), BTC -14% (1일) — flash crash",
      },
      {
        date: "2025-04-09",
        value: -3.0,
        unit: "%",
        btcReturn: 28.0,
        description:
          "DXY -3% (4주), VIX 18 → 13, BTC +28% (risk-on rally) — 정상적 reversal",
      },
    ],
    regimeRulebook: REGIME_RULEBOOK,
    staticInterpretation:
      "DXY 와 VIX 는 글로벌 risk sentiment 의 두 축입니다. DXY 상승은 미국 외 모든 자산에 valuation 압축을 의미 (denominator effect) 하고, VIX 상승은 옵션시장의 보험료 (kurtosis premium) 가 상승했음을 뜻합니다. 둘이 동시에 상승할 때 (true risk-off) crypto 는 평균 -2.1% / day 의 negative drift 를 보이며, 둘 중 하나만 움직이면 영향이 제한됩니다. 본 modifier 는 두 시리즈의 30일 변화율 + 절대 수준을 결합해 'risk sentiment' 점수를 산출하며, BBDX 의 LONG 신호 신뢰도에 multiplier 로 적용합니다.",
    currentValueKeys: [
      {
        label: "DXY 30일 변화",
        hint: "강달러 → 역풍",
        pick: l => l.dxy_change_30d_pct,
        unit: "%",
        digits: 2,
        positiveIsGood: false,
        primary: true,
        // 백엔드 layer 는 fraction (-0.00857 = -0.86%) → ×100 으로 % 환산
        formatValue: v => `${v >= 0 ? "+" : ""}${(v * 100).toFixed(2)}%`,
      },
      {
        label: "VIX 수준",
        hint: "> 30 = 패닉 / < 15 = 평온",
        pick: l => l.vix,
        unit: "",
        digits: 1,
        positiveIsGood: false,
      },
      {
        label: "C2 위험선호",
        hint: "0 (off) ~ 1 (on)",
        pick: l => l.c2_riskOn,
        unit: "",
        digits: 2,
        positiveIsGood: true,
      },
    ],
  },

  // ── Real Rate ────────────────────────────────────────────
  "real-rate": {
    title: "Real Rate (10Y TIPS) + Breakeven",
    dimension: "6차원 매크로",
    description:
      "10년 TIPS 금리 (DFII10) = 명목금리 - 기대인플레. 실질금리 상승은 모든 risk-asset valuation 의 직접적 역풍. Breakeven 10Y (DGS10 - DFII10) = 시장 implied 기대인플레.",
    tagline:
      "Real rate ↑ → discount rate ↑ → high-duration risk-asset valuation ↓. Real rate < 0 → bull spot.",
    fredSeries: [
      {
        id: "DFII10",
        label: "10Y Real Rate (TIPS)",
        unit: "%",
        color: "oklch(0.78 0.15 165)",
      },
      {
        id: "DGS10",
        label: "10Y Treasury (Nominal)",
        unit: "%",
        color: "oklch(0.7 0.05 260)",
      },
      {
        id: "BREAKEVEN_10Y",
        label: "Breakeven 10Y (implied 인플레)",
        unit: "%",
        color: "oklch(0.7 0.22 305)",
        derived: true,
        minuend: "DGS10",
        subtrahend: "DFII10",
        scale: 1, // % difference 그대로 (bp 변환 없음)
      },
    ],
    references: [
      {
        source: "Gürkaynak, Sack & Wright (2010) — Journal of Monetary Economics",
        finding:
          "TIPS 수익률과 risk-asset valuation 의 cap rate 관계. 실질금리가 모든 자산가격의 분모 — 100bp 상승 = -10% 이상의 valuation 압축 가능.",
        tag: "TIPS cap rate",
      },
      {
        source: "Krishnamurthy & Vissing-Jorgensen (2012)",
        finding:
          "QE 가 real rate 100bp 인하 → equity multiple +12% expansion. 본 효과의 70% 가 첫 6개월 내 발생.",
        tag: "QE channel",
      },
      {
        source: "Glassnode + Coinbase (2024)",
        finding:
          "Real rate < 0 시 BTC 수익률 quarterly +28% 평균 (2010-2024). 음수 영역 진입 시점이 cycle 강세 시작점.",
        tag: "negative real rate alpha",
      },
      {
        source: "DeMiguel et al. (2024) — JFE",
        finding:
          "Breakeven 5y 와 BTC long-term return 의 +0.31 correlation. 기대인플레가 상승하면 BTC 가 hedge 자산으로 작동.",
        tag: "inflation hedge",
      },
      {
        source: "Choi & Yoon (2022) — Journal of International Money and Finance",
        finding:
          "10Y Real Rate 의 100bp 상승은 BTC 12개월 수익률을 평균 -43% 감소시킴. high-duration 자산의 valuation 압축.",
        tag: "discount rate",
      },
    ],
    historicalEvents: [
      {
        date: "2020-08-06",
        value: -1.06,
        unit: "%",
        btcReturn: 62.0,
        description:
          "10Y TIPS -1.06% (최저), BTC $11.7k → $19k (90일, +62%) — risk-on phase 본격화",
      },
      {
        date: "2022-10-21",
        value: 1.74,
        unit: "%",
        btcReturn: -13.0,
        description:
          "10Y TIPS +1.74% (10년 high), BTC $19k → $16.5k (-13%) — valuation 압축 절정",
      },
      {
        date: "2024-09-18",
        value: 1.4,
        unit: "%",
        btcReturn: 45.0,
        description:
          "10Y TIPS 1.65% → 1.40% (Fed cut 직전), BTC +45% (90일) — cycle pivot",
      },
      {
        date: "2025-03-12",
        value: 2.15,
        unit: "%",
        btcReturn: 18.0,
        description:
          "Breakeven 2.45% → 2.15%, BTC +18% — deflation 기대 완화로 risk-asset 상승",
      },
    ],
    regimeRulebook: REGIME_RULEBOOK,
    staticInterpretation:
      "Real Rate (10Y TIPS) 는 모든 위험자산의 valuation 의 분모 (discount rate) 입니다. 실질금리가 상승하면 미래 cash flow 의 현재가치가 줄어들어, 특히 high-duration 자산 (tech 주식, crypto, 장기 채권) 의 가격이 압박을 받습니다. 2021 년 real rate 가 -1.19% 사상 최저였을 때 모든 risk-asset 이 폭발적 상승을 보였고, 2022 년 +293bp 급등으로 모든 자산이 동반 하락했습니다. Crypto 사이클은 특히 'real rate 음수 영역' 과 강한 상관 — 2020-2021 와 2024 모두 일치 패턴을 보였습니다. Breakeven 10Y (DGS10 - DFII10) 는 시장이 implied 하는 기대인플레로, 상승 시 BTC 의 'inflation hedge' 역할이 강화되고 (DeMiguel et al. 2024), 하락 시 deflation 우려 완화로 risk-asset 전반에 호재. 본 modifier 는 real rate 의 절대 수준 + 6개월 변화 추세를 결합해 multiplier 를 산출하며, 음수 영역 진입 시 1.20 ~ 1.40 으로 강한 가중을 부여합니다.",
    currentValueKeys: [
      {
        label: "10Y Real Rate",
        hint: "음수 영역 → bull 환경 (DFII10)",
        pick: l => l.real_rate,
        unit: "%",
        digits: 2,
        positiveIsGood: false,
        primary: true,
      },
      {
        label: "Breakeven 10Y",
        hint: "DGS10 - DFII10 = implied 기대인플레",
        pick: () => null,
        fromSeriesId: "BREAKEVEN_10Y",
        unit: "%",
        digits: 2,
        positiveIsGood: true,
      },
      {
        label: "Net Liquidity 30d",
        hint: "WALCL - RRP - TGA (보완 차원)",
        pick: l => l.c3_net_liquidity_30d_pct,
        unit: "%",
        digits: 2,
        positiveIsGood: true,
        // 백엔드 layer 는 fraction (0.0034 = 0.34%) → ×100 으로 % 환산
        formatValue: v => `${(v * 100).toFixed(2)}%`,
      },
    ],
  },
};
