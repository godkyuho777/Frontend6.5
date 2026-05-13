# SCHEDULE_DEFERRED — Cross-cutting Defer 사본

> **출처**: `Trade LAB/docs/SCHEDULE_DEFERRED.md` (워크스페이스 레벨)
> **사본**: 양쪽 repo 검색성을 위해 본 파일에 복제. 백엔드 사본 = `tradelab-backend/docs/2026-05-13/01_SCHEDULE_DEFERRED.md` (동일 내용).

---

## 🔴 즉시 결정 대기

### D-001 — v6.6 finalScore 에 4 modifier 통합 여부
Funding Extreme / Market Breadth / Order Block / MACD Divergence — v6.6 `evaluatePositionSignalsV66` 의 finalScore 곱셈에 자동 통합 여부.

**옵션**:
- (A) 합치기 — `modifiersMult` 자동 계산
- (B) 현 상태 유지 — 컨텍스트 정보로만
- (C) Feature Flag 토글

---

## 🟠 외부 의존성 대기

### D-002 — JEON_IN_GU Phase 1.3 ~ 7
- 변호사 검토 (명예훼손)
- YouTube Data API v3 key
- Anthropic API key
- Telegram Bot Token + Chat ID
- 전인구 채널 ID 확인

### D-003 — Drizzle 0005 + 0006 Production 적용
- Supabase Dashboard SQL Editor

### D-004 — Production 환경변수 등록
- Railway: BBDX_VERSION=v6.6, BBDX_MARKET=perp, ENABLE_SHORT_SIGNALS=true
- GitHub Secrets: DATABASE_URL / DIRECT_URL

---

## 🟡 후속 작업

### D-005 — Phase α calibration 자체 데이터 누적
- signals.publish mutation (P0-3) 활성 → 3-6개월 누적

### D-006 — vwap/wave compose macro modifier 통합 (D-001 결정 후)

### D-007 — BBDX v6.5 deprecation (v6.6 안정 후)

### D-008 — 트래커 5-탭 마이그레이션 (완료/대기)
**완료**: JEON_IN_GU / CoinDetail 6-탭 / 트래커 컨텍스트 인식
**대기**: BBDX v6.6 / VP+Trend / Macro / Wave / Onchain Tracker

### D-009 — Fibonacci + VWAP 백테스트 strategy 파라미터 (프론트 영향)
**상태**: CoinBacktestTab 에 트래커 컨텍스트 전달됨. 백엔드 `trpc.backtest.run` 미지원 → placeholder.

**필요**: 백엔드 input 에 `strategy: z.enum(["bbdx","fibonacci","vwap"])` 추가 + runner 분기. 1-2시간.

---

## 📅 권장 일정
- 이번 주: D-001 결정 + D-003 SQL + D-004 환경변수
- 2주: D-002 외부 준비
- 3주: JEON_IN_GU Phase 1.3 ~ 5
- 1개월: internal test
- 3개월: Phase α calibration / v6.5 deprecation

---

작성: 2026-05-13
