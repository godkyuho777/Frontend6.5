# Macro Liquidity Tracker — 5개 페이지 활성화 (Phase 1~5)

> **영역**: `src/components/macro/`, `src/hooks/useMacroIndicator.ts`,
> `src/shared/macro-indicator-types.ts`, `src/pages/macro/*.tsx`
>
> **commits**: 8894c33 (Phase 1) → dda8d6e (hook + 타입) → b12d881 (Phase 2)
> → e9850b2 (cards 확장) → 818325a (3a WALCL) → 96cf2e5 (3b Yield) →
> 19cc122 (3c DXY/VIX) → bf16e1e (3d Real Rate) → ff11f84 (Phase 4 fix) →
> 2ef9acb (Phase 5 fix)
>
> **총 9 commits + 1 후속 fix**

5/15 ~ 5/16 의 가장 큰 작업. 기존 5개 detail 페이지가 모두 13줄 placeholder
("WIP — Phase 1") 였던 상태를, 공통 컴포넌트 + hook + 메타 hardcode + 5개
페이지 wiring + FRED_API_KEY 등록 후 시각 검증까지 완료.

---

## 사용자 의도 정확히 반영

> "Macro Liquidity Tracker 5개 페이지가 모두 placeholder 인데, 단순한 차트
> 보다는 학술 레퍼런스 + 역사적 사례 + 현재 regime 의 BBDX 영향을 한 화면에
> 한국어로 친절하게 설명하는 페이지였으면 좋겠다."

→ MacroIndicatorPage 골격으로 통일하고, 모든 페이지가 자동으로 8개 sub-section
표시 (Header / Stub 안내 / CurrentValues / Chart / Regime / Interpretation /
BbdxImpact / Charter Footer).

→ Interpretation 컴포넌트가 6단계 (요약 / regime / composite / 학술 ref /
역사적 사례 / BBDX 영향 / 다음 시나리오) 동적 분석 + 각 indicator 별 학술
ref 3-5건 + 역사적 사례 4건 hardcode.

---

## Phase 1 — 공통 인프라 (commits 8894c33 + dda8d6e)

### 1.1 신규 컴포넌트 8개 (`src/components/macro/`)

| 컴포넌트 | LOC | 역할 |
|---|---|---|
| `MacroIndicatorPage.tsx` | 199 | 5 페이지 공통 골격 — Header + Stub 안내 + CurrentValues + Chart + Regime + Interpretation + BbdxImpact + Charter |
| `MacroCurrentValueCards.tsx` | 143 (확장 후 ~250) | 3 카드 표시 — primary + 보완 + 보완 |
| `MacroTimeSeriesChart.tsx` | 270 | Recharts area + line + 다중 시리즈 토글 + 30D/90D/1Y/5Y 셀렉터 + 0 라인 옵션 |
| `MacroRegimeCard.tsx` | 148 | 5단계 regime + multiplier + freshness + 룰북 미니표 |
| **`MacroInterpretation.tsx`** ⭐ | 379 | 6단계 동적 분석 + 학술 ref 인용 + 역사적 사례 + BBDX 시뮬레이션 |
| `MacroBbdxImpactCard.tsx` | 204 | base × multiplier 곱셈 체인 + 5단계 regime 시뮬레이터 |
| `MacroStatusBadge.tsx` | 61 | LIVE / STALE / STUB / ERROR / LOADING 통일 |

### 1.2 신규 hook — `useMacroIndicator.ts` (332 LOC)

```ts
function useMacroIndicator(indicatorId: MacroIndicatorId): MacroIndicatorState {
  const snapshot = trpc.macroV2.snapshot.useQuery({ indicator: indicatorId });
  const history  = trpc.macroV2.history.useQuery({ indicator: indicatorId, period: "1Y" });
  return {
    status,            // "loading" | "stub" | "live" | "stale" | "error"
    layer,             // 백엔드 layer 응답
    fredSeries,        // raw FRED 시리즈 (snapshot 별도 시리즈)
    chartData,         // 다중 시리즈 align + derived (SOFR-IORB spread 등)
    multiplier,        // regime → multiplier 매핑
  };
}
```

**핵심 로직**:
- trpc.macroV2.snapshot (백엔드 layer + regime + multiplier) + trpc.macroV2.history (raw FRED 시리즈 1Y) 양쪽 fetch
- derived spread 계산 (예: SOFR_IORB_SPREAD = SOFR - IORB, BREAKEVEN_10Y = DGS10 - DFII10)
- 통합 status 분류 — FRED_API_KEY 미설정 → stub / freshness 12h 초과 → stale / 응답 오류 → error
- 5단계 regime 별 multiplier 매핑: crisis 0.30 / tight 0.65 / neutral 1.00 / easing 1.20 / flooded 1.40

### 1.3 신규 타입 — `macro-indicator-types.ts` (~850 LOC)

5 indicator 정적 메타 hardcode. 백엔드 d.ts 와 분리된 UI 전용 정적 데이터.

```ts
export const MACRO_INDICATOR_META: Record<MacroIndicatorId, MacroIndicatorMeta> = {
  "sofr-iorb": {
    title: "SOFR-IORB Spread",
    description: "...",
    fredSeries: [
      { id: "SOFR", label: "..." },
      { id: "IORB", label: "..." },
      { id: "SOFR_IORB_SPREAD", derived: { minuend: "SOFR", subtrahend: "IORB", scale: 1 } },
    ],
    primarySeriesId: "SOFR_IORB_SPREAD",
    showZeroLine: true,
    currentValueKeys: [
      { label: "Spread", layerField: "spread_bp", unit: "bp", digits: 1 },
      { label: "Macro Score", layerField: "macro_score", ... },
      { label: "Multiplier", layerField: "multiplier", ... },
    ],
    academicRefs: [
      { citation: "Bowman, M., Saha, R., et al. (2024). Federal Reserve Bank of NY Staff Report 1098 — \"Money Market Spreads and Bank Reserves\".", url: "..." },
      // ... 5건
    ],
    historicalCases: [
      { period: "2023-03 SVB collapse",      btcReturn: "-13%", note: "..." },
      { period: "2022-09 UK Gilt crisis",    btcReturn: "-22%", note: "..." },
      { period: "2020-03 COVID liquidity",   btcReturn: "-47%", note: "..." },
      { period: "2019-09 Repo spike",        btcReturn: "-23%", note: "..." },
    ],
    staticInterpretation: { ... },
    regimeRulebook: { crisis: ">10bp ...", tight: "5~10bp ...", neutral: "...", easing: "...", flooded: "..." },
  },
  walcl: { ... },
  "yield-curve": { ... },
  "dxy-vix": { ... },
  "real-rate": { ... },
};

export const REGIME_RULEBOOK = {
  crisis:   { multiplier: 0.30, color: "text-red-400",     label: "위기 (×0.30)" },
  tight:    { multiplier: 0.65, color: "text-orange-300",  label: "타이트 (×0.65)" },
  neutral:  { multiplier: 1.00, color: "text-slate-300",   label: "중립 (×1.00)" },
  easing:   { multiplier: 1.20, color: "text-emerald-300", label: "완화 (×1.20)" },
  flooded:  { multiplier: 1.40, color: "text-cyan-300",    label: "범람 (×1.40)" },
};
```

### 1.4 학술 레퍼런스 + 역사적 사례 hardcode

5 indicator 모두 3-5건 학술 ref + 4건 역사적 사례 (BTC 동시 수익률 포함).

| Indicator | 학술 레퍼런스 | 역사적 사례 |
|---|---|---|
| SOFR-IORB | Bowman 2024 NY Fed SR1098, Park & Irwin 2007 JEF, BIS Quarterly 2023 | SVB 2023-03 / Gilt 2022-09 / COVID 2020-03 / Repo 2019-09 |
| WALCL | Bernanke 2017 Brookings, Adrian & Boyarchenko NY Fed, JPM 2023 BTFP, Bitwise 2024, Caballero & Simsek 2020 QJE | COVID QE 2020-03 / QT 시작 2022-04 / BTFP +$390B 2023-03 / Fed pivot 2024-09 |
| Yield Curve | Estrella & Mishkin 1998 Fed WP, Bauer & Mertens 2018 FRBSF, Aramonte 2024 BIS, Hu & Hong 2024 | first inversion 2019-08 / 2022-07 inversion / 2023-07 -1.08 max / 2024-09 un-inversion |
| DXY/VIX | Adrian/Crump/Vogt 2019 Fed WP, Bekaert 2013 JF, Glassnode 2024 Q3, CME 2023, Bruno & Shin 2015 RES | DXY+8% 2020-03 / 114.78 peak 2022-09 / yen carry 2024-08 / -3% reversal 2025-04 |
| Real Rate | Gürkaynak/Sack/Wright 2010 JME, Krishnamurthy & Vissing-Jorgensen 2012, Glassnode 2024, DeMiguel 2024 JFE, Choi & Yoon 2022 JIMF | -1.06% 최저 2020-08 / +1.74% 10y high 2022-10 / 1.40% Fed cut 2024-09 / 2025-03 breakeven 완화 |

---

## Phase 2 — SOFR-IORB Spread (commit b12d881)

### 변경

`src/pages/macro/MacroSofr.tsx` — 13줄 placeholder 를 신규 공통 페이지로 교체.

```tsx
export default function MacroSofr() {
  return <MacroIndicatorPage indicatorId="sofr-iorb" />;
}
```

### 활성화되는 sub-section (8개)

1. **Header** — LIVE/STUB 배지 + 한국어 description + tagline
2. **Stub 안내 카드** — FRED_API_KEY 미설정 시 자동 표시 + 무료 키 발급 링크
3. **CurrentValueCards** — Spread (bp, primary) / Macro Score / Multiplier
4. **TimeSeriesChart** — SOFR / IORB / Spread 3시리즈 토글, 30D~5Y, **showZeroLine** 으로 위기 영역 5bp+ 가시화
5. **RegimeCard** — 현재 regime + multiplier + freshness + 룰북 미니표
6. **Interpretation** — 동적 분석 6단계 (요약/regime/composite/Bowman et al 인용/SVB 2023 등 사례/BBDX 영향/다음 시나리오)
7. **BbdxImpactCard** — 곱셈 체인 + 5단계 regime 시뮬레이터
8. **CharterFooter** — R3 modifier-only 면책

### 검증 (FRED_API_KEY 등록 전 stub 상태)

- LIVE 배지 대신 STUB 배지 표시
- 상단 안내 카드: "FRED_API_KEY 등록 대기 중" + 무료 키 발급 링크
- CurrentValueCards: "—" + "STUB" 라벨
- TimeSeriesChart: 빈 차트 + "FRED_API_KEY 등록 후 자동 표시" 안내
- RegimeCard: NEUTRAL (default) + multiplier 1.00
- Interpretation: 정적 룰북 + 학술 레퍼런스 + 역사적 사례 (정상 표시)
- BbdxImpactCard: multiplier 1.00 default 곱셈 체인
- CharterFooter: BETA 배지 + "stub 모드" extraNote

### FRED_API_KEY 등록 후 LIVE 검증

`-6bp` 표시 → **TIGHT regime, ×0.65 multiplier** 활성.

---

## Phase 3 — 4 페이지 wiring (818325a / 96cf2e5 / 19cc122 / bf16e1e)

### 3a. WALCL — Fed Balance Sheet (818325a)

`src/pages/macro/MacroWalcl.tsx` placeholder → MacroIndicatorPage wiring.

**메타 확장**:
- 학술 ref 5건 (Bernanke 2017 Brookings / Adrian & Boyarchenko NY Fed / JPM 2023 BTFP / Bitwise 2024 lag corr / Caballero & Simsek 2020 QJE)
- 역사적 사례 4건 — $T 절대 수준 포함 (COVID QE 2020-03 / QT 시작 2022-04 / BTFP +$390B 2023-03 / Fed pivot 2024-09)
- currentValueKeys 3개:
  - WALCL Total Assets (primary, **$M → $T 환산 formatValue**)
  - WALCL 30d Change (%)
  - Net Liquidity 30d (%)

**$M → $T 환산**:
```ts
formatValue: (v) => `$${(v / 1_000_000).toFixed(2)}T`
```

**fromSeriesId 경로** (e9850b2 에서 카드 컴포넌트 확장):
WALCL 절대 수준이 백엔드 layer 에 없지만 raw FRED "WALCL" 시리즈 latest 값을
가져와 카드에 표시. MacroCurrentValueCards 의 `fromSeriesId: "WALCL"` 옵션 사용.

### 3b. Yield Curve — 10Y-2Y + C4 Cycle Phase categorical (96cf2e5)

`src/pages/macro/MacroYieldCurve.tsx` placeholder → MacroIndicatorPage wiring.

**메타 확장**:
- 학술 ref 4건 (Estrella & Mishkin 1998 Fed WP / Bauer & Mertens 2018 FRBSF / Aramonte 2024 BIS / Hu & Hong 2024)
- 역사적 사례 4건 (2019-08 first inversion / 2022-07 inversion / 2023-07 최대 inversion -1.08 / 2024-09 un-inversion = Fed pivot)
- currentValueKeys 3개:
  - 10Y-2Y Spread (primary) — **showZeroLine 으로 inversion 가시화**
  - **C4 Cycle Phase (categorical)** — layer.c4_cycle_phase string 표시
  - Macro Score

**C4 Cycle Phase 색상 매핑**:
```ts
categoricalColor: {
  expansion:           "text-cyan-300",
  late_cycle:          "text-yellow-300",
  pre_recession:       "text-orange-300",
  recession_imminent:  "text-red-400",
  recovery:            "text-emerald-300",
}
```

### 3c. DXY/VIX — C2 risk-on composite (19cc122)

`src/pages/macro/MacroDxyVix.tsx` placeholder → MacroIndicatorPage wiring.

**메타 확장**:
- 학술 ref 5건 (Adrian/Crump/Vogt 2019 Fed WP / Bekaert et al 2013 JF / Glassnode 2024 Q3 / CME 2023 / Bruno & Shin 2015 RES)
- 역사적 사례 4건 (2020-03 DXY+8% spike / 2022-09 DXY 114.78 peak / 2024-08 VIX 65 yen carry unwind / 2025-04 DXY -3% reversal)
- currentValueKeys 3개: DXY 30d Change (primary) / VIX Level / C2 Risk-On (0~1 composite)

**백엔드 layer 제약 노트**:
- layer 에 `dxy_change_30d_pct` + `vix` 만 포함 (절대 DXY 수준 없음)
- description 에 명시 — DXY 절대 수준은 차트 시리즈 (DTWEXBGS) 에서 확인
- DXY 30d Change 가 primary 카드 역할

### 3d. Real Rate — DFII10 + Breakeven 10Y derived (bf16e1e)

`src/pages/macro/MacroRealRate.tsx` placeholder → MacroIndicatorPage wiring.

**메타 확장**:
- 학술 ref 5건 (Gürkaynak/Sack/Wright 2010 JME / Krishnamurthy & Vissing-Jorgensen 2012 / Glassnode + Coinbase 2024 / DeMiguel 2024 JFE / Choi & Yoon 2022 JIMF)
- 역사적 사례 4건 (2020-08 -1.06% 최저 / 2022-10 +1.74% 10y high / 2024-09 1.40% Fed cut / 2025-03 breakeven 완화)
- currentValueKeys 3개:
  - 10Y Real Rate (primary, DFII10)
  - **Breakeven 10Y** (fromSeriesId BREAKEVEN_10Y) — derived = DGS10 - DFII10
  - Net Liquidity 30d (보완 차원)

**fredSeries 에 derived 추가**:
```ts
fredSeries: [
  { id: "DFII10",         label: "10Y Real Rate (TIPS)" },
  { id: "DGS10",          label: "10Y Nominal" },
  { id: "BREAKEVEN_10Y",  label: "Breakeven Inflation 10Y",
    derived: { minuend: "DGS10", subtrahend: "DFII10", scale: 1 } },
],
```

### 3공통 — MacroCurrentValueCards 확장 (e9850b2)

Phase 3 4개 페이지 작업 직전에 카드 컴포넌트 확장 commit.

**MacroCurrentValueKey 타입에 필드 추가**:
- `valueType: "number" | "categorical"`
- `formatValue?: (v: number) => string` — 커스텀 포맷 ($T 환산 등)
- `pickCategorical?: (layer) => string` — layer 의 string 필드 추출
- `categoricalColor?: Record<string, string>` — phase → text-color
- `categoricalLabel?: Record<string, string>` — phase → 한국어 라벨
- `stubReason?: string` — layer 에 필드 없을 때 표시할 사유 (예 "DXY 절대 수준 미포함")

**MacroCurrentValueCards 의 4 렌더 경로**:
1. `"number"` (default) — formatValue 커스텀 포맷 또는 기본 toFixed+unit
2. `"categorical"` — layer 의 string 필드를 색상 + 라벨 매핑하여 표시
3. **`fromSeriesId`** — layer 대신 raw FRED 시리즈의 latest 값 (WALCL 절대 수준)
4. **`stubReason` 명시** — layer 에 필드 없음 → "—" + 안내 텍스트

SOFR 페이지는 영향 없음 (기존 number 경로만 사용).

---

## Phase 4 — fraction → % fix (commit ff11f84)

### 증상

백엔드 layer 의 `walcl_change_30d_pct`, `dxy_change_30d_pct`,
`c3_net_liquidity_30d_pct` 는 **fraction** (0.0034 = 0.34%) 으로 응답됨.
기존 메타는 `unit: "%"` + `digits: 2` 로 toFixed 만 호출 → **0.00%** 로 잘못
표시.

### 변경

`src/shared/macro-indicator-types.ts` (8 lines 추가) — 해당 3개 카드의
`formatValue` 추가:

```ts
formatValue: (v: number) => `${(v * 100).toFixed(2)}%`
```

### 결과 (Before → After)

| 카드 | Before | After |
|---|---|---|
| WALCL 30d Change | 0.00% | **0.34%** |
| Net Liquidity 30d (walcl/real-rate) | 0.00% | (정확 환산) |
| DXY 30d Change | -0.01% | **-0.86%** (부호 포함) |

---

## Phase 5 — C3 Interpretation fix (commit 2ef9acb)

### 증상

`MacroInterpretation.tsx` 의 `buildCompositeExplain` 함수가 C3 net liquidity
값을 fraction 그대로 출력 → "0.003%" 같은 잘못된 텍스트.

### 변경

`src/components/macro/MacroInterpretation.tsx` (8 lines, +5/-3) — C3 fraction
→ % 변환:

```ts
// Before
text: `Net Liquidity 30d: ${formatNumber(c3, 2)}%`,

// After
text: `Net Liquidity 30d: ${formatNumber(c3 * 100, 2)}%`,
```

Phase 4 가 카드 표시만 fix 했고, Phase 5 가 Interpretation 텍스트 fix.

---

## FRED_API_KEY 등록 + 시각 검증

### 사용자 발급

FRED Free tier (1000 req/day) — 사용자가 `dc265ead40d97967378f93411494589f`
발급 완료.

### .env 등록

`tradelab-backend/.env`:
```env
FRED_API_KEY=dc265ead40d97967378f93411494589f
```

### LIVE 전환 확인 (5/5 페이지)

| 페이지 | 상태 | primary 값 | regime |
|---|---|---|---|
| SOFR-IORB | LIVE | **-6 bp** | TIGHT (×0.65) |
| WALCL | LIVE | **$7.18 T** | TIGHT (Phase 4 후 +0.34% 정상 표시) |
| Yield Curve | LIVE | (FRED 응답값) | (C4 cycle phase categorical 표시 확인) |
| DXY / VIX | LIVE | DXY 30d -0.86% | TIGHT |
| Real Rate | LIVE | DFII10 (FRED 값) + Breakeven derived | TIGHT |

### 현재 매크로 환경 종합

**TIGHT regime (×0.65), score -40**.

BBDX 진입 base 점수에 ×0.65 multiplier 적용 → 보수적 시그널 환경.

---

## 메인 진입점 — `MacroIndicatorPage.tsx`

```tsx
export function MacroIndicatorPage({ indicatorId }: { indicatorId: MacroIndicatorId }) {
  const meta = MACRO_INDICATOR_META[indicatorId];
  const state = useMacroIndicator(indicatorId);

  return (
    <DashboardLayout>
      <Header title={meta.title} status={state.status} tagline={meta.tagline} />
      {state.status === "stub" && <StubGuidanceCard />}
      <MacroCurrentValueCards meta={meta} layer={state.layer} fredSeries={state.fredSeries} />
      <MacroTimeSeriesChart meta={meta} data={state.chartData} period={period} />
      <MacroRegimeCard regime={state.regime} multiplier={state.multiplier} freshness={state.freshness} />
      <MacroInterpretation meta={meta} layer={state.layer} regime={state.regime} multiplier={state.multiplier} />
      <MacroBbdxImpactCard multiplier={state.multiplier} regime={state.regime} />
      <CharterFooter beta={state.status === "stub"} />
    </DashboardLayout>
  );
}
```

5 페이지 모두 단 한 줄:
```tsx
export default function MacroSofr()    { return <MacroIndicatorPage indicatorId="sofr-iorb"   />; }
export default function MacroWalcl()   { return <MacroIndicatorPage indicatorId="walcl"       />; }
export default function MacroYield()   { return <MacroIndicatorPage indicatorId="yield-curve" />; }
export default function MacroDxyVix()  { return <MacroIndicatorPage indicatorId="dxy-vix"     />; }
export default function MacroReal()    { return <MacroIndicatorPage indicatorId="real-rate"   />; }
```

신규 indicator 추가 = `MACRO_INDICATOR_META` 에 entry 추가 + 단 한 줄 페이지
파일 생성. **확장 비용 최소화**.

---

## 헌장 R3 준수 — Modifier-only

5 페이지 모두 **CharterFooter** 가 하단에 명시:

> "본 indicator 는 BBDX 시그널의 **multiplier (가중치)** 로만 작동합니다.
> 단독 매매 신호로 사용 금지 (헌장 규칙 3)."

**MacroBbdxImpactCard** 는 곱셈 체인을 시각화:
```
BBDX base score (70) × Macro multiplier (0.65) = Final score (45.5)
                       └─ TIGHT regime
```

5단계 regime 시뮬레이터로 사용자가 "만약 multiplier 가 1.40 이면?" 같은
what-if 분석 가능.

---

## 디자인 보존

| 항목 | 결과 |
|---|---|
| HudPanel 사용 | ✅ 모든 카드 HudPanel variant="default" / "highlight" |
| Recharts ComposedChart | ✅ MacroTimeSeriesChart |
| oklch 색상 토큰 | ✅ 모든 컴포넌트 |
| Share Tech Mono 폰트 | ✅ 카드/차트 모두 |
| Tailwind class 만 | ✅ raw hex 없음 |

---

## 후속 작업

- **Phase 2 Onchain Tracker** — 7-차원 온체인 modifier 페이지 wiring (whale-tx,
  exchange-netflow, miner-position, stablecoin-flow, derivatives-funding,
  smart-money-flow, ssr). Macro 와 동일 패턴.
- **C4 Cycle Phase 차트 마커** — 현재 categorical 카드만. history 라인 차트에
  phase 변환 시점 vertical line 추가 검토.
- **FRED_API_KEY 한도 모니터링** — 1000/day Free tier. 도달 시 STALE 자동
  표시되지만 사용자 알림 추가 검토.
- **derived 시리즈 시각화** — Real Rate 의 Breakeven 10Y derived 가 차트에서도
  3번째 라인으로 토글되도록 — 이미 useMacroIndicator 가 계산 후 chartData 에
  주입하므로 별도 작업 없음.

---

작성: 2026-05-17
