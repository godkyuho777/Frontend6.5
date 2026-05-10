/**
 * useTrendAnalysis — 단일 심볼의 `trpc.trend.analyze` 응답 훅 (백엔드 우선).
 *
 * 백엔드 v6.5+ (`feat/v6.5-merge`, dev) 에서 추가된 라우트로, 멀티-TF deep
 * trend 분석 + Wave Alignment + BBDX waveMult 를 한 번에 반환. 5-min in-memory
 * 캐시가 백엔드에 적용되어 있으므로 staleTime 도 동일하게 5-min 으로 맞춘다.
 *
 * 헌장 규칙 3 — `waveMult` 는 BBDX final_confidence 의 곱셈 multiplier 로만
 * 사용. 단독 진입 시그널 발행 X.
 *
 * 이 훅이 `loading` / `error` / `enabled=false` 일 때 호출자는 클라이언트
 * 사이드 `lib/trend-analysis.ts` (offline) 로 fallback 가능.
 */

import { trpc } from "@/lib/trpc";

export type TrendTf = "15m" | "1h" | "4h" | "1d" | "1w";

// ---------------------------------------------------------------------------
// 타입 — 백엔드 d.ts 미러 (types-entry 에서 export 안 되어 인라인 정의).
// dist/types/src/trend/multi-tf.d.ts + analyze.d.ts + wave-alignment.d.ts 와 동기.
// v6.5 머지 후 types-entry 에 export 되면 그 import 로 갈아끼울 것 (TODO).
// ---------------------------------------------------------------------------

export type EmaArrayState =
  | "GOLDEN"
  | "DEATH"
  | "BULLISH_ALIGNED"
  | "BEARISH_ALIGNED"
  | "MIXED";

export type AdxStrength = "STRONG" | "WEAK" | "BORDERLINE";

export type StructureState =
  | "HH_HL_x2"
  | "HH_HL_x1"
  | "MIXED"
  | "LH_LL_x1"
  | "LH_LL_x2";

export type VolumeConfirmation = "INCREASING" | "FLAT" | "DECREASING";

export type WaveAlignment =
  | "perfect_up"
  | "partial_up"
  | "mixed"
  | "opposing"
  | "perfect_down";

export interface DeepTimeframeTrend {
  tf: string;
  side: "BULLISH" | "BEARISH" | "SIDEWAYS";
  confirmations: {
    trendline: boolean;
    emaArray: EmaArrayState;
    adxStrength: AdxStrength;
    hhHlStructure: StructureState;
    volumeConfirm: VolumeConfirmation;
  };
  /** 0~100, side 부합 confirmations 갯수 × 25. */
  confidenceScore: number;
  emas: { ema9: number; ema21: number; ema50: number };
  adx: number;
  diPlus: number;
  diMinus: number;
}

export interface TrendAnalysisResult {
  symbol: string;
  perTf: Record<string, DeepTimeframeTrend>;
  alignment: WaveAlignment;
  /** 0.30 ~ 1.30, BBDX final_confidence multiplier. */
  waveMult: number;
  /** 0~100, perTf confidenceScore 평균. */
  overallConfidence: number;
  computedAt: number;
  /** 백엔드 fetch 실패 시 채워짐 — 호출자는 fallback 로 전환. */
  error?: string;
}

/**
 * 단일 심볼의 멀티-TF trend 분석. 5-min staleTime (백엔드 캐시와 매치).
 *
 * @param symbol 예: "BTCUSDT"
 * @param tfs    분석할 TF 목록. default: ["1h","4h","1d","1w"]
 */
export function useTrendAnalysis(
  symbol: string | undefined,
  tfs: TrendTf[] = ["1h", "4h", "1d", "1w"]
) {
  const query = trpc.trend.analyze.useQuery(
    { symbol: symbol ?? "", tfs },
    {
      enabled: !!symbol,
      staleTime: 5 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    }
  );

  // Forward-compatible 캐스트 — 백엔드 d.ts 가 router 응답에 union (성공 +
  // error fallback) 타입을 노출. 인라인 TrendAnalysisResult 로 좁힘.
  const data = query.data as TrendAnalysisResult | undefined;

  return {
    data,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
