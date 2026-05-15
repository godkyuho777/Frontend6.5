/**
 * Investment Simulator — anonymous user hook (2026-05-15).
 *
 * 로그인 없이 모의투자를 시작하기 위한 닉네임 + UUID 페어를 localStorage 에
 * 영구 저장한다. 백엔드 `simulator.*` 라우터는 simUserId (UUID) 만 알고
 * 닉네임은 클라이언트 표시용.
 *
 * Charter rule: 시뮬레이터는 실제 자본 영향 X. 로그인 불요 + 익명 허용.
 *
 * 2026-05-15 (revision): 자동 닉네임 생성 제거 — 사용자가 명시적으로 닉네임을
 * 입력하고 [Start with $200,000] 을 눌러야 simUser 가 생성됨. 등록 전에는
 * `simUser` = null + `needsRegistration` = true 가 반환된다.
 */
import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "tradelab.simUser";

export interface SimUser {
  id: string;
  nickname: string;
  createdAt: number;
}

/** crypto.randomUUID polyfill (구형 브라우저 대비) */
function uuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // RFC 4122 v4 fallback
  const hex = [...Array(36)].map((_, i) => {
    if (i === 8 || i === 13 || i === 18 || i === 23) return "-";
    if (i === 14) return "4";
    const r = (Math.random() * 16) | 0;
    if (i === 19) return ((r & 0x3) | 0x8).toString(16);
    return r.toString(16);
  });
  return hex.join("");
}

function loadSimUser(): SimUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SimUser;
    if (!parsed.id || !parsed.nickname) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveSimUser(u: SimUser): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
  } catch {
    // private mode — ignore
  }
}

function clearSimUser(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Persistent anonymous simulator user.
 *
 * Flow:
 *  1. Mount → localStorage 조회.
 *  2. 없으면 `needsRegistration = true` 반환 → 페이지에서 onboarding UI 표시.
 *  3. `register(nickname)` 호출 → UUID 생성 + 저장 → simUser 활성화.
 *  4. `signOut()` → localStorage 비우고 needsRegistration 으로 복귀.
 */
export function useSimUser() {
  const [simUser, setSimUser] = useState<SimUser | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setSimUser(loadSimUser());
    setMounted(true);
  }, []);

  const register = useCallback((nickname: string): SimUser | null => {
    const trimmed = nickname.trim().slice(0, 24);
    if (!trimmed) return null;
    const next: SimUser = {
      id: uuid(),
      nickname: trimmed,
      createdAt: Date.now(),
    };
    saveSimUser(next);
    setSimUser(next);
    return next;
  }, []);

  const setNickname = useCallback((nickname: string) => {
    const trimmed = nickname.trim().slice(0, 24);
    if (!trimmed) return;
    setSimUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, nickname: trimmed };
      saveSimUser(next);
      return next;
    });
  }, []);

  /** 사용자 식별을 폐기 — onboarding 화면으로 복귀 */
  const signOut = useCallback(() => {
    clearSimUser();
    setSimUser(null);
  }, []);

  return {
    simUser,
    mounted,
    needsRegistration: mounted && !simUser,
    register,
    setNickname,
    signOut,
  };
}
