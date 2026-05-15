import { HudPanel } from "@/components/HudPanel";
import { cn } from "@/lib/utils";
import type { MacroLayer } from "@shared/macro-types";
import type { MacroCurrentValueKey } from "@shared/macro-indicator-types";
import type {
  MacroIndicatorStatus,
  MacroSeriesData,
} from "@/hooks/useMacroIndicator";

interface MacroCurrentValueCardsProps {
  /** indicator meta 의 currentValueKeys. */
  keys: MacroCurrentValueKey[];
  /** macroV2.snapshot 결과 — null 시 stub 표시. */
  layer: MacroLayer | null;
  /** stub/error 상태에서 fallback 처리용. */
  status: MacroIndicatorStatus;
  /** 시리즈 데이터 — primary 카드의 24h/7d 변화율 도출. */
  series?: MacroSeriesData[];
  /** primary 카드와 매핑할 시리즈 ID (보통 derived ID). */
  primarySeriesId?: string;
}

function defaultFmtNumber(
  v: number | null | undefined,
  digits: number,
  unit: string,
): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v.toFixed(digits)}${unit}`;
}

function fmtChange(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

function valueColor(v: number | null, positiveIsGood?: boolean): string {
  if (v == null || !Number.isFinite(v) || positiveIsGood === undefined) {
    return "text-foreground";
  }
  if (v === 0) return "text-muted-foreground";
  const isPositive = v > 0;
  if (positiveIsGood) {
    return isPositive ? "text-neon-green" : "text-red-400";
  }
  return isPositive ? "text-red-400" : "text-neon-green";
}

export function MacroCurrentValueCards({
  keys,
  layer,
  status,
  series,
  primarySeriesId,
}: MacroCurrentValueCardsProps) {
  const cols = keys.length === 1 ? "grid-cols-1" : keys.length === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-3";
  const primarySeries =
    series?.find(s => s.id === primarySeriesId) ?? series?.[series.length - 1];

  return (
    <HudPanel
      title="Current Values"
      subtitle="snapshot 시점 핵심 수치"
      variant="highlight"
    >
      <div className={cn("grid gap-3", cols)}>
        {keys.map((k, i) => {
          const isPrimary = !!k.primary;
          const digits = k.digits ?? 2;
          const isCategorical = k.valueType === "categorical";
          const layerMissing = status === "stub" || status === "error" || layer == null;
          const hasStubReason = !!k.stubReason;

          // categorical 경로 — layer 의 string 필드를 그대로 표시
          if (isCategorical) {
            const rawCat = layer ? k.pickCategorical?.(layer) : null;
            const labelTxt =
              rawCat && k.categoricalLabel ? k.categoricalLabel(rawCat) : rawCat ?? "";
            const colorClass =
              rawCat && k.categoricalColor
                ? k.categoricalColor(rawCat)
                : "text-foreground";
            return (
              <div
                key={`${k.label}-${i}`}
                className={cn(
                  "hud-frame p-3",
                  isPrimary && "border-neon-cyan/30",
                )}
              >
                <div className="font-mono text-[10px] text-muted-foreground tracking-wider mb-1">
                  {k.label}
                </div>
                <div
                  className={cn(
                    "font-display font-bold",
                    isPrimary ? "text-2xl" : "text-lg",
                    layerMissing || !rawCat ? "text-muted-foreground/50" : colorClass,
                  )}
                >
                  {layerMissing || !rawCat ? "—" : labelTxt}
                </div>
                {k.hint && (
                  <div className="font-mono text-[9px] text-muted-foreground/70 mt-1 leading-tight">
                    {k.hint}
                  </div>
                )}
                {layerMissing && (
                  <div className="mt-2 font-mono text-[9px] text-orange-300/80">
                    STUB — FRED_API_KEY 미설정
                  </div>
                )}
              </div>
            );
          }

          // fromSeriesId — layer 대신 FRED 시리즈의 latest 값 사용
          if (k.fromSeriesId) {
            const srcSeries = series?.find(s => s.id === k.fromSeriesId);
            const srcLatest = srcSeries?.latest ?? null;
            const srcStub =
              !srcSeries ||
              srcSeries.status === "stub" ||
              srcSeries.status === "error" ||
              srcLatest == null;
            const formatted = srcStub
              ? "—"
              : k.formatValue && srcLatest != null
                ? k.formatValue(srcLatest)
                : defaultFmtNumber(srcLatest, digits, k.unit);
            return (
              <div
                key={`${k.label}-${i}`}
                className={cn(
                  "hud-frame p-3",
                  isPrimary && "border-neon-cyan/30",
                )}
              >
                <div className="font-mono text-[10px] text-muted-foreground tracking-wider mb-1">
                  {k.label}
                </div>
                <div
                  className={cn(
                    "font-display font-bold",
                    isPrimary ? "text-3xl" : "text-xl",
                    srcStub
                      ? "text-muted-foreground/50"
                      : valueColor(srcLatest, k.positiveIsGood),
                  )}
                >
                  {formatted}
                </div>
                {k.hint && (
                  <div className="font-mono text-[9px] text-muted-foreground/70 mt-1 leading-tight">
                    {k.hint}
                  </div>
                )}
                {srcStub && (
                  <div className="mt-2 font-mono text-[9px] text-orange-300/80">
                    STUB — FRED 시리즈 미수신
                  </div>
                )}
              </div>
            );
          }

          // stubReason — 백엔드 layer 에 필드가 아예 없는 경우 (예 DXY 절대 수준)
          if (hasStubReason) {
            return (
              <div
                key={`${k.label}-${i}`}
                className={cn(
                  "hud-frame p-3",
                  isPrimary && "border-neon-cyan/30",
                )}
              >
                <div className="font-mono text-[10px] text-muted-foreground tracking-wider mb-1">
                  {k.label}
                </div>
                <div
                  className={cn(
                    "font-display font-bold text-muted-foreground/50",
                    isPrimary ? "text-3xl" : "text-xl",
                  )}
                >
                  —
                </div>
                {k.hint && (
                  <div className="font-mono text-[9px] text-muted-foreground/70 mt-1 leading-tight">
                    {k.hint}
                  </div>
                )}
                <div className="mt-2 font-mono text-[9px] text-orange-300/80 leading-tight">
                  {k.stubReason}
                </div>
              </div>
            );
          }

          // number 경로 (기본)
          const raw = layer ? k.pick(layer) : null;
          const isStub = layerMissing;
          const formatted = isStub
            ? "—"
            : k.formatValue && raw != null && Number.isFinite(raw)
              ? k.formatValue(raw)
              : defaultFmtNumber(raw, digits, k.unit);
          return (
            <div
              key={`${k.label}-${i}`}
              className={cn(
                "hud-frame p-3",
                isPrimary && "border-neon-cyan/30",
              )}
            >
              <div className="font-mono text-[10px] text-muted-foreground tracking-wider mb-1">
                {k.label}
              </div>
              <div
                className={cn(
                  "font-display font-bold",
                  isPrimary ? "text-3xl" : "text-xl",
                  isStub
                    ? "text-muted-foreground/50"
                    : valueColor(raw ?? null, k.positiveIsGood),
                )}
              >
                {formatted}
              </div>
              {k.hint && (
                <div className="font-mono text-[9px] text-muted-foreground/70 mt-1 leading-tight">
                  {k.hint}
                </div>
              )}
              {/* primary 카드에 변화율 (시리즈 데이터에서 가져옴) */}
              {isPrimary && primarySeries && !isStub && (
                <div className="mt-2 flex flex-wrap gap-3 font-mono text-[10px]">
                  <span className="text-muted-foreground">
                    24h:{" "}
                    <span
                      className={cn(
                        primarySeries.change_24h_pct == null
                          ? "text-muted-foreground"
                          : primarySeries.change_24h_pct >= 0
                            ? "text-neon-green"
                            : "text-red-400",
                      )}
                    >
                      {fmtChange(primarySeries.change_24h_pct)}
                    </span>
                  </span>
                  <span className="text-muted-foreground">
                    7d:{" "}
                    <span
                      className={cn(
                        primarySeries.change_7d_pct == null
                          ? "text-muted-foreground"
                          : primarySeries.change_7d_pct >= 0
                            ? "text-neon-green"
                            : "text-red-400",
                      )}
                    >
                      {fmtChange(primarySeries.change_7d_pct)}
                    </span>
                  </span>
                </div>
              )}
              {isStub && (
                <div className="mt-2 font-mono text-[9px] text-orange-300/80">
                  STUB — FRED_API_KEY 미설정
                </div>
              )}
            </div>
          );
        })}
      </div>
    </HudPanel>
  );
}
