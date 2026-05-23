# tradelab-frontend

React 19 + Vite 7 + tRPC 11 + Tailwind 4 + shadcn UI for **Tradelab**.
Lite (일반인) / Pro (전문가) dual-mode, Investment Simulator (모의투자),
Onchain 페이지, Backtest UI.

- **Runtime**: TypeScript 5.9.3, `pnpm@10.4.1`
- **Stack**: React 19 · Vite 7 · TanStack Query · wouter · Tailwind 4 ·
  shadcn UI · Recharts · lightweight-charts
- **Auth**: Supabase (env 미설정 시 no-op stub)
- **Deploy**: Vercel (rewrite `/api/*` → Railway backend)

---

## Local development

```bash
cp .env.example .env   # fill in Supabase project keys (선택)
pnpm install
pnpm dev               # http://localhost:5173, /api proxied to :3000
```

Dev 서버는 `/api/*` 를 `VITE_DEV_API_URL` (default `http://localhost:3000`) 로
프록시. `tradelab-backend` 를 먼저 띄우세요.

### Tests (P2-#15)

```bash
pnpm test          # vitest watch
pnpm test:run      # 단일 실행 (CI 용)
```

현재 lib/sim-pnl 의 45 unit tests 가 있음. 추가 모듈 (indicators-client,
trend-analysis, useMarketData) 은 점진 도입 중.

### Type check + build

```bash
pnpm check         # tsc --noEmit
pnpm build         # Vite production build (= Vercel build 환경)
```

---

## Type sharing with backend

백엔드의 `AppRouter` 를 로컬에서는 file link, 배포 시 git URL 로 받는다.

**로컬 개발**:
```jsonc
// package.json
"@tradelab/backend": "file:../tradelab-backend"
```

**배포 직전** (pre-push 훅이 file:.. 잔존을 차단):
```jsonc
"@tradelab/backend": "github:godkyuho777/6.5SUM#main"
```

백엔드의 `dist/types/` 는 git 에 commit 되어 있어 Vercel install 시 prepare
훅 없이도 즉시 d.ts resolve.

P2-#10: `src/lib/verify-deps.ts` 가 dev 환경에서 `file:..` scheme 을 감지하여
콘솔 경고 (Vercel 빌드 깨짐 사전 방지).

---

## 페이지 구성

### Pro 모드 (12 페이지, `DashboardLayout`)
- `/` Home (스캔 결과)
- `/coin/:symbol` 단일 코인 상세
- `/fibonacci`, `/vwap`, `/wave/*`, `/tech-tracker`
- `/positions`, `/history`, `/alerts`, `/ai`, `/backtest`, `/onchain`

### Lite 모드 (5 페이지, `LiteLayout`)
- `/lite` Dashboard (시장 분위기 + top buy/sell)
- `/lite/coin/:symbol` 단일 추천 + 위험도
- `/lite/portfolio` (protected)
- `/lite/learn` 학습 카드
- `/lite/alerts` (protected)

신규 방문자는 ModeRedirector 가 `/lite` 로 redirect (`localStorage.tradelabMode`
기억).

### Investment Simulator (`/simulator`)
$200,000 가상 자본, 닉네임 기반 익명 (UUID + nickname in localStorage), Bybit
3-column 레이아웃 (chart + orderbook + trade form), 9 timeframes, 시장가는
ticker.lastPrice 정확 체결 (SLIPPAGE_PCT=0, P2-#15 회귀 lock).

---

## Deploy (Vercel)

1. `vercel.json` `destination` 을 Railway 도메인으로 (`https://<RAILWAY>/api/:path*`).
2. `package.json` 의 `@tradelab/backend` 를 git URL 로 변경.
3. GitHub push → Vercel auto-deploy.
4. Env vars (Vercel dashboard):
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (Supabase 사용 시).
   - `VITE_DEV_API_URL` 는 production 에서 사용 X (rewrite 가 처리).
5. Deployment Protection 해제 (Production 공개 시).

---

## 헌장 (Lite 모드 영역)

- **Lite translator** 는 BBDX 시그널의 *번역* 만 — 새 시그널 산출 X.
- **자본 보호**: blocked 상태에서 Lite UI 가 BUY 표시 절대 X.
- **dual-mode 일관성**: Pro 와 Lite 는 같은 `applyOnchainToEntry → translator`
  체인 사용. Pro 는 raw 지표, Lite 는 자연어 라벨.

자세한 헌장은 `STRATEGY_CHARTER.md` + backend `CLAUDE.md` 참고.
