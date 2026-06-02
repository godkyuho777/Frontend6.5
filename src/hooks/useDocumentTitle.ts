/**
 * useDocumentTitle — 페이지별 <title> 동기화 훅.
 *
 * 기존에는 index.html 의 정적 타이틀("Binance Trading Bot - 4H Signal
 * Scanner") 이 모든 라우트에서 그대로 노출돼 (1) 브랜드/거래소가 틀리고
 * (2) 탭/방문기록/스크린리더에서 페이지 구분이 불가능했다.
 *
 * 타이틀은 레이아웃 한 곳에서 location 기반으로 계산해 호출한다 (단일 소스).
 * 페이지마다 호출하면 부모 레이아웃 effect 가 자식 effect 보다 늦게 실행돼
 * (React 는 effect 를 자식→부모 순으로 flush) 덮어쓰는 race 가 생기므로 금지.
 */

import { useEffect } from "react";

const BASE = "Tradelab";
const DEFAULT_TITLE = `${BASE} — 암호화폐 시그널 트래커`;

export function useDocumentTitle(title?: string | null): void {
  useEffect(() => {
    const trimmed = title?.trim();
    document.title = trimmed ? `${trimmed} · ${BASE}` : DEFAULT_TITLE;
  }, [title]);
}
