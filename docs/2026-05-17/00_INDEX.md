# 2026-05-17 프론트엔드 작업 인덱스

> 프론트엔드 (`tradelab-frontend`) 어제~오늘 (5-15 ~ 5-17) 진행 작업.
> 백엔드 작업은 `tradelab-backend/docs/2026-05-17/` 참조.
>
> 본 문서는 일일 작업 카탈로그 — 영역별 상세는 각 영역 MD 참조.

---

## 작업 목록

| # | 파일 | 영역 | 핵심 |
|---|---|---|---|
| 01 | [MACRO_LIQUIDITY_TRACKER.md](./01_MACRO_LIQUIDITY_TRACKER.md) | 페이지 (대규모) | Macro 5개 detail 페이지 wiring (Phase 1~5) — 공통 컴포넌트 8개 + 5개 indicator 메타 + fraction→% fix |
| 02 | [VWAP_CHART_FIX.md](./02_VWAP_CHART_FIX.md) | 버그 fix | CandleLite.timestamp → openTime — lightweight-charts "Invalid Date" 증상 해결 |
| 03 | [FIBONACCI_TRENDLINE_V1.md](./03_FIBONACCI_TRENDLINE_V1.md) | 알고리즘 | TF-aware Trendline V1 — inflection-point anchor + LR best-fit + extrapolation clipping |
| 04 | [BBDX_COMBINED_UI.md](./04_BBDX_COMBINED_UI.md) | UI 옵션 | Backtest 페이지 bbdx-combined (LONG+SHORT 통합) + Trend-Follow→EMA+ADX 정배열 rename |
| 05 | [DEPLOYMENT_PATTERNS.md](./05_DEPLOYMENT_PATTERNS.md) | 운영 | 5-ref push + OneDrive git refs 손상 사건 + FRED_API_KEY 시각 검증 시나리오 |

---

## 통계 (프론트엔드)

### Commits (5-15 ~ 5-17, 21건)

```
2ef9acb 5-16 fix(macro): C3 net liquidity Interpretation 텍스트 fraction -> percent 변환
4cb0c43 5-16 fix(vwap): CandleLite.timestamp -> openTime — chart "Invalid Date" 버그 fix
8d5c5d3 5-16 fix(chart): preserve zoom/pan state across ticker updates
d0f0bef 5-16 feat(vwap): VWAP 차트 V2 — 캔들 + rolling VWAP/EMA9/±σ + Volume Profile overlay
ff11f84 5-16 fix(macro): fraction -> percent 변환 (WALCL/DXY/RRP+TGA 30d Change 카드)
760f858 5-16 feat(simulator): localStorage fallback + freer chart zoom/scroll
bf16e1e 5-15 feat(macro): Real Rate 페이지 wiring (Phase 3d — DFII10 + breakeven derived)
19cc122 5-15 feat(macro): DXY/VIX 페이지 wiring (Phase 3c — C2 risk-on composite)
96cf2e5 5-15 feat(macro): Yield Curve 페이지 wiring (Phase 3b — 10Y-2Y + C4 cycle phase)
818325a 5-15 feat(macro): WALCL 페이지 wiring (Phase 3a — Fed Balance Sheet, $T 단위)
e9850b2 5-15 feat(macro): MacroCurrentValueCards categorical + formatValue + stubReason
3d532e0 5-15 feat(simulator): onboarding screen + compact layout + backend-error banner
2cc7a38 5-15 feat(simulator): Bybit-style trading UI — no login (nickname-based)
b12d881 5-15 feat(macro): SOFR-IORB 페이지 wiring (Phase 2)
dda8d6e 5-15 feat(macro): useMacroIndicator hook + types + 학술 레퍼런스 hardcode
8894c33 5-15 feat(macro): MacroIndicator 공통 컴포넌트 (Phase 1)
4086a3a 5-15 feat(trendline): V2 알고리즘 — RANSAC + LR + 2-pivot 3-tier fallback
f220d5d 5-15 fix(chart): BBDX ChartZone 을 실제 OHLC 캔들 + Volume 히스토그램으로 교체
6eaef01 5-15 feat(simulator): Investment Simulator UI — Phase 1 (모의투자 신규 탭)
9e4e836 5-15 feat(backtest-ui): rename "Trend-Follow" → "EMA+ADX 정배열" on new design
44656d0 5-15 feat(backtest-ui): expose bbdx-combined strategy on new design
```

### 분류

| 영역 | 건수 | 주요 commits |
|---|---|---|
| Macro Liquidity Tracker | 9 | 8894c33, dda8d6e, b12d881, 818325a, 96cf2e5, 19cc122, bf16e1e, e9850b2, ff11f84, 2ef9acb |
| Backtest UI 옵션 | 2 | 44656d0, 9e4e836 |
| Fibonacci/Trendline | 2 | 08c5be2 (5-14 base 단계 — 본 인덱스 부수 참조), 4086a3a |
| Chart 버그 fix | 3 | f220d5d, 8d5c5d3, 4cb0c43 |
| VWAP 차트 V2 | 1 | d0f0bef |
| Investment Simulator | 3 | 6eaef01, 2cc7a38, 3d532e0, 760f858 (별도 트랙 — 본 인덱스 비포함) |

---

## 신규 파일

### Macro 공통 인프라 (Phase 1)
- `src/components/macro/MacroIndicatorPage.tsx` — 5 페이지 골격 (199L)
- `src/components/macro/MacroCurrentValueCards.tsx` — 4 렌더 경로 (143L → 확장)
- `src/components/macro/MacroTimeSeriesChart.tsx` — Recharts area + line (270L)
- `src/components/macro/MacroRegimeCard.tsx` — 5-regime 시각화 (148L)
- `src/components/macro/MacroInterpretation.tsx` ⭐ — 6단계 동적 분석 (379L)
- `src/components/macro/MacroBbdxImpactCard.tsx` — 곱셈 체인 (204L)
- `src/components/macro/MacroStatusBadge.tsx` — LIVE/STUB/STALE/ERROR (61L)
- `src/hooks/useMacroIndicator.ts` — snapshot + history fetch + status 분류 (332L)
- `src/shared/macro-indicator-types.ts` — 5 indicator 메타 + 학술 ref (~850L)

### Fibonacci V1 (5-14 baseline, 5-15 V2 발전)
- `src/lib/fibonacci-engine.ts` (316L)
- `src/lib/trendline-engine.ts` — V2 알고리즘 (532L)

---

## 수정 파일

### Macro Phase 2~3
- `src/pages/macro/MacroSofr.tsx` — 13L placeholder → MacroIndicatorPage wiring
- `src/pages/macro/MacroWalcl.tsx` — Phase 3a wiring
- `src/pages/macro/MacroYieldCurve.tsx` — Phase 3b wiring
- `src/pages/macro/MacroDxyVix.tsx` — Phase 3c wiring
- `src/pages/macro/MacroRealRate.tsx` — Phase 3d wiring

### Backtest UI
- `src/pages/Backtest.tsx` — STRATEGY_META 확장 (bbdx-combined ⭐ + EMA+ADX 정배열 rename)

### VWAP Chart
- `src/pages/Vwap/VwapDetailPanels.tsx` (+14/-7 line) — 5 series mapping 일괄 갱신
- `src/pages/VwapDetail.tsx` (1 line) — `ts: c.timestamp` → `c.openTime`
- `src/shared/types.ts` — `CandleLite.openTime` + `closeTime?` 추가

### Fibonacci
- `src/components/CandleChartLW.tsx` (+42L) — extrapolation 클리핑
- `src/hooks/useFibonacciDetail.ts` — TF 매핑
- `src/pages/CoinDetail/tabs/v2/CoinChartTab.tsx`
- `src/pages/FibonacciDetail.tsx`
- `src/pages/WaveTrend.tsx` — toFibTrendline rebuild

---

## 5-Ref Push 결과

| Repo | 브랜치 | HEAD SHA | 비고 |
|---|---|---|---|
| `tradelab-hq/tradelab-frontend` | `dev` | `2ef9acb` | origin/dev (Vercel preview) |
| `tradelab-hq/tradelab-frontend` | `feat/v6.5-merge-frontend` | `2ef9acb` | merge target |
| `godkyuho777/Frontend6.5` | `dev` | `2ef9acb` | fe65 mirror |
| `godkyuho777/Frontend6.5` | `feat/v6.5-merge-frontend` | `2ef9acb` | fe65 merge target |
| `godkyuho777/Frontend6.5` | `main` | `2ef9acb` | fe65 prod (optional, 본 세션 처리) |

push 도구: `pnpm push:mirrors` (`scripts/push-mirrors.mjs`). 자세한 시퀀스는
[DEPLOYMENT_PATTERNS.md](./05_DEPLOYMENT_PATTERNS.md) 참조.

---

## 핵심 변경 요약

### 1) Macro Liquidity Tracker 5개 페이지 (Phase 1~5)
이전: 5개 detail 페이지 모두 13줄 placeholder ("WIP — Phase 1").
오늘: 공통 컴포넌트 + hook + 메타 hardcode + 5개 페이지 wiring 완료.

활성화된 페이지 (모두 `/tracker/macro/<indicator>`):
- `/macro/sofr-iorb` — SOFR-IORB Spread (단위 bp + 0 라인)
- `/macro/walcl` — Fed Balance Sheet ($M → $T 환산)
- `/macro/yield-curve` — 10Y-2Y + **C4 Cycle Phase categorical**
- `/macro/dxy-vix` — DXY 30d Change + VIX Level + C2 risk-on
- `/macro/real-rate` — DFII10 + **Breakeven 10Y derived**

각 페이지가 자동 표시:
1. Header (LIVE/STUB 배지 + tagline)
2. Stub 안내 카드 (FRED_API_KEY 미설정 시 자동)
3. CurrentValueCards (3 카드 — primary / 보완 / 보완)
4. TimeSeriesChart (Recharts, 30D/90D/1Y/5Y 토글)
5. RegimeCard (5단계 + multiplier + freshness)
6. **Interpretation 6단계** (요약 / regime / composite / 학술 ref / 역사적 사례 / BBDX 영향 / 시나리오)
7. BbdxImpactCard (곱셈 체인 + regime 시뮬레이터)
8. CharterFooter (R3 modifier-only)

FRED_API_KEY 등록 후 5/5 페이지 LIVE 전환 확인 완료. 현재 매크로 환경:
**TIGHT regime (×0.65), score -40** (SOFR-IORB spread -6bp).

### 2) VWAP Chart "Invalid Date" 버그 fix
`CandleLite.timestamp` vs 백엔드 `Candle.openTime` 필드명 mismatch + `as`
캐스트가 컴파일 타임 체크 우회. lightweight-charts 가 모든 캔들을 단일 bar
로 압축하던 증상 해결.

### 3) Fibonacci TF-aware Trendline V1
기존 brute-force pair 검색 → inflection-point anchor + linear regression
best-fit. `FIB_TF_PARAMS` 로 TF별 swing/lookback 분화. 라인 클리핑으로 BTC
페이지에서 $323.43 까지 뻗던 버그 해결.

(5-15 후속 — 4086a3a Trendline V2 RANSAC + LR 3-tier fallback 적용. ADAUSDT
4H 저점-저점 라인 미표시 케이스 추가 해결. 자세한 V2 알고리즘은 별도 docs
예정.)

### 4) BBDX Combined UI 옵션 노출
Backtest 페이지에 `bbdx-combined` (LONG+SHORT 통합) strategy 노출. default
strategy 를 `bbdx-combined` 로 변경. 기존 `bbdx`/`bbdx-short` 라벨에
`(LONG only)`/`(SHORT only)` 명시.

`Trend-Follow` → `EMA+ADX 정배열 ⭐` 라벨 rename (id 유지).

---

## 디자인 보존 체크

5-14 `feat/new-design` (commit `3aee30a`) 의 디자인을 100% 보존:

| 항목 | 5-14 baseline | 5-15~17 작업 | 결과 |
|---|---|---|---|
| HudPanel 색상 토큰 | oklch | 모든 신규 컴포넌트 oklch 유지 | ✅ |
| Share Tech Mono 폰트 | 적용 | Macro 카드/차트 모두 적용 | ✅ |
| neon-pink/cyan/green | 강조색 | Macro StatusBadge / RegimeCard 색상 매핑 | ✅ |
| BacktestStatCard 재사용 | 신규 5-14 컴포넌트 | LONG/SHORT 카드도 동일 컴포넌트 | ✅ |
| Recharts pattern | 5-14 표준 | MacroTimeSeriesChart 따름 | ✅ |

Backtest 페이지 변경은 **STRATEGY_META 객체에 신규 엔트리 추가만** — HudPanel,
MetricCards, 폰트, 색상 토큰 모두 무손 보존.

---

## 헌장 준수

| 규칙 | 결과 |
|---|---|
| R1 Lookahead-free | N/A — UI 표시만 |
| R2 Modifier-only | ✅ Macro 5개 페이지 모두 BBDX multiplier 로만 작동 (Interpretation 텍스트 + BbdxImpactCard 가 명시) |
| R3 BBDX 헌장 | ✅ CharterFooter 가 매 페이지 하단에 modifier-only 면책 표시 |

---

## 후속 작업

- **Phase 2 Onchain Tracker** — 7-차원 온체인 modifier 페이지 wiring (현재
  스텁만). Macro 와 동일 패턴 (공통 컴포넌트 + 메타 hardcode + wiring) 으로
  진행 권장.
- **Whale Alert Pro 결제 결정** — Onchain 7번 차원의 1번 (whale-tx) 실데이터화.
  스텁이면 `value: 0` 으로 합산 영향 없으나, 실데이터 도입 시 결제 + env
  추가 필요.
- **Trendline V3 후속** — V2 (4086a3a) 후 사용자 추가 케이스 발견 시 추가
  fallback 검토. 현재 ADAUSDT 4H 케이스는 통과.
- **C4 Cycle Phase 차트 시각화** — 현재 categorical 카드만. history 라인
  차트에 phase 변환 마커 추가 검토.
- **FRED_API_KEY 만료 모니터링** — Free tier (1000/day) 한도 도달 시 STALE
  상태로 자동 표시. 사용자에게 알림 필요 시 backend 에서 푸시.

---

작성: 2026-05-17
