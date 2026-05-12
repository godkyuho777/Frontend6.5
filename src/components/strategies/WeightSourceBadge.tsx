/**
 * WeightSourceBadge — BBDX v6.6 가중치 출처 시각화.
 *
 * trpc.bbdxV66.weightsFor 응답의 `source` 필드를 chip 으로 표시:
 *   - self_backtest  → 녹색 "자체 백테스트"   + n / R² tooltip
 *   - external       → 파랑 "외부 검증"        + citation tooltip
 *   - default        → 노랑 "직관 (검토 필요)" + 경고 tooltip
 *
 * SignalCard / ShortSignalCard 양쪽에 표시해 사용자가 가중치의 신뢰도를
 * 즉시 인지 (헌장 R2 — 검증된 가중치 / 임계 사용 의무).
 */

import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

interface WeightSourceBadgeProps {
  symbol: string;
  tf: string;
  path: "NUM" | "PTN" | "BB";
  side: "long" | "short";
  /** 작은 사이즈로 표시 (header chip 용) — default false */
  compact?: boolean;
}

export function WeightSourceBadge({
  symbol,
  tf,
  path,
  side,
  compact = false,
}: WeightSourceBadgeProps) {
  const { data, isLoading } = trpc.bbdxV66.weightsFor.useQuery(
    { symbol, tf, path, side },
    { staleTime: 60_000, retry: false }
  );

  if (isLoading || !data) {
    return (
      <span
        className={cn(
          "font-mono px-1.5 py-0.5 rounded-sm border border-border/30 text-muted-foreground",
          compact ? "text-[9px]" : "text-[10px]"
        )}
        title="가중치 출처 조회 중"
      >
        W ?
      </span>
    );
  }

  const source = data.source;
  const r2 = data.rSquared;
  const n = data.sampleSize;
  const sourceId = data.externalSourceId;

  const tooltip =
    source === "self_backtest"
      ? `자체 백테스트 — n=${n ?? "?"}, R²=${r2?.toFixed(2) ?? "?"}` +
        (data.oosMatch != null ? `, OOS=${data.oosMatch.toFixed(2)}` : "")
      : source === "external"
        ? `외부 검증 (${sourceId ?? "external manifest"})`
        : "직관값 (검토 필요) — 자체 백테스트 또는 외부 출처로 교체 권장";

  const label =
    source === "self_backtest"
      ? compact
        ? "BT"
        : "BACKTEST"
      : source === "external"
        ? compact
          ? "EXT"
          : "EXTERNAL"
        : compact
          ? "DEF"
          : "DEFAULT";

  const cls =
    source === "self_backtest"
      ? "border-neon-green/40 text-neon-green bg-neon-green/5"
      : source === "external"
        ? "border-neon-cyan/40 text-neon-cyan bg-neon-cyan/5"
        : "border-neon-yellow/40 text-neon-yellow bg-neon-yellow/5";

  const icon =
    source === "self_backtest" ? "✓" : source === "external" ? "📚" : "⚠";

  return (
    <span
      className={cn(
        "font-mono px-1.5 py-0.5 rounded-sm border inline-flex items-center gap-0.5",
        cls,
        compact ? "text-[9px]" : "text-[10px]"
      )}
      title={tooltip}
    >
      <span>{icon}</span>
      <span>W·{label}</span>
    </span>
  );
}
