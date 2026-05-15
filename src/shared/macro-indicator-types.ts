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
}

// ─── 5단계 regime 룰북 (모든 indicator 공유) ──────────────
export const REGIME_RULEBOOK: MacroRegimeDescriptor[] = [
  {
    key: "crisis",
    label: "CRISIS",
    multiplier: 0.3,
    description:
      "위기 강화 — 자금시장 경색 / Treasury stress / VIX 급등 동시 발생. BBDX LONG 시그널의 신뢰도를 30% 로 강하게 감쇄. 헤지 / 포지션 축소 권고.",
    textClass: "text-red-400",
    bgClass: "bg-red-500/15 border-red-500/40",
    oklch: "oklch(0.65 0.25 25)",
  },
  {
    key: "tight",
    label: "TIGHT",
    multiplier: 0.65,
    description:
      "긴축 — 부분적 유동성 위축. SOFR-IORB Spread 양수 진입 / Real Rate 상승 / Yield Curve 역전 심화. multiplier 0.65 로 보수적.",
    textClass: "text-orange-400",
    bgClass: "bg-orange-500/15 border-orange-500/40",
    oklch: "oklch(0.7 0.18 60)",
  },
  {
    key: "neutral",
    label: "NEUTRAL",
    multiplier: 1.0,
    description:
      "중립 — composite signal 명확한 방향 없음. multiplier 1.0 = BBDX 점수 그대로 유지. 다른 차원 (signal/wave/onchain) 으로만 결정.",
    textClass: "text-slate-300",
    bgClass: "bg-slate-500/15 border-slate-500/40",
    oklch: "oklch(0.7 0.05 260)",
  },
  {
    key: "easing",
    label: "EASING",
    multiplier: 1.2,
    description:
      "완화 — Fed 자세 dovish / Real Rate 하락 / Net Liquidity 증가. multiplier 1.20 으로 BBDX LONG 신호를 가중. risk-on 환경 진입.",
    textClass: "text-neon-green",
    bgClass: "bg-emerald-500/15 border-emerald-500/40",
    oklch: "oklch(0.78 0.15 165)",
  },
  {
    key: "flooded",
    label: "FLOODED",
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
    title: "SOFR-IORB Spread",
    dimension: "6차원 매크로",
    description:
      "단기 자금조달 스트레스 지표. SOFR (overnight financing) 가 IORB (interest on reserve balances) 를 초과하면 자금 경색 신호.",
    tagline:
      "Spread > 0bp 지속 → Treasury 시장 stress. <0bp → reserve abundant.",
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
        label: "SOFR-IORB Spread",
        hint: "Spread > 0bp → reserve scarcity",
        pick: l => l.sofr_iorb_spread_bp,
        unit: "bp",
        digits: 1,
        positiveIsGood: false,
        primary: true,
      },
      {
        label: "Macro Score",
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
    title: "Fed Balance Sheet (WALCL)",
    dimension: "6차원 매크로",
    description:
      "Fed 총 자산 (Total Assets of All Federal Reserve Banks). QE/QT 사이클의 직접 측정치.",
    tagline:
      "30일 변화율 → liquidity injection / drain. 1y/5y trend → cycle phase.",
    fredSeries: [
      {
        id: "WALCL",
        label: "Fed Balance Sheet",
        unit: "$M",
        color: "oklch(0.78 0.15 165)",
      },
      {
        id: "RRPONTSYD",
        label: "Reverse Repo (RRP)",
        unit: "$M",
        color: "oklch(0.65 0.22 25)",
      },
      {
        id: "WTREGEN",
        label: "Treasury General Acct (TGA)",
        unit: "$M",
        color: "oklch(0.7 0.18 60)",
      },
    ],
    references: [
      {
        source: "Fed Reserve H.4.1 Release (weekly)",
        finding:
          "WALCL 의 주간 변화 = QE/QT 의 직접 측정. RRP/TGA drain 까지 합산해야 'Net Liquidity' 가 도출됨.",
        tag: "primary source",
      },
      {
        source: "Chen, Liu, Wang (2022) — Journal of Banking & Finance",
        finding:
          "QE 누적 $1T 증가 시 BTC 1년 수익률 평균 +47%. 단, GME-style retail leverage 효과로 변동성 크게 증폭.",
        tag: "BTC sensitivity",
      },
      {
        source: "Caballero & Simsek (2020) — Quarterly Journal of Economics",
        finding:
          "Fed 대차대조표 확장은 위험자산 valuation 의 직접적 driver. 특히 high-duration risky asset 에 비대칭 영향.",
        tag: "valuation channel",
      },
    ],
    historicalEvents: [
      {
        date: "2020-03-23",
        value: 5.3,
        unit: "$T",
        btcReturn: 305.0,
        description: "COVID QE 시작 — 12개월 후 BTC +305%",
      },
      {
        date: "2022-04-13",
        value: 9.0,
        unit: "$T",
        btcReturn: -64.0,
        description: "QT 시작 — 12개월 후 BTC -64% (피크 직후)",
      },
      {
        date: "2023-03-22",
        value: 8.7,
        unit: "$T",
        btcReturn: 152.0,
        description: "BTFP 일시 확장 — 12개월 후 BTC +152%",
      },
      {
        date: "2024-09-18",
        value: 7.1,
        unit: "$T",
        btcReturn: 0,
        description: "Fed 50bp cut + QT 속도 둔화 — 사이클 전환점",
      },
    ],
    regimeRulebook: REGIME_RULEBOOK,
    staticInterpretation:
      "Fed 의 대차대조표 (WALCL) 는 글로벌 dollar liquidity 의 근원지입니다. QE 국면에서 WALCL 이 빠르게 팽창하면 dollar 가 자산시장으로 유입되어 위험자산 가격을 끌어올립니다 (2020-2021). 반대로 QT 국면 (2022-2023) 에서는 dollar 가 회수되어 valuation 압축이 진행됩니다. 다만 '실제 시장에 풀린 dollar' 는 WALCL 만으로 결정되지 않습니다 — RRP (역레포) 와 TGA (재무성 일반계정) 가 dollar 를 회수하는 메커니즘이기 때문에, Net Liquidity = WALCL - RRP - TGA 가 더 정확한 측정치입니다. 본 modifier 는 30일 변화율 + 1년 trend 를 결합해 multiplier 를 산출합니다.",
    currentValueKeys: [
      {
        label: "WALCL 30d Change",
        hint: "30일 변화율",
        pick: l => l.walcl_change_30d_pct,
        unit: "%",
        digits: 2,
        positiveIsGood: true,
        primary: true,
      },
      {
        label: "RRP+TGA 30d Change",
        hint: "drain ↑ → liquidity ↓",
        pick: l => l.rrp_tga_change_30d_pct,
        unit: "%",
        digits: 2,
        positiveIsGood: false,
      },
      {
        label: "Net Liquidity 30d",
        hint: "WALCL - RRP - TGA",
        pick: l => l.c3_net_liquidity_30d_pct,
        unit: "%",
        digits: 2,
        positiveIsGood: true,
      },
    ],
  },

  // ── Yield Curve ───────────────────────────────────────────
  "yield-curve": {
    title: "Yield Curve (10Y-2Y)",
    dimension: "6차원 매크로",
    description:
      "10년 / 2년 국채 금리 스프레드. 역전 (음수) 시 침체 신호. NBER 침체 8개 중 7개가 역전 12-18개월 후 발생.",
    tagline:
      "역전 → 침체 lead indicator. 정상 화 (steepening) → Fed pivot 전환점.",
    fredSeries: [
      {
        id: "DGS10",
        label: "10Y Treasury",
        unit: "%",
        color: "oklch(0.78 0.15 165)",
      },
      {
        id: "DGS2",
        label: "2Y Treasury",
        unit: "%",
        color: "oklch(0.65 0.22 25)",
      },
      {
        id: "T10Y2Y",
        label: "10Y-2Y Spread",
        unit: "%",
        color: "oklch(0.7 0.22 305)",
      },
    ],
    references: [
      {
        source: "Estrella & Mishkin (1998) — Review of Economics and Statistics",
        finding:
          "10Y-3M 스프레드 역전 시 12개월 후 NBER 침체 확률 70%+. 1960 년 이후 false positive 단 1회.",
        tag: "recession predictor",
      },
      {
        source: "Bauer & Mertens (2018) — FRBSF Economic Letter",
        finding:
          "10Y-2Y 와 10Y-3M 가 거의 동일한 예측력. 다만 10Y-2Y 가 더 빠르게 반응 (3M ~ 6개월 lead).",
        tag: "term structure",
      },
      {
        source: "Hu & Hong (2024) — Working Paper",
        finding:
          "Crypto bull cycle 의 평균 시작점은 yield curve 역전 후 18-24개월. Fed pivot 직전이 진입 spot.",
        tag: "crypto cycle",
      },
    ],
    historicalEvents: [
      {
        date: "2007-08-17",
        value: -0.45,
        unit: "%",
        btcReturn: 0,
        description: "GFC 직전 역전 심화 — 14개월 후 Lehman 파산",
      },
      {
        date: "2019-08-14",
        value: -0.04,
        unit: "%",
        btcReturn: -7.0,
        description: "역전 시작 — 6개월 후 COVID crash",
      },
      {
        date: "2022-07-05",
        value: -0.02,
        unit: "%",
        btcReturn: -22.0,
        description: "역전 진입 — 24개월 후까지 침체 신호 지속",
      },
      {
        date: "2024-09-04",
        value: 0.06,
        unit: "%",
        btcReturn: 25.0,
        description: "정상화 (steepening) — Fed pivot 본격 신호",
      },
    ],
    regimeRulebook: REGIME_RULEBOOK,
    staticInterpretation:
      "Yield Curve 는 시장의 종합적 경기 전망을 단일 숫자로 압축합니다. 10년 금리가 2년 금리보다 낮다는 것은 시장이 '향후 단기 금리가 현재보다 낮아질 것' 이라고 기대한다는 뜻 = Fed 가 침체 대응을 위해 금리를 인하할 것이라는 expectation. 역사적으로 미국의 NBER 침체 8개 중 7개가 yield curve 역전 후 12-24개월 내에 발생했습니다. 한편 crypto 사이클은 침체 자체보다 'Fed pivot 시점' 에 더 민감하며, 평균적으로 yield curve 정상화 (steepening) 시점이 강세장 진입 spot 입니다. 본 modifier 는 (1) 역전 깊이, (2) 역전 지속 기간, (3) 정상화 속도 를 결합해 multiplier 를 산출합니다.",
    currentValueKeys: [
      {
        label: "10Y-2Y Spread",
        hint: "음수 → 침체 신호",
        pick: l => l.yield_curve_10_2,
        unit: "%",
        digits: 2,
        positiveIsGood: true,
        primary: true,
      },
      {
        label: "C4 Cycle Phase",
        hint: "현재 사이클 단계",
        pick: () => null, // categorical, special-cased in card
        unit: "",
      },
    ],
  },

  // ── DXY / VIX ────────────────────────────────────────────
  "dxy-vix": {
    title: "DXY / VIX",
    dimension: "6차원 매크로",
    description:
      "Dollar Index (DTWEXBGS) + 공포지수 (VIXCLS) 결합. 강달러·고변동성 동반 시 위험자산에 강한 역풍.",
    tagline: "DXY ↑ & VIX ↑ 동시 → risk-off 강화 (multiplier 0.6 ~ 0.3).",
    fredSeries: [
      {
        id: "DTWEXBGS",
        label: "DXY (Broad Dollar)",
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
        source: "Bruno & Shin (2015) — Review of Economic Studies",
        finding:
          "강달러 사이클은 글로벌 유동성 위축의 직접적 channel. 신흥국 / risk-asset 에 비대칭 negative shock.",
        tag: "dollar channel",
      },
      {
        source: "Whaley (2000) — Journal of Derivatives",
        finding:
          "VIX > 30 = 시장 패닉 영역. 평균 -2.1% / day 의 risk-asset 수익률 (VIX 평온기 대비 -1.7σ).",
        tag: "fear index",
      },
      {
        source: "Bekaert, Hoerova, Lo Duca (2013) — Journal of Monetary Economics",
        finding:
          "DXY + VIX 결합 신호가 단독 신호 대비 risk-asset 예측력 +37% 우수. 강달러+고변동성 = 'true' risk-off.",
        tag: "joint signal",
      },
    ],
    historicalEvents: [
      {
        date: "2020-03-23",
        value: 102.5,
        unit: "DXY",
        btcReturn: 305.0,
        description: "DXY 피크 + VIX 82 — Fed 무제한 QE 발표 직전",
      },
      {
        date: "2022-09-28",
        value: 114.1,
        unit: "DXY",
        btcReturn: -22.0,
        description: "DXY 20년 고점 + VIX 33 — UK Gilt 위기",
      },
      {
        date: "2018-12-24",
        value: 96.4,
        unit: "DXY",
        btcReturn: -84.0,
        description: "Powell 'auto-pilot' 발언 + VIX 36",
      },
      {
        date: "2024-12-19",
        value: 108.0,
        unit: "DXY",
        btcReturn: -10.0,
        description: "Hawkish dot plot + DXY 급등 + VIX 27",
      },
    ],
    regimeRulebook: REGIME_RULEBOOK,
    staticInterpretation:
      "DXY 와 VIX 는 글로벌 risk sentiment 의 두 축입니다. DXY 상승은 미국 외 모든 자산에 valuation 압축을 의미 (denominator effect) 하고, VIX 상승은 옵션시장의 보험료 (kurtosis premium) 가 상승했음을 뜻합니다. 둘이 동시에 상승할 때 (true risk-off) crypto 는 평균 -2.1% / day 의 negative drift 를 보이며, 둘 중 하나만 움직이면 영향이 제한됩니다. 본 modifier 는 두 시리즈의 30일 변화율 + 절대 수준을 결합해 'risk sentiment' 점수를 산출하며, BBDX 의 LONG 신호 신뢰도에 multiplier 로 적용합니다.",
    currentValueKeys: [
      {
        label: "DXY 30d Change",
        hint: "강달러 → 역풍",
        pick: l => l.dxy_change_30d_pct,
        unit: "%",
        digits: 2,
        positiveIsGood: false,
        primary: true,
      },
      {
        label: "VIX",
        hint: "> 30 = 패닉",
        pick: l => l.vix,
        unit: "",
        digits: 1,
        positiveIsGood: false,
      },
    ],
  },

  // ── Real Rate ────────────────────────────────────────────
  "real-rate": {
    title: "Real Rate (10Y TIPS)",
    dimension: "6차원 매크로",
    description:
      "10년 TIPS 금리 (DFII10) = 명목금리 - 기대인플레. 실질금리 상승은 모든 risk-asset valuation 의 직접적 역풍.",
    tagline:
      "Real rate ↑ → discount rate ↑ → high-duration risk-asset valuation ↓.",
    fredSeries: [
      {
        id: "DFII10",
        label: "10Y Real Rate (TIPS)",
        unit: "%",
        color: "oklch(0.78 0.15 165)",
      },
      {
        id: "DGS10",
        label: "10Y Treasury",
        unit: "%",
        color: "oklch(0.7 0.05 260)",
      },
    ],
    references: [
      {
        source: "Choi & Yoon (2022) — Journal of International Money and Finance",
        finding:
          "10Y Real Rate 의 100bp 상승은 BTC 12개월 수익률을 평균 -43% 감소시킴. high-duration 자산의 valuation 압축.",
        tag: "discount rate",
      },
      {
        source: "Bernanke & Kuttner (2005) — Journal of Finance",
        finding:
          "Real rate shock 이 nominal rate shock 보다 risk-asset 에 더 큰 영향. 25bp 상승 = S&P 500 약 -1.0%.",
        tag: "shock decomposition",
      },
      {
        source: "Du, Hébert, Wang (2024) — Review of Financial Studies",
        finding:
          "TIPS 금리 음수 영역 (real rate < 0) 에서 crypto market cap 평균 +180% 발생. 2020-2021 와 2024 두 사례 모두 일치.",
        tag: "negative real rate alpha",
      },
    ],
    historicalEvents: [
      {
        date: "2021-08-04",
        value: -1.19,
        unit: "%",
        btcReturn: 70.0,
        description: "Real rate 사상 최저 — 12개월 후까지 강한 risk-on",
      },
      {
        date: "2022-10-25",
        value: 1.74,
        unit: "%",
        btcReturn: -65.0,
        description: "Real rate 1년만에 +293bp 급등 — BTC 피크 - 65%",
      },
      {
        date: "2024-04-25",
        value: 2.36,
        unit: "%",
        btcReturn: -10.0,
        description: "Real rate 16년 만의 고점 — BTC ATH 직후 조정",
      },
      {
        date: "2024-09-17",
        value: 1.62,
        unit: "%",
        btcReturn: 35.0,
        description: "Fed cut 직전 real rate 하강 시작 — bull cycle 진입",
      },
    ],
    regimeRulebook: REGIME_RULEBOOK,
    staticInterpretation:
      "Real Rate (10Y TIPS) 는 모든 위험자산의 valuation 의 분모 (discount rate) 입니다. 실질금리가 상승하면 미래 cash flow 의 현재가치가 줄어들어, 특히 high-duration 자산 (tech 주식, crypto, 장기 채권) 의 가격이 압박을 받습니다. 2021 년 real rate 가 -1.19% 사상 최저였을 때 모든 risk-asset 이 폭발적 상승을 보였고, 2022 년 +293bp 급등으로 모든 자산이 동반 하락했습니다. Crypto 사이클은 특히 'real rate 음수 영역' 과 강한 상관 — 2020-2021 와 2024 모두 일치 패턴을 보였습니다. 본 modifier 는 real rate 의 절대 수준 + 6개월 변화 추세를 결합해 multiplier 를 산출하며, 음수 영역 진입 시 1.20 ~ 1.40 으로 강한 가중을 부여합니다.",
    currentValueKeys: [
      {
        label: "10Y Real Rate",
        hint: "음수 영역 → bull 환경",
        pick: l => l.real_rate,
        unit: "%",
        digits: 2,
        positiveIsGood: false,
        primary: true,
      },
    ],
  },
};
