# CoinDetail 6-탭 재구성 + 트래커 컨텍스트 인식

> **핵심 변경**: `/coin/:symbol` 페이지를 6-탭 구조 + URL `?tracker=` 로 트래커 컨텍스트 인식
> **사용자 요구**: 모든 트래커의 코인 클릭이 통일된 6-탭 페이지로 가야 하고, 각 탭은 트래커별 콘텐츠

---

## 1. 6-탭 구조

```
[코인 정보 ★NEW] [매매기준] [실시간 신호] [차트] [백테스트] [히스토리]
```

| 탭 | 컴포넌트 | 라인 | 트래커 인식? |
|---|---|---|---|
| 코인 정보 | CoinInfoTab.tsx | 394L | ❌ (코인 자체 정보) |
| 매매기준 | CoinCriteriaTab.tsx | 310L | ✅ BBDX/Fib/VWAP 분기 |
| 실시간 신호 (default) | CoinSignalTab.tsx | 456L | ✅ |
| 차트 | CoinChartTab.tsx | 303L | ✅ |
| 백테스트 | CoinBacktestTab.tsx | 132L | ✅ (BBDX wired, Fib/VWAP placeholder) |
| 히스토리 | CoinHistoryTab.tsx | 66L | ❌ (signal 누적) |

---

## 2. 트래커 컨텍스트 (URL `?tracker=`)

### 클릭 경로
| 트래커 | 클릭 URL |
|---|---|
| Home (RSI/BB/ADX) | `/coin/:symbol?tab=signal&tracker=bbdx` |
| Fibonacci | `/coin/:symbol?tab=signal&tracker=fibonacci&tf=4h` |
| VWAP | `/coin/:symbol?tab=signal&tracker=vwap&tf=4h` |

### 타입 정의
**파일**: `src/pages/CoinDetail/tracker-context.ts` (52L)
```ts
export type TrackerContext = "bbdx" | "fibonacci" | "vwap" | "jeon-in-gu";
export const TRACKER_NAMES: Record<TrackerContext, string> = {
  bbdx: "BBDX v6.6 (RSI + BB + ADX)",
  fibonacci: "Fibonacci & Trendline",
  vwap: "VWAP + EMA(9)",
  "jeon-in-gu": "전인구 시그널 (Beta)",
};
export function parseTrackerParam(search: string): TrackerContext;
```

---

## 3. 탭별 트래커 분기 — Wire 상태

### 3.1 매매기준 (CoinCriteriaTab) ✅ Fully wired

```tsx
switch (tracker) {
  case "fibonacci": return <FibonacciCriteria />;  // Fib 38.2/50/61.8 + 추세선
  case "vwap":      return <VwapCriteria />;        // 5-component
  case "bbdx":
  default:          return <BbdxCriteria />;        // RSI/BB/ADX 3-path
}
```

#### Fibonacci 매매기준
- LONG: Fib 38.2% golden zone + 상승 추세선 intact + swing low 식별
- SHORT: 대칭
- 가중치: Fib zone 0.40 / Trendline 0.30 / Volume 0.20 / Pattern 0.10
- 임계: Fib zone 거리 ±2% / Trendline strength ≥ 60

#### VWAP 매매기준 (명세서 §9.1)
- LONG: 가격 > VWAP / EMA > VWAP / Pullback v2 / HVN/POC 지지 / LVN 위
- 가중치: VWAP 0.25 / EMA 0.20 / Pullback 0.25 / VP 지지 0.15 / VP 구조 0.15
- 임계: 진입 최소 40 / 최종 50 / Pullback proximity 0.5%

#### BBDX 매매기준
- 3-path entry (NUM/PTN/BB)
- 가중치: momentum 0.30 / position 0.25 / trend 0.20 / volume 0.15 / action 0.10
- 임계: 진입 최소 40 / BBDX 최종 50

### 3.2 실시간 신호 (CoinSignalTab) ✅ Fully wired

각 트래커별 hook 호출:
- BBDX: `signals.scan` + SignalCard + ShortSignalCard + DimensionBreakdown
- Fibonacci: `useFibonacciDetail` → zone + 추세선 + BUY/SELL chip
- VWAP: `useVwapDetail` → VwapMultChip + 5-component breakdown + Pullback v2 + Multi-TF + Volume Profile

### 3.3 차트 (CoinChartTab) ✅ Fully wired

```tsx
case "fibonacci": return <CandleChartLW indicators={{fibLevels, trendlines, swingPoints}} />;
case "vwap":      return <VwapChartPanel + VolumeProfilePanel />;
case "bbdx":
default:          return <ChartZone indicators={{rsi, bb, adx}} fullSize />;
```

기존 컴포넌트 (`CandleChartLW`, `VwapChartPanel`, `VolumeProfilePanel`, `ChartZone`) 재사용.

### 3.4 백테스트 (CoinBacktestTab) ⚠ Partial

```ts
case "fibonacci": return { id: "fibonacci", label: "Fibonacci & Trendline" };
case "vwap":      return { id: "vwap", label: "VWAP + EMA(9)" };
case "bbdx":      return { id: "bbdx", label: "BBDX v6.6" };
```

- **BBDX**: `trpc.backtest.run` + `trpc.winRate.rolling` — fully wired
- **Fib/VWAP**: placeholder + 메타 정보 카드 (라벨 / id / Wire 상태) + `/backtest` 페이지로 유도

**후속 D-009**: 백엔드 `trpc.backtest.run.input` 에 `strategy` 파라미터 추가 시 placeholder 교체.

---

## 4. 코인 정보 탭 (NEW)

**파일**: `src/pages/CoinDetail/tabs/v2/CoinInfoTab.tsx` (394L)

CoinMarketCap-style — `trpc.coin.info.useQuery({symbol})` 호출.

### 카드 구성
1. **CoinHeaderCard** — 이름 + rank + 현재가
2. **개요** — description (한국어 큐레이션) + useCase + category badges
3. **마켓 데이터 grid** — 시총 / FDV / 24h 거래량 / 공급량 3종
4. **가격 정보** — 현재가 / ATH (+ 날짜) / ATH 대비 % / ATL
5. **프로젝트 메타** — 런칭 / 합의 알고리즘
6. **공식 링크** — 홈페이지 / 백서 / GitHub / Twitter / Reddit

### Graceful fallback
백엔드 `coin.info` 미배포 시 → `useCoinMeta + useCoinDetail` 폴백 + 노란 alertCircle "백엔드 라우트 미배포" 안내.

23-coin whitelist 외 → "정보 미커버" 카드.

---

## 5. 트래커 셀렉터 (헤더)

`CoinDetail/index.tsx` 헤더 우측 `headerRight` slot:

```tsx
<Select value={tracker} onValueChange={(v) => setLocation(`/coin/${symbol}?tracker=${v}&tab=${currentTab}`)}>
  <Option value="bbdx">BBDX v6.6</Option>
  <Option value="fibonacci">Fibonacci</Option>
  <Option value="vwap">VWAP</Option>
</Select>
```

사용자가 페이지 안에서 즉석 컨텍스트 변경 가능 (URL 파라미터만 교체, 다른 param 유지).

---

## 6. 진화 이력 — 사용자 명확화 반영

### 첫 시도 (잘못된 방향)
TrackerTabs 를 **트래커 페이지** (Fibonacci/VWAP) 에 적용 → 사용자 지적: "5-탭은 코인 클릭 시 보여야"

### 두 번째 시도
TrackerTabs revert → CoinDetail 에 6-탭 적용 → 사용자 지적: "Fib/VWAP 코인 클릭해도 BBDX 가 나옴"

### 최종 (현재)
- TrackerTabs 트래커 페이지 wrapper revert (Fibonacci.tsx / Vwap.tsx 그대로)
- CoinDetail 6-탭 + URL `?tracker=` 파라미터
- 각 탭이 트래커 인식 후 분기 (BBDX vs Fibonacci vs VWAP)

---

## 7. 검증

- pnpm check PASS
- pnpm build 27.29s 성공
- 콘솔 에러 0

테스트 URL:
- `/coin/BTCUSDT?tracker=bbdx&tab=criteria` → BBDX 3-path
- `/coin/BTCUSDT?tracker=fibonacci&tab=signal` → useFibonacciDetail
- `/coin/BTCUSDT?tracker=vwap&tab=chart` → VwapChartPanel + Volume Profile
- `/coin/BTCUSDT?tab=info` → CoinMarketCap-style (트래커 무관)

---

## 8. Commits (6)

```
c13dc66 feat(coin-detail): tracker selector in CoinDetail header
f8922ee feat(coin-detail): tracker-aware CoinBacktestTab strategy parameter
05cc5e2 feat(coin-detail): tracker-aware CoinChartTab indicators + ChartZone props
826fbdb feat(coin-detail): tracker-aware CoinSignalTab (per-tracker data + hooks)
98a4251 feat(coin-detail): tracker-aware CoinCriteriaTab (BBDX/Fibonacci/VWAP rules)
519cc0b feat(navigation): add ?tracker= param to coin clicks from Home/Fibonacci/VWAP
3eea6b4 fix(navigation): unify Fibonacci + VWAP coin clicks to /coin/:symbol (6-tab)
61d142b feat(coin-detail): refactor to 6-tab structure (코인 정보 NEW)
```

---

## 9. 후속 작업

- **D-009** — 백엔드 `trpc.backtest.run` 에 `strategy` 파라미터 → Fib/VWAP placeholder 교체
- **D-008** — BBDX v6.6 트래커 5-탭 마이그레이션 (필요 시)

---

작성: 2026-05-13
