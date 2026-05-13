/**
 * TrackerContext — CoinDetail 6-탭의 트래커 컨텍스트.
 *
 * `/coin/:symbol?tracker=bbdx` 등 URL 파라미터로 전달되며, 각 탭이
 * 트래커 별 콘텐츠 (매매기준 / 신호 / 차트 / 백테스트) 를 분기 렌더링하는
 * 데 사용된다.
 *
 * 사용자 요구 (2026-05-13):
 *  - / (Home, RSI/BB/ADX)  → tracker=bbdx
 *  - /fibonacci            → tracker=fibonacci
 *  - /vwap                 → tracker=vwap
 *  - 미지정                → bbdx (default, 후방 호환)
 *
 * 코인 정보 / 히스토리 탭은 트래커 무관 (CoinGecko · 누적 signal history).
 */

export type TrackerContext = "bbdx" | "fibonacci" | "vwap" | "jeon-in-gu";

export const TRACKER_VALUES: ReadonlyArray<TrackerContext> = [
  "bbdx",
  "fibonacci",
  "vwap",
  "jeon-in-gu",
];

export const TRACKER_NAMES: Record<TrackerContext, string> = {
  bbdx: "BBDX v6.6 (RSI + BB + ADX)",
  fibonacci: "Fibonacci & Trendline",
  vwap: "VWAP + EMA(9)",
  "jeon-in-gu": "전인구 시그널 (Beta)",
};

export const TRACKER_SHORT_NAMES: Record<TrackerContext, string> = {
  bbdx: "BBDX",
  fibonacci: "Fibonacci",
  vwap: "VWAP",
  "jeon-in-gu": "전인구",
};

/**
 * URL `?tracker=...` 값을 안전하게 TrackerContext 로 파싱.
 * 미지정 / 미상한 값 → "bbdx" default.
 */
export function parseTrackerParam(value: string | null | undefined): TrackerContext {
  if (!value) return "bbdx";
  if (TRACKER_VALUES.includes(value as TrackerContext)) {
    return value as TrackerContext;
  }
  return "bbdx";
}
