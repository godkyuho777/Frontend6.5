/**
 * Macro Liquidity Tracker — 단일 indicator detail 페이지가 소비하는 hook.
 *
 * 1) `trpc.macroV2.snapshot` — 현재 layer 객체 (regime / multiplier / composite)
 * 2) `trpc.macroV2.history` — FRED raw observations (시계열 차트)
 * 3) derived series (예: SOFR-IORB Spread = SOFR-IORB) 도 같이 계산
 * 4) status 분류:
 *    - "loading" — 둘 다 fetching
 *    - "stub"    — FRED_API_KEY 미설정 (어떤 시리즈든 stub)
 *    - "error"   — 모든 시리즈 error
 *    - "live"    — 최소 한 개 시리즈 ok
 *    - "stale"   — ok 인데 age_hours > 48
 *
 * Stub 상태에서도 UI 가 정적 룰북을 표시할 수 있도록 meta 는 항상 같이 반환.
 */
import { useMemo } from "react";

import { trpc } from "@/lib/trpc";
import type { MacroLayer } from "@shared/macro-types";
import {
  MACRO_INDICATOR_META,
  type MacroIndicatorKey,
  type MacroIndicatorMeta,
  type MacroFredSeries,
} from "@shared/macro-indicator-types";

export type MacroPeriod = "30d" | "90d" | "1y" | "5y";

export type MacroIndicatorStatus =
  | "loading"
  | "stub"
  | "error"
  | "live"
  | "stale";

export interface MacroSeriesPoint {
  /** ISO 날짜 YYYY-MM-DD. */
  date: string;
  /** 값 (NaN 가능 — FRED ".") . */
  value: number;
}

export interface MacroSeriesData {
  /** FRED series ID (derived 인 경우 합성 ID). */
  id: string;
  /** UI 라벨. */
  label: string;
  /** 단위. */
  unit?: string;
  /** oklch 색상. */
  color?: string;
  /** point 시계열 (오래된 → 최신 정렬). */
  points: MacroSeriesPoint[];
  /** 시리즈 자체 status. */
  status: MacroIndicatorStatus;
  /** 가장 최근 유효값 (Number.isFinite 통과). */
  latest: number | null;
  /** 최근 24h / 7d 변화율 (%) — 데이터 부족 시 null. */
  change_24h_pct: number | null;
  change_7d_pct: number | null;
  /** derived 여부. */
  derived?: boolean;
}

export interface UseMacroIndicatorResult {
  /** 정적 메타 (학술 ref, 사건, 룰북 등). 항상 채워짐. */
  meta: MacroIndicatorMeta;
  /** 현재 시점 macro snapshot — null 이면 stub/error. */
  layer: MacroLayer | null;
  /** 통합 status (loading/stub/live/stale/error). */
  status: MacroIndicatorStatus;
  /** 사용자 친화 에러 메시지 (없으면 null). */
  detail: string | null;
  /** 시리즈 데이터 (FRED + derived). meta.fredSeries 순서. */
  series: MacroSeriesData[];
  /** snapshot.age_hours (없으면 null). */
  ageHours: number | null;
  /** snapshot.freshness_mult (없으면 null). */
  freshnessMult: number | null;
  /** 재조회. */
  refetch: () => void;
  /** 첫 페치 진행 중 (스피너용). */
  isLoading: boolean;
  /** 현재 선택된 period. */
  period: MacroPeriod;
}

/**
 * 두 raw 시리즈를 결합해 derived spread 를 만든다.
 * (예: SOFR - IORB = Spread (%) → × 100 으로 bp 변환)
 */
function deriveSpread(
  spec: MacroFredSeries,
  rawById: Record<string, MacroSeriesPoint[]>,
): MacroSeriesPoint[] {
  if (!spec.derived || !spec.minuend || !spec.subtrahend) return [];
  const a = rawById[spec.minuend] ?? [];
  const b = rawById[spec.subtrahend] ?? [];
  const bMap = new Map<string, number>();
  for (const p of b) {
    if (Number.isFinite(p.value)) bMap.set(p.date, p.value);
  }
  const scale = spec.scale ?? 1;
  const out: MacroSeriesPoint[] = [];
  for (const p of a) {
    if (!Number.isFinite(p.value)) continue;
    const bv = bMap.get(p.date);
    if (bv === undefined) continue;
    out.push({ date: p.date, value: (p.value - bv) * scale });
  }
  return out;
}

/** 마지막 유효 값 + 24h / 7d 변화율 계산. */
function summarize(points: MacroSeriesPoint[]): {
  latest: number | null;
  change_24h_pct: number | null;
  change_7d_pct: number | null;
} {
  const valid = points.filter(p => Number.isFinite(p.value));
  if (valid.length === 0) {
    return { latest: null, change_24h_pct: null, change_7d_pct: null };
  }
  const latestPoint = valid[valid.length - 1];
  const latest = latestPoint.value;
  const latestDate = new Date(latestPoint.date).getTime();

  function findClosestBefore(daysBack: number): number | null {
    const target = latestDate - daysBack * 86_400_000;
    let best: MacroSeriesPoint | null = null;
    for (const p of valid) {
      const t = new Date(p.date).getTime();
      if (t <= target) {
        if (!best || t > new Date(best.date).getTime()) best = p;
      }
    }
    return best ? best.value : null;
  }
  const v24 = findClosestBefore(1);
  const v7 = findClosestBefore(7);
  const change_24h_pct =
    v24 != null && v24 !== 0 ? ((latest - v24) / Math.abs(v24)) * 100 : null;
  const change_7d_pct =
    v7 != null && v7 !== 0 ? ((latest - v7) / Math.abs(v7)) * 100 : null;
  return { latest, change_24h_pct, change_7d_pct };
}

export interface UseMacroIndicatorOptions {
  /** 차트 표시 기간. default "1y". */
  period?: MacroPeriod;
  /** 폴링 간격 (ms). 0 = polling 없음. default 5분. */
  refetchIntervalMs?: number;
}

export function useMacroIndicator(
  indicatorKey: MacroIndicatorKey,
  opts: UseMacroIndicatorOptions = {},
): UseMacroIndicatorResult {
  const period: MacroPeriod = opts.period ?? "1y";
  const refetchInterval = opts.refetchIntervalMs ?? 5 * 60 * 1000;

  const meta = MACRO_INDICATOR_META[indicatorKey];

  // ── 1) snapshot ────────────────────────────────────────
  const snapshotQuery = trpc.macroV2.snapshot.useQuery(undefined, {
    staleTime: 60_000,
    refetchInterval: refetchInterval > 0 ? refetchInterval : false,
  });
  const layer = (snapshotQuery.data as MacroLayer | null) ?? null;

  // ── 2) FRED raw series — derived 가 아닌 것만 fetch ───
  const rawSeriesSpecs = useMemo(
    () => meta.fredSeries.filter(s => !s.derived),
    [meta.fredSeries],
  );

  // 시리즈마다 useQuery 가 필요한데 hook 갯수가 indicator 마다 다름.
  // 해결: 최대 4개 까지 hardcode 슬롯 + meta.fredSeries.length <= 4 보장.
  // (현재 5개 indicator 모두 raw 최대 3개)
  const q0 = trpc.macroV2.history.useQuery(
    { seriesId: rawSeriesSpecs[0]?.id ?? "SOFR", period },
    {
      enabled: rawSeriesSpecs.length > 0,
      staleTime: 5 * 60 * 1000,
    },
  );
  const q1 = trpc.macroV2.history.useQuery(
    { seriesId: rawSeriesSpecs[1]?.id ?? "SOFR", period },
    {
      enabled: rawSeriesSpecs.length > 1,
      staleTime: 5 * 60 * 1000,
    },
  );
  const q2 = trpc.macroV2.history.useQuery(
    { seriesId: rawSeriesSpecs[2]?.id ?? "SOFR", period },
    {
      enabled: rawSeriesSpecs.length > 2,
      staleTime: 5 * 60 * 1000,
    },
  );
  const q3 = trpc.macroV2.history.useQuery(
    { seriesId: rawSeriesSpecs[3]?.id ?? "SOFR", period },
    {
      enabled: rawSeriesSpecs.length > 3,
      staleTime: 5 * 60 * 1000,
    },
  );

  const rawQueries = [q0, q1, q2, q3];

  // ── 3) 시리즈 데이터 가공 ─────────────────────────────
  const series: MacroSeriesData[] = useMemo(() => {
    // raw 결과 모음
    const rawById: Record<string, MacroSeriesPoint[]> = {};
    const statusById: Record<string, MacroIndicatorStatus> = {};
    rawSeriesSpecs.forEach((spec, i) => {
      const q = rawQueries[i];
      const data = q?.data;
      const points: MacroSeriesPoint[] = (data?.observations ?? []).map(o => ({
        date: o.date,
        value: typeof o.value === "number" ? o.value : Number.NaN,
      }));
      rawById[spec.id] = points;
      const apiStatus = data?.status;
      if (q.isLoading) statusById[spec.id] = "loading";
      else if (apiStatus === "stub") statusById[spec.id] = "stub";
      else if (apiStatus === "error") statusById[spec.id] = "error";
      else if (apiStatus === "ok") statusById[spec.id] = "live";
      else statusById[spec.id] = "loading";
    });

    // 최종 series 배열 (raw + derived, meta.fredSeries 순서)
    return meta.fredSeries.map<MacroSeriesData>(spec => {
      let points: MacroSeriesPoint[];
      let status: MacroIndicatorStatus;
      if (spec.derived) {
        points = deriveSpread(spec, rawById);
        // derived 의 status 는 두 raw 가 모두 live 일 때만 live
        const aSt = spec.minuend ? statusById[spec.minuend] : "error";
        const bSt = spec.subtrahend ? statusById[spec.subtrahend] : "error";
        if (aSt === "loading" || bSt === "loading") status = "loading";
        else if (aSt === "live" && bSt === "live") status = "live";
        else if (aSt === "stub" || bSt === "stub") status = "stub";
        else status = "error";
      } else {
        points = rawById[spec.id] ?? [];
        status = statusById[spec.id] ?? "loading";
      }
      const summary = summarize(points);
      return {
        id: spec.id,
        label: spec.label,
        unit: spec.unit,
        color: spec.color,
        points,
        status,
        latest: summary.latest,
        change_24h_pct: summary.change_24h_pct,
        change_7d_pct: summary.change_7d_pct,
        derived: spec.derived,
      };
    });
  }, [meta.fredSeries, rawQueries, rawSeriesSpecs]);

  // ── 4) 통합 status 계산 ────────────────────────────────
  const ageHours = layer?.age_hours ?? null;
  const freshnessMult = layer?.freshness_mult ?? null;

  const status: MacroIndicatorStatus = useMemo(() => {
    if (snapshotQuery.isLoading || rawQueries.some(q => q.isLoading)) {
      // 단, snapshot 만 로딩이고 raw 가 모두 비활성 (rawSeriesSpecs.length = 0)
      // 인 경우는 layer 만으로 판단
      const anyEnabledLoading =
        snapshotQuery.isLoading ||
        rawQueries
          .slice(0, rawSeriesSpecs.length)
          .some(q => q.isLoading);
      if (anyEnabledLoading) return "loading";
    }
    // 시리즈 status 우선 평가
    const allSeriesStub =
      series.length > 0 && series.every(s => s.status === "stub");
    const allSeriesError =
      series.length > 0 && series.every(s => s.status === "error");
    const anyLive = series.some(s => s.status === "live");
    if (allSeriesStub && !layer) return "stub";
    if (allSeriesError && !layer) return "error";
    if (anyLive) {
      // age check
      if (ageHours != null && ageHours > 48) return "stale";
      return "live";
    }
    // snapshot 있으나 시리즈 stub
    if (layer) {
      if (allSeriesStub) return "stub";
      if (ageHours != null && ageHours > 48) return "stale";
      return "live";
    }
    return "stub";
  }, [snapshotQuery.isLoading, rawQueries, series, layer, ageHours, rawSeriesSpecs.length]);

  // ── 5) detail (에러 메시지) ────────────────────────────
  const detail: string | null = useMemo(() => {
    for (let i = 0; i < rawSeriesSpecs.length; i++) {
      const d = rawQueries[i]?.data;
      if (d?.status === "error" && d.detail) return d.detail;
    }
    return null;
  }, [rawQueries, rawSeriesSpecs.length]);

  const refetch = () => {
    snapshotQuery.refetch();
    rawQueries.slice(0, rawSeriesSpecs.length).forEach(q => q.refetch());
  };

  const isLoading =
    snapshotQuery.isLoading ||
    rawQueries.slice(0, rawSeriesSpecs.length).some(q => q.isLoading);

  return {
    meta,
    layer,
    status,
    detail,
    series,
    ageHours,
    freshnessMult,
    refetch,
    isLoading,
    period,
  };
}
