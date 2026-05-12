/**
 * useBbdxV66Current — 단일 (symbol, tf) 의 v6.6 LONG/SHORT 양방향 평가.
 *
 * trpc.bbdxV66.current 는 백엔드 server-side 평가 — 클라이언트 사이드 BBDX
 * (useCoinSignal) 와는 별도. v6.6 가 활성된 경우만 실제 결과, 비활성 시
 * `{ long: null, short: null, meta: { note: ... } }` 형태.
 */

import { trpc } from "@/lib/trpc";

type BbdxV66Tf = "1h" | "4h" | "1d";

const ALLOWED_TF: readonly BbdxV66Tf[] = ["1h", "4h", "1d"] as const;

function isAllowedTf(tf: string): tf is BbdxV66Tf {
  return (ALLOWED_TF as readonly string[]).includes(tf);
}

export function useBbdxV66Current(
  symbol: string | undefined,
  tf: string,
  options?: { enabled?: boolean }
) {
  const enabled = !!symbol && isAllowedTf(tf) && (options?.enabled ?? true);

  const query = trpc.bbdxV66.current.useQuery(
    {
      symbol: symbol ?? "",
      tf: (isAllowedTf(tf) ? tf : "4h") as BbdxV66Tf,
    },
    {
      enabled,
      staleTime: 30_000,
      retry: false,
    }
  );

  return {
    data: query.data,
    long: query.data?.long ?? null,
    short: query.data?.short ?? null,
    meta: query.data?.meta,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
  };
}
