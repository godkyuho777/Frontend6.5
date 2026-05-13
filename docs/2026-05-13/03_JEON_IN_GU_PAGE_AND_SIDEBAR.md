# /trackers/jeon-in-gu Phase 6 페이지 + 사이드바 재구성

> **명세서**: JEON_IN_GU_SIGNAL_TRACKER.md Phase 6
> **본 작업**: 5-탭 placeholder 페이지 + Signal Scanner 그룹 이동

---

## 1. 페이지

`src/pages/trackers/jeon-in-gu/index.tsx` (51L) — TrackerTabs wrapper:

```tsx
<TrackerTabs
  trackerName="전인구 시그널"
  trackerSubtitle="6차원 거시 / Contrarian Modifier (역지표)"
  defaultTab="signal"
>
  {(tab) => {
    case "criteria": return <CriteriaTab />;
    case "signal":   return <SignalTab />;
    case "chart":    return <ChartTab />;
    case "backtest": return <BacktestTab />;
    case "history":  return <HistoryTab />;
  }}
</TrackerTabs>
```

---

## 2. 5 탭 컴포넌트

`src/pages/trackers/jeon-in-gu/tabs/`:

### CriteriaTab.tsx (110L) — **fully wired**
- 정적 룰 + 가중치 ±0.50 ⚠ 강조
- LONG/SHORT 진입 조건
- 안전 장치 4개 (confidence ≥ 0.7 / 36h decay / BBDX 최종 ≥ 50 / 자동 calibration)
- 헌장 통과 (R1/R2/R3)

### SignalTab.tsx (57L) — **placeholder**
`trpc.jeonInGu.currentModifier.useQuery({symbol, side})` 호출.
- `isJeonInGuEnabled()` false → "Phase 1.3+ pending" 안내 카드
- API keys + 변호사 검토 조건 명시

### ChartTab.tsx (69L) — placeholder
"Phase 4 VP+Trend chart 구현 대기"

### BacktestTab.tsx (72L) — placeholder
"Phase 5 백테스트 데이터 누적 대기"

### HistoryTab.tsx (64L) — **partially wired**
`trpc.jeonInGu.recentContents.useQuery({limit: 20})` 호출. 데이터 없으면 "Phase 1.5 polling cron 활성 후 누적됨" 안내.

---

## 3. PhasePendingCard 공통 컴포넌트

`src/pages/trackers/jeon-in-gu/components/PhasePendingCard.tsx` (81L):

모든 placeholder 카드에 표시:
- "⚠ 가중치 ±0.50 = BBDX 100점 시스템에 최대 ±50점 영향"
- "활성 조건: YOUTUBE_API_KEY + ANTHROPIC_API_KEY + JEON_IN_GU_CHANNEL_ID + 변호사"
- "Schedule: docs/SCHEDULE_DEFERRED.md D-002"

---

## 4. 사이드바 재구성

### Before
```
Signal Scanner ▼ (3 children)
├── RSI / BB / ADX
├── Fibonacci & Trendline
└── VWAP Strategy

Trackers ▼ (1 child, 비효율)
└── 전인구 시그널 (Beta)
```

### After
```
Signal Scanner ▼ (4 children)
├── RSI / BB / ADX           → /
├── Fibonacci & Trendline    → /fibonacci
├── VWAP Strategy            → /vwap
└── 전인구 시그널 (Beta)      → /trackers/jeon-in-gu  ★ 이동
```

**Trackers 그룹 제거** — 사용자 직관성 ↑.

---

## 5. App.tsx 라우팅

```tsx
<Route path="/trackers/jeon-in-gu" component={JeonInGuTrackerPage} />
```

기존 라우트 변경 X. URL 호환성 유지.

---

## 6. 검증

- pnpm check PASS
- pnpm build 성공
- 콘솔 에러 0

---

## 7. Commits

```
0c7823e feat(sidebar): 전인구 시그널 → Signal Scanner 그룹 이동, Trackers 그룹 제거
d0882f9 feat(sidebar): Trackers group + 전인구 시그널 (Beta) menu item
```

(첫 commit 은 Trackers 그룹을 만들었지만 이후 사이드바 재구성으로 제거됨)

---

작성: 2026-05-13
