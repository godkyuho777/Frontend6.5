import { cn } from "@/lib/utils";
import { riskBandMeta, type RiskBand } from "./riskBandMeta";

/**
 * 리스크 차원 breakdown — LOCKED CONTRACT 의 RiskScoreResult["breakdown"] 미러.
 * 백엔드 타입 재빌드 전에도 self-contained 하게 타입 체크되도록 로컬 미러로 둠.
 * (백엔드 rebuild 후에도 형상 동일 — RiskScoreResult["breakdown"] 와 호환)
 */
export interface RiskBreakdown {
  volatility: number | null;
  liquidity: number | null;
  leverage: number | null;
  trend: number | null;
  regime: number | null;
}

interface RiskGaugeProps {
  /** 0-100, 높을수록 위험 */
  score: number;
  band: RiskBand;
  /** 게이지 위 부제 (예: "BTC · 4H") */
  label?: string;
  breakdown?: RiskBreakdown;
  /** 백엔드 notes — 작은 flag chip 으로 표시 */
  notes?: string[];
  className?: string;
}

/** breakdown key → 한글 라벨 (순서 고정) */
const DIMENSIONS: { key: keyof RiskBreakdown; label: string }[] = [
  { key: "volatility", label: "변동성" },
  { key: "liquidity", label: "유동성" },
  { key: "leverage", label: "레버리지" },
  { key: "trend", label: "추세·낙폭" },
  { key: "regime", label: "시장국면" },
];

/** 개별 차원 점수(0-100) → 막대 색상 (band 와 동일 임계값) */
function dimFillClass(v: number): string {
  if (v >= 75) return "bg-neon-red";
  if (v >= 50) return "bg-orange-400";
  if (v >= 25) return "bg-neon-yellow";
  return "bg-neon-green";
}

/**
 * 단일 코인 페이지용 원형 리스크 게이지. WaveSentiment 의 WaveGauge SVG 접근
 * (circle r=54, viewBox 0 0 120 120, -rotate-90) 을 재사용.
 *
 * 큰 점수 + band 라벨 + 차원별 mini-bar breakdown + notes flag chip.
 */
export function RiskGauge({
  score,
  band,
  label,
  breakdown,
  notes,
  className,
}: RiskGaugeProps) {
  const meta = riskBandMeta(band);
  const clamped = Math.min(100, Math.max(0, score));
  const circumference = 2 * Math.PI * 54;
  const dashOffset = circumference - (clamped / 100) * circumference;

  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      <div className="flex flex-col items-center gap-3">
        <div className="relative h-36 w-36">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
            <circle
              cx="60"
              cy="60"
              r="54"
              fill="none"
              stroke="currentColor"
              strokeWidth="6"
              className="text-border/30"
            />
            <circle
              cx="60"
              cy="60"
              r="54"
              fill="none"
              stroke="currentColor"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              className={cn(meta.textClass, "transition-all duration-1000 ease-out")}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              className={cn("tl-market-number text-3xl leading-none", meta.textClass)}
            >
              {Math.round(score)}
            </span>
            <span className="font-sans text-[9px] tracking-wider text-muted-foreground">
              / 100
            </span>
          </div>
        </div>
        <div className="text-center">
          <div
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-display text-sm font-bold",
              meta.bgClass,
              meta.borderClass,
              meta.textClass
            )}
          >
            {meta.label}
          </div>
          {label && (
            <div className="mt-1 font-sans text-xs text-muted-foreground">
              {label}
            </div>
          )}
        </div>
      </div>

      {/* notes flag chips */}
      {notes && notes.length > 0 && (
        <div className="flex flex-wrap justify-center gap-1.5">
          {notes.map((note, i) => (
            <span
              key={i}
              className="rounded-full border border-border/40 bg-muted/30 px-2 py-0.5 font-sans text-[10px] text-muted-foreground"
            >
              {note}
            </span>
          ))}
        </div>
      )}

      {/* 차원별 breakdown — mini bars */}
      {breakdown && (
        <div className="w-full space-y-1.5">
          {DIMENSIONS.map(({ key, label: dimLabel }) => {
            const v = breakdown[key];
            return (
              <div key={key} className="flex items-center gap-2">
                <span className="w-16 shrink-0 font-sans text-[10px] text-muted-foreground">
                  {dimLabel}
                </span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  {v !== null && (
                    <div
                      className={cn("h-full rounded-full transition-all", dimFillClass(v))}
                      style={{ width: `${Math.min(100, Math.max(0, v))}%` }}
                    />
                  )}
                </div>
                <span className="w-7 shrink-0 text-right font-sans text-[10px] text-foreground">
                  {v === null ? "—" : Math.round(v)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default RiskGauge;
