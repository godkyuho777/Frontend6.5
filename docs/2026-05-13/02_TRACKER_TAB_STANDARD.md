# TRACKER_TAB_STANDARD — 공통 5-탭 컴포넌트

> **명세서**: `TRACKER_TAB_STANDARD.md` (사용자 다운로드)
> **목적**: 모든 시그널 트래커가 동일한 5-탭 구조 사용 → 사용자 학습 곡선 ↓, 코드 재사용성 ↑
> **확장**: 본 작업 후 6-탭 CoinDetail 도 동일 컴포넌트 사용 (custom tabs override)

---

## 1. 5 표준 탭

```
[📋 매매기준] [🔔 실시간 신호] [📊 차트] [🧪 백테스트] [📚 히스토리]
```

각 탭의 표준 콘텐츠 (TRACKER_TAB_STANDARD §2):
- **매매기준**: 진입/청산 룰 + 가중치 표 + 임계 + 안전 장치 + 헌장 통과
- **실시간 신호**: PrimarySignalCard + Breakdown + Active Modifiers + 가격 + sparkline
- **차트**: TF/타입 셀렉터 + 메인 차트 + legend + 분석 텍스트
- **백테스트**: 메트릭 grid + 누적 수익 + Modifier 영향 + calibration history + baseline 비교
- **히스토리**: 날짜/타입 필터 + Timeline

---

## 2. TrackerTabs 공통 컴포넌트

**파일**: `src/components/trackers/TrackerTabs.tsx` (187L)

```tsx
export const STANDARD_TABS = [
  { id: "criteria", label: "매매기준", icon: ClipboardList },
  { id: "signal",   label: "실시간 신호", icon: Bell },
  { id: "chart",    label: "차트", icon: BarChart3 },
  { id: "backtest", label: "백테스트", icon: FlaskConical },
  { id: "history",  label: "히스토리", icon: History },
] as const;

interface TrackerTabsProps {
  trackerName: string;
  trackerSubtitle?: string;
  tabs?: ReadonlyArray<TrackerTab>;  // ★ override 가능 (custom 6-tab 등)
  defaultTab?: string;
  headerRight?: React.ReactNode;     // selector 등
  children: (activeTab: string) => React.ReactNode;
}
```

### 핵심 기능
- **URL 동기화** — `?tab=criteria` 등으로 deeplink 가능
- **wouter 라우터** (next/router 아님) — `useLocation` + `useSearch`
- **모바일 가로 스크롤** — 작은 화면에서 탭 슬라이드
- **shadcn/ui + Tailwind** — neon-pink active border
- **Custom tabs override** — CoinDetail 의 6-탭 같은 확장 지원

---

## 3. 5 표준 탭 인터페이스 (Generic Props)

**디렉토리**: `src/components/trackers/tabs/`

### CriteriaTab.tsx (240L)
```tsx
interface CriteriaTabProps {
  entry_rules: { long: string[]; short: string[] };
  weights: { name: string; value: number; highlight?: boolean; warning?: string }[];
  weights_source_note?: string;
  thresholds: Record<string, string | number>;
  safety_mechanisms: string[];
  exit_rules: string[];
  charter_compliance: { rule: 1|2|3|"V"; status: "pass"|"warn"|"fail"; label: string }[];
}
```

### SignalTab.tsx (322L)
- PrimarySignalCard (side + confidence + threshold + status)
- Breakdown chart
- Active modifiers (name + value + source + decay)
- 가격 표 (entry / stop / targets)
- Sparkline (6h history)

### ChartTab.tsx (164L)
- TFSelector / ChartTypeSelector
- MainChart slot (tracker 별)
- Legend
- 현재 시점 분석

### BacktestTab.tsx (293L)
- Period / Symbol selector + "지금 백테스트" 버튼
- Metrics grid (winRate / avg / Sharpe / MDD / signals + CI)
- 누적 수익 (baseline vs with modifier)
- Modifier 영향도
- Calibration history
- 학술 baseline 비교 (Buy-and-hold, SMA, Random)
- ⚠ 면책 라벨

### HistoryTab.tsx (318L)
- Date range / Type filter
- Timeline (entry / source / calibration cards)
- Pagination

### tabs/index.ts (50L)
Barrel export.

---

## 4. 사용 예시 (JEON_IN_GU)

```tsx
import { TrackerTabs } from "@/components/trackers/TrackerTabs";

export default function JeonInGuTrackerPage() {
  return (
    <TrackerTabs
      trackerName="전인구 시그널"
      trackerSubtitle="6차원 거시 / Contrarian Modifier (역지표)"
      defaultTab="signal"
    >
      {(tab) => {
        switch (tab) {
          case "criteria": return <CriteriaContent />;
          case "signal":   return <SignalContent />;
          case "chart":    return <ChartContent />;
          case "backtest": return <BacktestContent />;
          case "history":  return <HistoryContent />;
        }
      }}
    </TrackerTabs>
  );
}
```

---

## 5. 사용 예시 (CoinDetail — 6-탭 override)

```tsx
const COIN_DETAIL_TABS = [
  { id: "info", label: "코인 정보", icon: Info },        // ★ NEW
  { id: "criteria", label: "매매기준", icon: ClipboardList },
  { id: "signal", label: "실시간 신호", icon: Bell },
  { id: "chart", label: "차트", icon: BarChart3 },
  { id: "backtest", label: "백테스트", icon: FlaskConical },
  { id: "history", label: "히스토리", icon: History },
] as const;

<TrackerTabs
  trackerName={`${baseSymbol} / USDT — ${trackerName}`}
  defaultTab="signal"
  tabs={COIN_DETAIL_TABS}  // ★ override
  headerRight={<TrackerSelector value={tracker} onChange={...} />}
>
  ...
</TrackerTabs>
```

---

## 6. 검증

- pnpm check PASS
- pnpm build 성공
- URL `?tab=...` 동기화 동작
- 모바일 가로 스크롤 동작

---

작성: 2026-05-13
