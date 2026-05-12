/**
 * useBbdxV66Flags — BBDX v6.6 feature flag fetcher (전체 앱 단일 호출).
 *
 * trpc.bbdxV66.flags 는 server-side env 기반 — 변경되지 않는 값이므로
 * 캐시 1시간. SHORT 시그널 표시 여부, v6.6 활성 여부를 UI 가 판단.
 */

import { trpc } from "@/lib/trpc";

export interface BbdxV66Flags {
  bbdxVersion: "v6.5" | "v6.6";
  bbdxMarket: "spot" | "perp";
  enableShortSignals: boolean;
}

export function useBbdxV66Flags() {
  const query = trpc.bbdxV66.flags.useQuery(undefined, {
    staleTime: 60 * 60 * 1000, // 1h
    retry: false,
  });

  const flags: BbdxV66Flags = query.data ?? {
    bbdxVersion: "v6.5",
    bbdxMarket: "spot",
    enableShortSignals: false,
  };

  return {
    flags,
    isV66: flags.bbdxVersion === "v6.6",
    shortEnabled: flags.enableShortSignals,
    isLoading: query.isLoading,
  };
}
