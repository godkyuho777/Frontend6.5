/**
 * Vitest config (P2-#15, 2026-05-23) — frontend pure-function 단위 테스트.
 *
 * 정책:
 *   - `src/lib/**` 의 pure 함수 (sim-pnl, indicators-client, trend-analysis 등)만 1차 target.
 *   - React 컴포넌트 테스트 (jsdom + RTL) 는 별도 작업 (P3+).
 *   - vite 의 path alias (`@/`, `@shared/`) 동일하게 적용.
 *   - exclude: node_modules, dist, dist/types (백엔드 d.ts 미러).
 *
 * 실행:
 *   pnpm test          # watch
 *   pnpm test:run      # single-shot CI 용
 */
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@shared": path.resolve(import.meta.dirname, "src", "shared"),
    },
  },
  test: {
    globals: false, // describe / test / expect 명시 import 강제 (백엔드와 일관성)
    environment: "node", // sim-pnl 등 DOM-free 모듈 — jsdom 불필요
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules/**", "dist/**", "**/__e2e__/**"],
    reporters: process.env.CI ? ["default"] : ["verbose"],
  },
});
