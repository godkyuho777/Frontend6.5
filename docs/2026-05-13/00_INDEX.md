# 2026-05-13 프론트엔드 작업 인덱스

> 오늘 프론트엔드 (`tradelab-frontend`) 에서 진행한 작업.
> 백엔드 작업은 `tradelab-backend/docs/2026-05-13/` 참조.

---

## 작업 목록

| # | 파일 | 영역 | 핵심 |
|---|---|---|---|
| 01 | [SCHEDULE_DEFERRED.md](./01_SCHEDULE_DEFERRED.md) | 일정 | D-001~D-009 미룬 결정 사항 (cross-cutting 사본) |
| 02 | [TRACKER_TAB_STANDARD.md](./02_TRACKER_TAB_STANDARD.md) | 컴포넌트 | TrackerTabs 공통 컴포넌트 + 5 표준 탭 인터페이스 |
| 03 | [JEON_IN_GU_PAGE_AND_SIDEBAR.md](./03_JEON_IN_GU_PAGE_AND_SIDEBAR.md) | 페이지 | /trackers/jeon-in-gu Phase 6 placeholder + 사이드바 재구성 |
| 04 | [COIN_DETAIL_6TAB.md](./04_COIN_DETAIL_6TAB.md) | 리팩터 | CoinDetail 6-탭 (코인 정보 NEW + 매매기준 + 실시간 신호 + 차트 + 백테스트 + 히스토리) + 트래커 컨텍스트 인식 |

---

## 통계 (프론트엔드)

### Commits (오늘 14건)
```
c13dc66 feat(coin-detail): tracker selector in CoinDetail header
f8922ee feat(coin-detail): tracker-aware CoinBacktestTab strategy parameter
05cc5e2 feat(coin-detail): tracker-aware CoinChartTab indicators + ChartZone props
826fbdb feat(coin-detail): tracker-aware CoinSignalTab (per-tracker data + hooks)
98a4251 feat(coin-detail): tracker-aware CoinCriteriaTab (BBDX/Fibonacci/VWAP rules)
519cc0b feat(navigation): add ?tracker= param to coin clicks from Home/Fibonacci/VWAP
3eea6b4 fix(navigation): unify Fibonacci + VWAP coin clicks to /coin/:symbol (6-tab)
61d142b feat(coin-detail): refactor to 6-tab structure (코인 정보 NEW)
b59656c revert(signals): remove TrackerTabs wrapper from Fibonacci + VWAP
9d1defe feat(routing): /vwap → VwapTrackerPage 5-탭 wrapper (later reverted)
954c4cb feat(signals): migrate VWAP to TrackerTabs 5-tab (later reverted)
da9778b feat(signals): migrate Fibonacci to TrackerTabs 5-tab (later reverted)
0c7823e feat(sidebar): 전인구 시그널 → Signal Scanner 그룹 이동, Trackers 그룹 제거
d0882f9 feat(sidebar): Trackers group + 전인구 시그널 (Beta) menu item
```

### 신규 파일
- `src/components/trackers/TrackerTabs.tsx` (187L) — 공통 컴포넌트
- `src/components/trackers/tabs/{Criteria,Signal,Chart,Backtest,History}Tab.tsx` (1,387L 총) — 5 표준 탭
- `src/pages/trackers/jeon-in-gu/` (8 file) — Phase 6 placeholder
- `src/pages/CoinDetail/index.tsx` (재작성, 79L)
- `src/pages/CoinDetail/tabs/v2/{CoinInfo,CoinCriteria,CoinSignal,CoinChart,CoinBacktest,CoinHistory}Tab.tsx` (1,389L 총)
- `src/pages/CoinDetail/tracker-context.ts` (52L)

### 수정 파일
- `src/components/DashboardLayout.tsx` — 사이드바 재구성
- `src/App.tsx` — 라우팅
- `src/pages/Home.tsx` — `?tracker=bbdx` 파라미터
- `src/pages/Fibonacci.tsx` — `/coin/:symbol?tracker=fibonacci`
- `src/pages/Vwap.tsx` — `/coin/:symbol?tracker=vwap`

---

## 5-Ref Push 완료

| Repo | 브랜치 | SHA |
|---|---|---|
| `tradelab-hq/tradelab-frontend` | `dev` | `c13dc66` |
| `tradelab-hq/tradelab-frontend` | `feat/v6.5-merge-frontend` | `c13dc66` |
| `godkyuho777/Frontend6.5` | `dev` | `c13dc66` |
| `godkyuho777/Frontend6.5` | `feat/v6.5-merge-frontend` | `c13dc66` |
| `godkyuho777/Frontend6.5` | `main` | `c13dc66` |

---

## 핵심 변경 — 사용자 의도 정확히 반영

### 1. 사이드바
- "Trackers" 그룹 제거
- "전인구 시그널 (Beta)" → Signal Scanner 그룹 끝 (4번째)
- 최종 Signal Scanner: 4 children (RSI/BB/ADX, Fibonacci, VWAP, 전인구)

### 2. CoinDetail 6-탭 (`/coin/:symbol`)
모든 트래커의 코인 클릭이 통일된 6-탭 페이지로 이동:
```
[코인 정보 ★NEW] [매매기준] [실시간 신호] [차트] [백테스트] [히스토리]
```

### 3. 트래커 컨텍스트 인식
`?tracker=` URL 파라미터로 각 탭이 트래커별 콘텐츠:

| 트래커 | URL | 매매기준 | 차트 | 백테스트 |
|---|---|---|---|---|
| BBDX | `?tracker=bbdx` | RSI/BB/ADX 3-path | RSI+BB+ADX overlay | ✅ wired |
| Fibonacci | `?tracker=fibonacci` | Fib 38.2/50/61.8 + 추세선 | Fib levels + trendlines | ⚠ placeholder |
| VWAP | `?tracker=vwap` | 5-component (25/20/25/15/15) | VWAP+EMA+±σ+VP | ⚠ placeholder |

---

## 헌장 준수

| 규칙 | 결과 |
|---|---|
| R1/R2/R3 | N/A — UI 표시만, 시그널 발행 X |

graceful fallback — 백엔드 라우트 없거나 keys 없어도 placeholder 카드 표시.

---

## 후속 작업

- D-009 — 백엔드 `trpc.backtest.run` 에 `strategy` 파라미터 추가 → Fib/VWAP 백테스트 fully wired
- D-008 — BBDX v6.6 / VP+Trend / Macro / Onchain Tracker 5-탭 마이그레이션

작성: 2026-05-13
