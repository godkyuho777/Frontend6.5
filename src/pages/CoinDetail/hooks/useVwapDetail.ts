/**
 * useVwapDetail — 단일 코인의 `trpc.vwap.detail` 응답 훅.
 *
 * 백엔드 v6.5 (`feat/v6.5-merge`) 에서 추가된 라우트로, VWAP 5-component
 * 시그널 + Volume Profile + Pullback v2 + Multi-TF Alignment + vwapMult
 * (BBDX multiplier) 를 한 번에 반환.
 *
 * SignalCard 의 `vwapMult` chip 과 DimensionBreakdown 의 4번/5번 차원 카드
 * 강화에 사용. 백엔드 미배포/오류 시 friendly fallback (chip 만 "n/a" 표시).
 *
 * 헌장 규칙 3 — VWAP 시그널은 BBDX 진입 신뢰도 multiplier 로만 사용.
 */

import { trpc } from "@/lib/trpc";
import type { VwapDetailLite } from "@/pages/Vwap/VwapDetailPanels";

export type { VwapDetailLite };

export function useVwapDetail(symbol: string | undefined, tf: "1h" | "4h" | "1d") {
  const query = trpc.vwap.detail.useQuery(
    { symbol: symbol ?? "", tf },
    {
      enabled: !!symbol,
      staleTime: 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    }
  );

  // Forward-compatible 캐스트 — 백엔드 d.ts 가 router 에서 노출되지 않을 때
  // VwapDetailPanels 의 인라인 타입과 호환되도록 좁힘.
  const detail = query.data as VwapDetailLite | undefined;

  return {
    detail,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
