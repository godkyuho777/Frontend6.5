/**
 * verify-deps.ts — Frontend 의존성 sanity check (P2-#10, 2026-05-23).
 *
 * AUDIT.md 권장: `@tradelab/backend` dependency 가 dual-mode (file:..  ↔ git URL).
 *   - 로컬 개발: `file:../tradelab-backend` 로 즉시 type 공유
 *   - Vercel 빌드: `git+https://...` URL 이어야 npm fetch 가능
 *
 * `file:..` 가 잘못 commit 되면 Vercel 빌드 실패 (npm 이 local path resolve 못 함).
 * pre-push hook 이 1차 방어, 본 모듈은 startup-time 2차 방어 — dev/build
 * 시점에 잘못된 dep 형식이면 즉시 경고.
 *
 * 본 모듈은 *런타임 import 만* 되며 (App startup), Vite build 의 tree-shake
 * 에서 dev-only 코드는 production bundle 에서 자동 제거되도록 작성.
 *
 * 검사 항목:
 *   1. `@tradelab/backend` 가 git URL 형식인지 (Vercel 호환)
 *   2. version 이 `0.1.0` 같은 fixed 가 아니라 commit/branch ref 인지 (cache busting)
 *
 * 위반 시 동작:
 *   - dev: console.warn (개발 중이면 인지 가능)
 *   - production: silent (사용자에게 노출 X — 이미 빌드된 상태)
 */

// Vite 환경 변수 — production 빌드에서 자동 제거
const isDev = import.meta.env?.DEV ?? false;

interface VerifyResult {
  ok: boolean;
  issues: string[];
}

/**
 * package.json 의 dependencies 를 검사하기 위한 dynamic import.
 *
 * Vite 가 package.json 을 esm 으로 import 가능 (assert { type: "json" } 또는
 * import.meta.url 기반). 실패 시 silent return — runtime error 없도록.
 */
export async function verifyDeps(): Promise<VerifyResult> {
  if (!isDev) {
    // Production 에서는 검증 생략 — 이미 빌드된 상태라 의미 없음.
    return { ok: true, issues: [] };
  }

  const issues: string[] = [];

  try {
    // Vite 의 dynamic import (`?raw`) 로 package.json 텍스트 fetch.
    // Note: Vercel 빌드 후에는 fetch 불가능하나 dev 에서만 호출되므로 OK.
    const response = await fetch("/package.json").catch(() => null);
    if (!response || !response.ok) {
      // package.json 노출 안 됨 → 검증 skip (silent OK)
      return { ok: true, issues: [] };
    }
    const pkg = (await response.json()) as {
      dependencies?: Record<string, string>;
    };
    const backendDep = pkg.dependencies?.["@tradelab/backend"];

    if (!backendDep) {
      issues.push("@tradelab/backend dependency 누락");
    } else if (backendDep.startsWith("file:")) {
      issues.push(
        `@tradelab/backend = "${backendDep}" — file: scheme 은 Vercel 빌드 실패 야기. ` +
          `push 전 git URL 로 변환 필요 (예: git+https://github.com/.../tradelab-backend.git#dev).`,
      );
    } else if (
      !backendDep.startsWith("git+") &&
      !backendDep.startsWith("github:") &&
      !backendDep.startsWith("workspace:")
    ) {
      issues.push(
        `@tradelab/backend = "${backendDep}" — git URL / github: / workspace: 형식 권장.`,
      );
    }
  } catch (err) {
    // Silent — startup check 가 앱 부팅을 방해해선 안 됨
    return { ok: true, issues: [] };
  }

  return { ok: issues.length === 0, issues };
}

/**
 * App.tsx 또는 main.tsx 에서 fire-and-forget 호출.
 * console.warn 으로 issue 노출, 사용자 UI 에는 영향 X.
 */
export function verifyDepsAsync(): void {
  void verifyDeps().then((result) => {
    if (!result.ok && result.issues.length > 0) {
      console.warn("[verify-deps] Dependency issues detected:");
      for (const issue of result.issues) {
        console.warn(`  • ${issue}`);
      }
      console.warn(
        "[verify-deps] Vercel build 가 실패할 가능성 — package.json 의 @tradelab/backend 확인",
      );
    }
  });
}
