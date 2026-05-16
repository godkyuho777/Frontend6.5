# Deployment Patterns — Push + 디버깅 메모

> **영역**: `scripts/push-mirrors.mjs`, git refs 복구, FRED_API_KEY 검증
> 시나리오
>
> **분류**: 운영 — 5-ref push 패턴 + OneDrive 충돌 사건 기록 + Macro
> 시각 검증

본 문서는 5-15 ~ 5-17 사이에 발생한 운영 이슈 + push 패턴 + 시각 검증 시나리오
기록.

---

## 5-Ref Push 패턴

### 대상 5개 ref

```
1. origin/dev                          ← tradelab-hq/tradelab-frontend
2. origin/feat/v6.5-merge-frontend     ← tradelab-hq/tradelab-frontend
3. fe65/dev                            ← godkyuho777/Frontend6.5
4. fe65/feat/v6.5-merge-frontend       ← godkyuho777/Frontend6.5
5. fe65/main (optional)                ← godkyuho777/Frontend6.5 prod
```

origin = `tradelab-hq/tradelab-frontend` (Vercel preview).
fe65 = `godkyuho777/Frontend6.5` (개인 미러 + 백엔드 git URL 의존성 소스).

### `pnpm push:mirrors` 사용법

```bash
cd tradelab-frontend
pnpm push:mirrors           # 스크립트: scripts/push-mirrors.mjs
```

스크립트 흐름:
1. `git rev-parse HEAD` 로 현재 dev 의 SHA 확인
2. origin/dev → origin/feat → fe65/dev → fe65/feat → fe65/main 순서로 push
3. 각 push 후 응답 코드 검사 → 실패 시 다음 ref 진행 (전체 fail 후 종합 리포트)

### Working tree dirty 시 패턴

```bash
git stash push -m "WIP — push 직전"
pnpm push:mirrors
git stash pop
```

만약 stash 중 conflict 발생:
```bash
git stash apply  # pop 대신 apply 로 stash 보존
# 충돌 수동 해결
git stash drop
```

---

## OneDrive Git Refs 손상 사건 (5-15 발생)

### 증상

`git push` 실행 시 다음 에러:
```
error: refs/heads/dev does not point to a valid object!
fatal: bad ref for refs/heads/dev
```

`git status` 가 정상 동작하지만 `git log` 가 hang 또는 빈 응답.

### 진단

`git fsck --no-progress` 실행:
```
error: refs/heads/dev: invalid sha1 pointer 0000...0000
error: refs/remotes/origin/dev: invalid sha1 pointer 0000...0000
error: refs/remotes/fe65/dev: invalid sha1 pointer 0000...0000
```

→ `.git/refs/heads/dev` 파일이 **40 bytes of 0x00** 로 손상.
   `.git/refs/remotes/origin/dev`, `.git/refs/remotes/fe65/dev` 동일 증상.

### 원인 추정

OneDrive sync 가 git pack file rewrite 중 partial write 로 ref 파일을 잘못
복원. Trade LAB 폴더가 OneDrive 동기화 폴더 안에 있음:
```
C:\Users\godky\OneDrive\바탕 화면\Trade LAB\tradelab-frontend\.git\refs\
```

### 복구 절차

1. **reflog 에서 SHA 확보** (refs 손상 전 마지막 정상 상태):
```bash
git reflog show dev | head -5
# d3a2b1f HEAD@{0}: commit: feat(macro): ...
```

2. **refs 파일 직접 작성**:
```bash
# Bash
printf "d3a2b1f\n" > .git/refs/heads/dev
printf "d3a2b1f\n" > .git/refs/remotes/origin/dev
printf "d3a2b1f\n" > .git/refs/remotes/fe65/dev
```

또는 PowerShell:
```powershell
"d3a2b1f`n" | Out-File -Encoding ascii .git/refs/heads/dev
```

3. **검증**:
```bash
git fsck --no-progress   # 에러 없으면 OK
git log --oneline -3     # 정상 응답
```

4. **fetch 로 origin/fe65 ref 재동기화**:
```bash
git fetch origin
git fetch fe65
```

### 미래 대비

- **OneDrive 외부로 repo 이동 권장** — 예: `C:\dev\Trade LAB\`.
  현재 위치는 OneDrive 폴더 안 (`C:\Users\godky\OneDrive\바탕 화면\Trade LAB\`).
- 또는 OneDrive 동기화에서 `.git/` 폴더 제외 (OneDrive 설정 → 제외 폴더).
- 정기적 `git fsck` 실행 — 손상 사전 감지.

---

## Macro 작업의 옵션 진행 순서

### 옵션 1 — fraction → % fix (Phase 4, ff11f84)

**상황**: FRED_API_KEY 등록 후 LIVE 전환하면 카드에 `0.00%` 만 표시.

**진단**: 백엔드 layer 가 `walcl_change_30d_pct = 0.0034` (fraction) 응답.
프론트는 `unit: "%"` + `toFixed(2)` 로 `0.00%` 출력.

**fix**:
```ts
formatValue: (v: number) => `${(v * 100).toFixed(2)}%`
```

### 옵션 2 — C3/C4 history 라인 추가

**상황**: Yield Curve 페이지의 C4 Cycle Phase categorical 카드는 정상 표시.
하지만 차트에 phase 변환 시점 시각화 없음.

**진행 안 함** (본 인덱스 외) — 후속 작업으로 분리. C4 phase 가 string 이라
차트 라인 추가 시 별도 step plot 또는 vertical line 마커 필요.

### 순서

1. Phase 1 (공통 인프라) → 2 (SOFR 검증) → 3 (4 페이지 wiring) → 4 (% fix)
   → 5 (Interpretation fix) → FRED_API_KEY 등록 → 시각 검증.
2. 옵션 2 (C4 history) 는 별도 트랙 — 본 일일 작업 외.

---

## FRED_API_KEY 등록 후 5/5 페이지 LIVE 검증 시나리오

### 등록 절차

1. https://fred.stlouisfed.org/docs/api/api_key.html 에서 무료 발급
2. 발급된 키: `dc265ead40d97967378f93411494589f`
3. `tradelab-backend/.env` 에 추가:
   ```env
   FRED_API_KEY=dc265ead40d97967378f93411494589f
   ```
4. 백엔드 재시작 (`pnpm dev`)
5. 프론트엔드 페이지 5개 새로고침

### 검증 결과

| 페이지 | URL | 이전 (STUB) | 이후 (LIVE) |
|---|---|---|---|
| SOFR-IORB | `/macro/sofr-iorb` | "—" + STUB 안내 | **-6 bp**, TIGHT (×0.65) |
| WALCL | `/macro/walcl` | "—" + STUB 안내 | **$7.18 T**, 30d Change **+0.34%** (Phase 4 후) |
| Yield Curve | `/macro/yield-curve` | "—" + STUB 안내 | (FRED 값), C4 Cycle Phase **categorical 색상 표시** |
| DXY / VIX | `/macro/dxy-vix` | "—" + STUB 안내 | DXY 30d **-0.86%** (Phase 4 후), VIX Level |
| Real Rate | `/macro/real-rate` | "—" + STUB 안내 | DFII10 (FRED 값), Breakeven 10Y **derived 표시** |

### 5/5 LIVE 통합 매크로 환경

- **regime: TIGHT (×0.65 multiplier)**
- **macro_score: -40**
- 모든 BBDX 진입 base 점수에 ×0.65 적용 → 보수적 시그널 환경

### Phase 4/5 fix 효과 확인

| 카드 | Phase 4 전 | Phase 4 후 |
|---|---|---|
| WALCL 30d Change | 0.00% | **+0.34%** |
| DXY 30d Change | -0.01% | **-0.86%** |
| Net Liquidity 30d | 0.00% | (정확 환산) |

| Interpretation 텍스트 | Phase 5 전 | Phase 5 후 |
|---|---|---|
| C3 net liquidity 분석 | "0.003%" | **"0.34%"** (정상 표시) |

---

## Dual-Mode 의존성 처리

### 로컬 개발 (Macro 작업 중)

`tradelab-frontend/package.json`:
```json
"@tradelab/backend": "file:../tradelab-backend"
```

→ `pnpm install` 시 백엔드 워크스페이스의 d.ts 를 직접 사용. `trpc.macroV2.snapshot`
의 타입이 백엔드 변경 즉시 반영.

### 푸시 직전 — git URL 되돌림

```json
"@tradelab/backend": "git+https://github.com/godkyuho777/Backend6.5.git#dev"
```

→ Vercel 빌드용. 백엔드 dev 브랜치 push 가 먼저 완료된 후 프론트 push.

### pre-push 훅 검사

`.husky/pre-push` 가 `package.json` 의 `"file:.."` 패턴 검사:
```bash
if grep -q '"file:\.\.' package.json; then
  echo "[pre-push] @tradelab/backend 가 file:.. 로 설정됨 — git URL 로 되돌리고 다시 시도"
  exit 1
fi
```

`pnpm install` 후 `pnpm-lock.yaml` 도 같이 git URL 로 갱신되어야 함.
의존성 변경 안 했을 때는 lockfile 폐기:
```bash
git checkout pnpm-lock.yaml
```

---

## 후속 작업

- **OneDrive 외부로 repo 이동** — 우선순위 높음. 본 사건 재발 방지.
- **`pnpm push:mirrors` 의 dry-run 모드** — push 전 5 ref SHA 확인 + 사용자
  승인. 현재는 즉시 push.
- **FRED_API_KEY 한도 알림** — Free tier 1000/day 도달 시 백엔드가 freshness
  STALE 자동 표시. 사용자에게 Slack/Telegram 알림 검토.
- **Vercel preview URL 자동 캡처** — push 후 Vercel 빌드 완료 시 preview URL
  을 PR 코멘트에 자동 추가.

---

작성: 2026-05-17
