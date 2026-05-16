# VWAP Chart — "Invalid Date" 버그 fix

> **영역**: `src/pages/Vwap/VwapDetailPanels.tsx`, `src/pages/VwapDetail.tsx`,
> `src/shared/types.ts`
>
> **commit**: 4cb0c43 (5-16)
>
> **분류**: 버그 fix — 런타임 NaN 으로 인한 차트 압축 증상

VWAP detail 페이지 (lightweight-charts 기반) 가 모든 캔들을 **단일 bar** 로
압축 + X축 라벨이 **"Invalid Date"** 로 표시되던 버그 진단 + 수정.

---

## 증상

사용자 ETHUSDT 4H VWAP 페이지 진입 시:
- 차트 X축 라벨이 모두 **"Invalid Date"**
- 모든 캔들이 차트 좌측에 **단일 bar 로 압축**
- VWAP / EMA9 / ±σ 밴드 라인도 **안 그려짐**
- **Volume Profile 패널만 정상** (가격축 사용)

---

## 진단

### 1. 필드명 mismatch

| 위치 | 필드 | 출처 |
|---|---|---|
| 백엔드 응답 | `Candle.openTime` | `tradelab-backend/src/shared/types.ts:34` |
| 프론트 타입 | `CandleLite.timestamp` | `tradelab-frontend/src/shared/types.ts` |

프론트는 백엔드 응답을 `as VwapDetailLite` 캐스트로 받고, 모든 series mapping
이 `c.timestamp / 1000` 을 사용. 백엔드는 `openTime` 만 응답하므로:

```ts
c.timestamp        // undefined
c.timestamp / 1000 // NaN
```

### 2. `as` 캐스트가 컴파일 타임 체크 우회

`useVwapDetail` 훅이 백엔드 응답을 `as VwapDetailLite` 로 단정. TypeScript 가
런타임 필드명 차이를 잡지 못함.

### 3. lightweight-charts 의 NaN 처리

`time: NaN` 이 모든 series 의 X 좌표로 들어가면, lightweight-charts 는 모든
data point 를 "Invalid Date" 좌표로 인식 → 단일 가상 위치에 압축.

### 4. Volume Profile 만 정상인 이유

Volume Profile 패널은 **가격축** 사용 (수직 분포). `c.timestamp` 를 안 쓰므로
영향 없음. 본 fix 의 회귀 검사 영역 외부.

---

## 변경 파일

| 파일 | 변경 |
|---|---|
| `src/shared/types.ts` | `CandleLite.timestamp` → `openTime` rename + `closeTime?: number` 옵셔널 필드 추가 (forward-compatible) |
| `src/pages/Vwap/VwapDetailPanels.tsx` | +14/-7 — VwapChartPanel 의 5 series mapping 일괄 갱신 |
| `src/pages/VwapDetail.tsx` | 1 line — Recharts 백업 차트의 `ts: c.timestamp` → `c.openTime` |

---

## VwapDetailPanels.tsx 의 5 series mapping

VwapChartPanel 안의 5개 series 가 모두 `c.timestamp / 1000` 을 사용 →
일괄 `c.openTime / 1000` 으로 변경:

| series | 역할 |
|---|---|
| candleSeries | OHLC 캔들 |
| volumeSeries | 거래량 히스토그램 |
| vwapSeries | rolling VWAP 라인 |
| ema9Series | EMA9 라인 |
| bandsSeries (upper1 / lower1) | VWAP ±σ 밴드 |

```ts
// Before (런타임 NaN)
candleSeries.setData(candles.map(c => ({
  time: (c.timestamp / 1000) as Time,
  open: c.open, high: c.high, low: c.low, close: c.close,
})));

// After
candleSeries.setData(candles.map(c => ({
  time: (c.openTime / 1000) as Time,
  open: c.open, high: c.high, low: c.low, close: c.close,
})));
```

5 series 모두 동일 패턴.

---

## CandleLite 타입 변경

`src/shared/types.ts`:

```ts
// Before
export interface CandleLite {
  timestamp: number;  // ❌ 백엔드와 불일치
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// After
export interface CandleLite {
  openTime: number;       // ✅ 백엔드 Candle.openTime 과 1:1 매칭
  closeTime?: number;     // ✅ optional forward-compatible
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}
```

---

## 회귀 검사

`useVwapDetail` 을 사용하는 다른 4개 파일 영향 없음:

| 파일 | 사용 패턴 | 영향 |
|---|---|---|
| `src/pages/Vwap/VwapDetailPanels.tsx` | VwapChartPanel 5 series mapping | ✅ 본 fix 대상 |
| `src/pages/VwapDetail.tsx` | Recharts 백업 차트 1 line | ✅ 본 fix 대상 |
| `src/pages/CoinDetail/tabs/v2/CoinChartTab.tsx` | VWAP 모드 차트 | timestamp 사용 안 함 — VWAP 점만 표시 |
| `src/pages/Home.tsx` | VWAP 카드 메트릭 (timestamp 무관) | 영향 없음 |

**Volume Profile 패널은 가격축 사용** — 본 버그 영향 영역 외부, 회귀 X.

---

## 사용자 검증

ETHUSDT 4H VWAP 페이지 재진입 → 차트 정상:
- X축 라벨 "May 17, 16:00", "May 17, 20:00" ... 정상 표시
- 모든 캔들 시간순 배치 + 양봉/음봉 색상 정상
- VWAP / EMA9 / ±σ 밴드 라인 정상 렌더
- Volume Profile 우측 패널 변동 없음

---

## 교훈

### `as` 캐스트의 위험

`useVwapDetail` 이 백엔드 응답을 `as VwapDetailLite` 로 단정한 부분이 본 버그의
root cause. TypeScript 가 필드명 mismatch 를 잡지 못함.

**개선 방향**:
- tRPC `inferProcedureOutput` 을 통해 백엔드 응답 타입을 추론 (`as` 없이)
- 또는 zod parse 로 런타임 validation 추가

### 백엔드/프론트 타입 동기화

`tradelab-backend/src/shared/types.ts` 의 `Candle` 과 `tradelab-frontend/src/shared/types.ts` 의 `CandleLite` 가 별도 정의된 점이 문제. 향후:
- 백엔드의 `Candle` 을 `@tradelab/backend` 에서 export → 프론트가 직접 import
- 또는 두 파일의 인터페이스 일치 강제 (CI 검사)

---

## 후속 작업

- **다른 detail 페이지의 `as` 캐스트 점검** — FibonacciDetail, BbdxDetail,
  WaveTrend 도 백엔드 응답을 `as` 로 받는 패턴이 있다면 동일 버그 가능성.
- **CandleLite 폐기 검토** — 백엔드의 `Candle` 을 직접 사용하도록 통일하면
  프론트 별도 타입 정의 불필요.

---

작성: 2026-05-17
