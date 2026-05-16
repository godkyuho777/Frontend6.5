# BBDX Combined UI — Backtest 페이지 신규 옵션

> **영역**: `src/pages/Backtest.tsx` (단일 파일)
>
> **commits**: 44656d0 (combined 노출) + 9e4e836 (Trend-Follow rename)
>
> **분류**: UI 옵션 — STRATEGY_META 객체 확장 + 디자인 100% 보존

5-14 의 `feat/new-design` (commit 3aee30a) 디자인을 100% 보존하면서 Backtest
페이지에 **bbdx-combined** (LONG + SHORT 통합) strategy 옵션 노출 + Trend-Follow
라벨 rename.

---

## 사용자 의도 정확히 반영

> "Backtest 페이지에 BBDX 가 LONG only, SHORT only 두 개로 분리돼 있는데,
> 한 번에 LONG + SHORT 통합으로 백테스트할 수 있는 옵션이 필요하다. 그리고
> 'Trend-Follow' 보다는 'EMA+ADX 정배열' 이 한국어로 더 명확하다."

→ 백엔드 dev 브랜치는 이미 `bbdx-combined` 지원 중. 본 commit 은 **프론트
UI 노출만** 처리. 새 디자인 보존을 위해 STRATEGY_META 객체에 entry 추가만.

---

## 변경 파일

| 파일 | 변경 |
|---|---|
| `src/pages/Backtest.tsx` | STRATEGY_META["bbdx-combined"] 추가 + default 변경 + LONG/SHORT sub-cards |

**단일 파일 변경**. HudPanel, MetricCards, 폰트, 색상 토큰 모두 무손 보존.

---

## 1) bbdx-combined 옵션 추가 (commit 44656d0)

### STRATEGY_META 확장

```tsx
const STRATEGY_META: Record<StrategyOption, StrategyMetaEntry> = {
  "bbdx-combined": {
    label: "BBDX v6.6 ⭐",            // emerald 색상 — 통합 옵션 강조
    description: "RSI + BB + ADX 3-path 진입 — LONG + SHORT 통합 백테스트",
    color: "emerald",
    icon: TrendingUp,
  },
  "bbdx": {
    label: "BBDX v6.6 (LONG only)",   // ✅ 명시
    description: "...",
    color: "pink",
  },
  "bbdx-short": {
    label: "BBDX v6.6 (SHORT only)",  // ✅ 명시
    description: "...",
    color: "red",
  },
  "trend-follow": {
    label: "EMA+ADX 정배열 ⭐",        // ← 9e4e836 에서 rename
    description: "...",
    color: "cyan",
  },
  // ... 기타 strategy
};
```

### default strategy 변경

```tsx
// Before
const [strategy, setStrategy] = useState<StrategyOption>("bbdx");

// After
const [strategy, setStrategy] = useState<StrategyOption>("bbdx-combined");
```

새 사용자가 페이지 진입 시 즉시 **BBDX v6.6 ⭐ (통합)** 선택된 상태.

### LONG / SHORT sub-metrics 카드

`metricsBySide?: { long, short, combined }` optional 응답 처리:

```tsx
{result?.metricsBySide && (
  <HudPanel title="LONG / SHORT 분리 결과" variant="default">
    <div className="grid grid-cols-3 gap-3">
      <div>
        <h4 className="text-xs text-pink-300">LONG</h4>
        <BacktestStatCard label="Win Rate" value={result.metricsBySide.long.winRate} unit="%" />
        <BacktestStatCard label="Expectancy" value={result.metricsBySide.long.expectancy} unit="R" />
        <BacktestStatCard label="PF" value={result.metricsBySide.long.profitFactor} />
      </div>
      <div>
        <h4 className="text-xs text-red-300">SHORT</h4>
        <BacktestStatCard label="Win Rate" value={result.metricsBySide.short.winRate} unit="%" />
        <BacktestStatCard label="Expectancy" value={result.metricsBySide.short.expectancy} unit="R" />
        <BacktestStatCard label="PF" value={result.metricsBySide.short.profitFactor} />
      </div>
      <div>
        <h4 className="text-xs text-emerald-300">Combined</h4>
        <BacktestStatCard label="Win Rate" value={result.metricsBySide.combined.winRate} unit="%" />
        <BacktestStatCard label="Expectancy" value={result.metricsBySide.combined.expectancy} unit="R" />
        <BacktestStatCard label="PF" value={result.metricsBySide.combined.profitFactor} />
      </div>
    </div>
  </HudPanel>
)}
```

`BacktestStatCard` 는 5-14 새 디자인의 기존 컴포넌트 — **재사용만**, 신규 디자인
파일 생성 없음.

### 백엔드 enum 임시 캐스트

```tsx
// 백엔드 dev 브랜치는 bbdx-combined 지원하나, 프론트가 import 하는 git URL
// 의존성 (@tradelab/backend) 이 아직 갱신 안됨 → 임시 캐스트
runMutation.mutate({
  strategy: strategy as unknown as "bbdx",  // ← 임시 — 백엔드 published 후 제거
  symbols, timeframe, ...
});
```

백엔드 published 후 `as unknown as "bbdx"` 제거 + STRATEGY_OPTIONS 타입 갱신.

---

## 2) Trend-Follow → EMA+ADX 정배열 rename (commit 9e4e836)

### 변경 (2 lines)

```tsx
// Before
"trend-follow": { label: "Trend-Follow", ... }

// After
"trend-follow": { label: "EMA+ADX 정배열 ⭐", ... }
```

### 페이지 헤더 description 도 갱신

```tsx
// Before
"... BBDX / Trend-Follow / Mean-Reversion / ..."

// After
"... BBDX / EMA+ADX 정배열 / Mean-Reversion / ..."
```

**코드 id `trend-follow` 는 유지** — 백엔드 zod enum, runner registry, 저장된
과거 run 모두 backward-compat. **라벨만 변경**.

---

## 디자인 보존 체크

5-14 `feat/new-design` (commit 3aee30a) 의 디자인을 100% 보존:

| 항목 | 5-14 baseline | 본 commit | 결과 |
|---|---|---|---|
| HudPanel 컴포넌트 | 신규 | 재사용만 (새 panel 추가 X) | ✅ |
| BacktestStatCard | 신규 컴포넌트 | LONG/SHORT 카드도 동일 컴포넌트 | ✅ |
| Share Tech Mono 폰트 | 적용 | 갱신 안 함 (Tailwind class 그대로) | ✅ |
| oklch 색상 토큰 | 적용 | emerald/pink/red 도 5-14 토큰 사용 | ✅ |
| neon-pink/cyan/green | 강조색 | combined = emerald, LONG = pink, SHORT = red 기존 매핑 따름 | ✅ |
| ResponsiveContainer 차트 | 5-14 패턴 | 갱신 안 함 | ✅ |

본 commit 은 **STRATEGY_META 객체에 entry 추가 + default state 변경 + 응답
조건부 렌더** 만 — 디자인 파일 무손.

---

## 사용자 검증 시나리오

1. Backtest 페이지 진입 → strategy selector 의 **default 가 "BBDX v6.6 ⭐"**
2. 옵션 선택 메뉴 펼침 → 3개 BBDX 옵션 명확 구분:
   - BBDX v6.6 ⭐ (LONG + SHORT 통합)
   - BBDX v6.6 (LONG only)
   - BBDX v6.6 (SHORT only)
3. 추가 옵션: EMA+ADX 정배열 ⭐, Mean-Reversion 등
4. "Run Backtest" 클릭 → 결과 패널 + **LONG / SHORT 분리 결과** 패널 자동 표시
5. LONG, SHORT, Combined 3 컬럼으로 Win Rate / Expectancy / PF 비교

---

## 헌장 준수

| 규칙 | 결과 |
|---|---|
| R1 Lookahead-free | N/A — UI 옵션만 |
| R2 Modifier-only | N/A — BBDX strategy 자체 (modifier 영역 외) |
| R3 디자인 보존 | ✅ 5-14 새 디자인 100% 보존 |

---

## 후속 작업

- **백엔드 published 후 임시 캐스트 제거** — `as unknown as "bbdx"` 제거 +
  `StrategyOption` 타입에서 `"bbdx-combined"` 정식 추가. 백엔드 `@tradelab/backend`
  git URL 의존성이 `bbdx-combined` 포함하는 SHA 로 업데이트되면 자동.
- **Combined 결과의 LONG/SHORT 분리 차트** — 현재 단일 equity curve. 향후
  pink (LONG) / red (SHORT) / emerald (Combined) 3개 라인 분리 시각화 검토.
- **LONG/SHORT 분리 윈도우** — 현재 같은 백테스트 기간에 LONG + SHORT 동시
  실행. 향후 LONG 윈도우 / SHORT 윈도우 분리 선택 (예: LONG 만 강세장 + SHORT
  만 약세장) 옵션 검토.

---

작성: 2026-05-17
