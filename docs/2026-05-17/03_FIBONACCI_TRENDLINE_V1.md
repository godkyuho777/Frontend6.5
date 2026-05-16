# Fibonacci — TF-aware Trendline V1

> **영역**: `src/lib/fibonacci-engine.ts`, `src/components/CandleChartLW.tsx`,
> `src/hooks/useFibonacciDetail.ts`, `src/pages/CoinDetail/tabs/v2/CoinChartTab.tsx`,
> `src/pages/FibonacciDetail.tsx`, `src/pages/WaveTrend.tsx`
>
> **commit**: 08c5be2 (5-14, 본 인덱스 baseline — 5-15 의 V2 4086a3a 와 별도)
>
> **분류**: 알고리즘 — TF 별 swing/lookback 분화 + inflection-point anchor

기존 brute-force pair 검색 폐기. **TF-aware** (1h/4h/1d 별 다른 파라미터) +
**inflection-point anchor** (추세 변환 지점부터 새 trendline 시작) + linear
regression best-fit + extrapolation 클리핑.

5-15 의 V2 (commit 4086a3a, RANSAC + LR + 3-tier fallback) 가 본 V1 의
후속 발전. 본 문서는 V1 (08c5be2) 기준.

---

## 사용자 의도 정확히 반영

> "BTC Fibonacci 페이지의 Resistance 추세선이 $323.43 까지 뻗어 나가서 차트가
> 깨진다. 추세선은 변환점부터 시작해서, 고점-고점 / 저점-저점 으로 그어지고,
> TF (1h/4h/1d) 별로 다른 결과가 나와야 한다."

→ V1 알고리즘:
1. `FIB_TF_PARAMS` 로 TF 별 swing/lookback 분화
2. `detectInflectionPoint()` 로 변환점 검출 후 anchor
3. linear regression 으로 best-fit 라인 계산
4. 라인 클리핑 — visibleHigh/Low ±30% 밖으로 안 진행 + endPoint+10 캔들 까지만

---

## 변경 파일

| 파일 | 변경 |
|---|---|
| `src/lib/fibonacci-engine.ts` | ~316L 신규 알고리즘 (V1 entry) |
| `src/components/CandleChartLW.tsx` | +42L — extrapolation 클리핑 + TF 라벨 |
| `src/hooks/useFibonacciDetail.ts` | TF 매핑 (TimeframeValue → FibTimeframe) |
| `src/pages/CoinDetail/tabs/v2/CoinChartTab.tsx` | fib 모드에서 새 엔진 호출 |
| `src/pages/FibonacciDetail.tsx` | tf prop 전달 |
| `src/pages/WaveTrend.tsx` | toFibTrendline — 새 Trendline 필드 채움 |

---

## 핵심 알고리즘

### 1. FIB_TF_PARAMS 테이블

```ts
export const FIB_TF_PARAMS: Record<FibTimeframe, FibTfParams> = {
  "1h": { swingLookback: 5,  trendlineLookback: 120, slopeMaxPctPerCandle: 2.0 },
  "4h": { swingLookback: 5,  trendlineLookback: 90,  slopeMaxPctPerCandle: 1.0 },
  "1d": { swingLookback: 7,  trendlineLookback: 60,  slopeMaxPctPerCandle: 0.7 },
};
```

TF 가 짧을수록 (1h) swing 빈번 + lookback 길게 + slope 관대.
TF 가 길수록 (1d) swing 희소 + lookback 짧게 + slope 엄격.

### 2. detectInflectionPoint(swings, type)

추세 변환 지점 검출 — descending 패턴이 깨지는 지점부터 새 trendline anchor.

```ts
// Resistance trendline 의 경우 — 고점 시퀀스가 descending 인지 검사
function detectInflectionPoint(highs: SwingPoint[], type: "resistance"): SwingPoint | null {
  // 최신 swing 부터 역방향으로 ascending → descending 변환점 찾기
  for (let i = highs.length - 1; i >= 1; i--) {
    if (highs[i].price < highs[i - 1].price) continue;  // descending 유지
    return highs[i + 1] ?? highs[i];  // 변환점 = anchor
  }
  return highs[0] ?? null;
}
```

Support trendline 도 동일 패턴 — 저점 시퀀스가 ascending → descending 변환점.

### 3. linearRegression(points)

기존 brute-force pair 검색 (모든 2-pair 조합) → linear regression best-fit:

```ts
function linearRegression(points: SwingPoint[]): { slope: number; intercept: number; rSquared: number } {
  const n = points.length;
  const sumX = points.reduce((a, p) => a + p.index, 0);
  const sumY = points.reduce((a, p) => a + p.price, 0);
  const sumXY = points.reduce((a, p) => a + p.index * p.price, 0);
  const sumXX = points.reduce((a, p) => a + p.index * p.index, 0);
  const sumYY = points.reduce((a, p) => a + p.price * p.price, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  // R² 계산
  const meanY = sumY / n;
  const ssTot = sumYY - n * meanY * meanY;
  const ssRes = points.reduce((a, p) => a + Math.pow(p.price - (slope * p.index + intercept), 2), 0);
  const rSquared = 1 - ssRes / ssTot;

  return { slope, intercept, rSquared };
}
```

R² 가 낮으면 (예: <0.3) trendline 거부. 본 V1 에서는 단순 slope sanity check
+ R² 메타데이터 보관.

### 4. buildTrendlineFromInflection()

```ts
function buildTrendlineFromInflection(
  candles: Candle[],
  swings: SwingPoint[],
  type: "resistance" | "support",
  tf: FibTimeframe,
): Trendline | null {
  const params = FIB_TF_PARAMS[tf];

  // 1. 변환점 검출
  const anchor = detectInflectionPoint(swings, type);
  if (!anchor) return null;

  // 2. anchor 이후 swing 만 사용
  const relevantSwings = swings.filter(s => s.index >= anchor.index);
  if (relevantSwings.length < 2) return null;

  // 3. linear regression
  const { slope, intercept, rSquared } = linearRegression(relevantSwings);

  // 4. slope sanity check (TF-aware)
  const avgPrice = candles[candles.length - 1].close;
  const maxSlopeAbs = avgPrice * params.slopeMaxPctPerCandle / 100;
  if (Math.abs(slope) > maxSlopeAbs) return null;

  return {
    startIndex: anchor.index,
    startPrice: anchor.price,
    slope,
    intercept,
    rSquared,
    type,
    tf,  // 신규 필드 — 차트 라벨에서 사용
  };
}
```

---

## 렌더링 클리핑 (CandleChartLW)

기존: 라인이 차트 끝까지 무한 extrapolate → BTC 페이지의 Resistance TL 이
$323.43 까지 뻗던 버그.

수정 (+42L):

```tsx
// visibleHigh/Low ±30% 밖으로 라인 안 진행
const visibleHigh = Math.max(...candles.slice(-windowSize).map(c => c.high));
const visibleLow  = Math.min(...candles.slice(-windowSize).map(c => c.low));
const upperBound  = visibleHigh * 1.30;
const lowerBound  = visibleLow  * 0.70;

// endPoint.index + 10 까지만 extrapolate
const renderEnd = Math.min(
  trendline.endPoint.index + 10,
  candles.length - 1,
);

// 라인 계산
const lineData: LineData[] = [];
for (let i = trendline.startIndex; i <= renderEnd; i++) {
  const price = trendline.slope * i + trendline.intercept;
  if (price > upperBound || price < lowerBound) break;  // ✅ 클리핑
  lineData.push({ time: candles[i].openTime / 1000 as Time, value: price });
}
```

### 결과

- BTC Resistance TL 이 정상 클리핑되어 시야 안에서만 표시
- ADAUSDT, ETHUSDT 등 변동성 다른 알트도 정상 (각 페이지의 visibleHigh/Low 기준)
- TF 별 라인이 달라짐 — 같은 BTC 라도 1h / 4h / 1d 가 다른 anchor + slope

---

## Trendline 타입 확장

```ts
export interface Trendline {
  startIndex: number;
  startPrice: number;
  endIndex: number;
  endPrice: number;
  slope: number;
  intercept: number;       // ✅ 신규
  rSquared: number;        // ✅ 신규
  type: "resistance" | "support";
  tf: FibTimeframe;        // ✅ 신규 — 차트 라벨에서 사용
}
```

`tf` 필드로 차트 우측 상단에 **"1h" / "4h" / "1d"** 배지 표시.

---

## useFibonacciDetail — TF 매핑

`useFibonacciDetail.ts` 에 매핑 추가:

```ts
function toFibTimeframe(value: TimeframeValue): FibTimeframe {
  if (value === "1h" || value === "60") return "1h";
  if (value === "4h" || value === "240") return "4h";
  if (value === "1d" || value === "D") return "1d";
  return "4h";  // default
}

const tf = toFibTimeframe(selectedTimeframe);
const fibResult = analyzeFibonacci(candles, tf);  // ✅ tf 전달
```

---

## WaveTrend.tsx — toFibTrendline rebuild

기존 WaveTrend 페이지가 백엔드 `indicators.trendlines` 에 의존. 백엔드가 못
만들면 라인 안 그려짐. V1 후속으로 V2 (4086a3a) 에서 클라이언트 사이드 fallback
추가.

본 V1 에서는 toFibTrendline 헬퍼만 추가 — 새 Trendline 필드 (intercept,
rSquared, tf) 를 채움:

```ts
function toFibTrendline(backend: BackendTrendline, tf: FibTimeframe): Trendline {
  return {
    startIndex: backend.startIndex,
    startPrice: backend.startPrice,
    endIndex: backend.endIndex,
    endPrice: backend.endPrice,
    slope: backend.slope,
    intercept: backend.intercept ?? (backend.startPrice - backend.slope * backend.startIndex),
    rSquared: backend.rSquared ?? 0,
    type: backend.type,
    tf,
  };
}
```

---

## 검증

### BTC Fibonacci 페이지

- **이전**: Resistance TL 이 차트 우측 끝에서 $323.43 까지 뻗어 차트 깨짐
- **이후 V1**: 클리핑되어 visibleHigh × 1.30 안에서만 표시

### TF 변경 시 라인 달라짐

| TF | 결과 |
|---|---|
| 1h | swingLookback 5, lookback 120 → 짧은 라인, 빈번한 anchor 변경 |
| 4h | swingLookback 5, lookback 90 → 중간 |
| 1d | swingLookback 7, lookback 60 → 긴 라인, 안정적 anchor |

### Fibonacci + WaveTrend 양쪽 동작 확인

CoinChartTab (fib 모드) + FibonacciDetail (단독 페이지) + WaveTrend (백엔드
trendlines 사용) 3개 위치 모두 동일 V1 알고리즘.

---

## V2 발전 (commit 4086a3a, 5-15)

본 V1 후속으로 ADAUSDT 4H 저점-저점 라인 미표시 케이스 발견 → V2 알고리즘
신규 작성 (`src/lib/trendline-engine.ts`, 532L).

V2 의 추가 사항:
- **RANSAC + LR 2-pivot 3-tier fallback** — V1 의 단일 LR best-fit 이 실패하면
  RANSAC 으로 재시도, 그것도 실패하면 2-pivot 라인으로 fallback
- **support + resistance 양쪽 항상 보장** — 어느 한쪽 fallback null 이면 마지막
  fallback 단계 적용
- **slopeMaxPctPerCandle 완화** (4H 1.0% → 더 관대) — 변동성 큰 알트 대응
- **findLocalSwingPoints 의 strict 부등호 완화** — 동가 swing 도 인정
- **Fibonacci 페이지 + Wave Tracker Trend Analysis 양쪽에 동일 V2 적용**

V2 의 자세한 알고리즘은 별도 docs 예정 (본 V1 의 후속).

---

## 후속 작업

- **V2 안정성 모니터링** — V2 (4086a3a) 후 추가 케이스 발생 시 V3 fallback 검토.
- **R² 임계값 도입** — 현재 V1/V2 모두 R² 메타데이터만 보관. 0.3 이하면 라인
  거부 또는 dotted-line 표시 검토.
- **Fibonacci levels + Trendline 통합 시각화** — 현재 별도 series 로 표시.
  Trendline 와 Fib level 의 교차점에 신호 마커 추가 검토.

---

작성: 2026-05-17
