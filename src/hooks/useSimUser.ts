/**
 * Investment Simulator — anonymous user hook (2026-05-15).
 *
 * 로그인 없이 모의투자를 시작하기 위한 닉네임 + UUID 페어를 localStorage 에
 * 영구 저장한다. 백엔드 `simulator.*` 라우터는 simUserId (UUID) 만 알고
 * 닉네임은 클라이언트 표시용.
 *
 * Charter rule: 시뮬레이터는 실제 자본 영향 X. 로그인 불요 + 익명 허용.
 */
import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "tradelab.simUser";

export interface SimUser {
  id: string;
  nickname: string;
  createdAt: number;
}

function randomNickname(): string {
  const adjectives = [
    "Cyber", "Quantum", "Crypto", "Nebula", "Lunar", "Solar", "Pixel",
    "Neon", "Stealth", "Quantum", "Phantom", "Volt", "Plasma", "Nova",
  ];
  const animals = [
    "Wolf", "Falcon", "Tiger", "Eagle", "Dragon", "Shark", "Panther",
    "Phoenix", "Lynx", "Cobra", "Raven", "Mantis", "Otter", "Whale",
  ];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const ani = animals[Math.floor(Math.random() * animals.length)];
  const num = Math.floor(Math.random() * 9000 + 1000);
  return `${adj}${ani}${num}`;
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

/**
 * Persistent anonymous simulator user.
 *
 * @returns `simUser` (null until mounted), `setNickname`, `reset`
 */
export function useSimUser() {
  const [simUser, setSimUser] = useState<SimUser | null>(null);
  const [mounted, setMounted] = useState(false);

  // 첫 렌더에서 localStorage 로드 + 없으면 자동 생성
  useEffect(() => {
    let u = loadSimUser();
    if (!u) {
      u = {
        id: uuid(),
        nickname: randomNickname(),
        createdAt: Date.now(),
      };
      saveSimUser(u);
    }
    setSimUser(u);
    setMounted(true);
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

  /** 새 UUID + 새 닉네임 — Reset 버튼용 */
  const reset = useCallback(() => {
    const next: SimUser = {
      id: uuid(),
      nickname: randomNickname(),
      createdAt: Date.now(),
    };
    saveSimUser(next);
    setSimUser(next);
  }, []);

  return { simUser, mounted, setNickname, reset };
}
