import { Badge } from "@/components/ui/badge";
import { HudPanel } from "@/components/HudPanel";
import { cn } from "@/lib/utils";
import { Info, Lock, FlaskConical, ArrowRight } from "lucide-react";
import { useLocation } from "wouter";
import type { TrackerModifier } from "@tradelab/backend/router";

/**
 * Tracker Hub — Modifier 카드.
 *
 * 기존 `@/components/strategies/{MultiplierChip, StatusBadge, CharterFooter}` 의
 * 톤을 그대로 이어받아 3 Layer Hub 안에서 일관된 시각 언어로 표시.
 *
 * 헌장 규칙 3 (modifier-only):
 *   카드 하단의 "Modifier Only" 라벨은 항상 표시. 어떤 modifier 도 단독 시그널 X.
 *
 * Phase 4 — 클릭 규칙:
 *   - slug === "bbdx" → "/" (Main Scanner) 로 이동. route 필드 무시.
 *   - status === "bbdx_internal" (bbdx 제외) → 비활성, "INTERNAL" 뱃지 + Lock 아이콘.
 *   - status === "planned" → 비활성, "PLANNED" 뱃지.
 *   - status === "active" | "beta" → modifier.route 로 이동.
 *
 *   호출자는 더 이상 onClick 을 넘기지 않아도 됨 — 카드가 자체 navigate.
 */

export interface ModifierCardProps {
  modifier: TrackerModifier;
  /** 실시간 multiplier (옵션, 추후 Hub 별 데이터 fetch 시 사용) */
  currentMultiplier?: number | null;
  /** 1줄 reason (옵션) */
  reason?: string;
}

/**
 * Multiplier 색상 규칙 — Phase 3b 사양:
 *   ≥1.20: Strong Bull   (neon-green)
 *   1.05~1.20: Bull      (emerald)
 *   0.95~1.05: Neutral   (muted)
 *   0.80~0.95: Bear      (orange)
 *   <0.80: Strong Bear   (neon-red)
 */
function multiplierTone(m: number) {
  if (m >= 1.2) {
    return {
      cls: "text-neon-green bg-neon-green/15 border-neon-green/50",
      label: "STRONG",
    };
  }
  if (m >= 1.05) {
    return {
      cls: "text-emerald-300 bg-emerald-500/15 border-emerald-500/40",
      label: "BULL",
    };
  }
  if (m >= 0.95) {
    return {
      cls: "text-muted-foreground bg-muted/20 border-muted-foreground/30",
      label: "NEUTRAL",
    };
  }
  if (m >= 0.8) {
    return {
      cls: "text-orange-300 bg-orange-500/15 border-orange-500/40",
      label: "BEAR",
    };
  }
  return {
    cls: "text-neon-red bg-neon-red/15 border-neon-red/50",
    label: "STRONG BEAR",
  };
}

export function ModifierCard({
  modifier,
  currentMultiplier,
  reason,
}: ModifierCardProps) {
  const [, setLocation] = useLocation();

  const isBeta = modifier.status === "beta";
  const isBbdxCore = modifier.slug === "bbdx";
  // bbdx 코어는 internal 라벨에서 제외 (Main Scanner 가 본 페이지)
  const isInternal =
    modifier.status === "bbdx_internal" && !isBbdxCore;
  const isPlanned = modifier.status === "planned";
  const isDisabled = isInternal || isPlanned;
  const isClickable = !isDisabled;

  const dimensionLabel = `${modifier.dimensions.join("·")}차원`;

  const hasMultiplier =
    typeof currentMultiplier === "number" && Number.isFinite(currentMultiplier);
  const tone = hasMultiplier ? multiplierTone(currentMultiplier as number) : null;

  const handleClick = () => {
    if (isDisabled) return;
    if (isBbdxCore) {
      setLocation("/");
    } else {
      setLocation(modifier.route);
    }
  };

  return (
    <HudPanel
      variant={isBeta ? "highlight" : "default"}
      className={cn(
        "flex flex-col h-full transition-all duration-150",
        isClickable
          ? "cursor-pointer hover:border-neon-pink/60 hover:shadow-[0_0_24px_rgba(255,46,160,0.15)]"
          : "opacity-80 cursor-default"
      )}
    >
      <div
        role={isClickable ? "button" : undefined}
        tabIndex={isClickable ? 0 : -1}
        aria-disabled={isDisabled ? true : undefined}
        onClick={isClickable ? handleClick : undefined}
        onKeyDown={
          isClickable
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleClick();
                }
              }
            : undefined
        }
        className={cn(
          "flex flex-col gap-3 -m-4 p-4 min-h-[180px]",
          !isClickable && "cursor-default"
        )}
      >
        {/* 헤더 — displayName + 차원 뱃지 + 상태 표시 */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-display text-sm font-bold tracking-wider uppercase text-neon-pink glow-pink truncate">
              {modifier.displayName}
            </h3>
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <Badge
                variant="outline"
                className="font-mono text-[9px] border-neon-cyan/40 text-neon-cyan"
              >
                {dimensionLabel}
              </Badge>
              {isBeta && (
                <Badge
                  variant="outline"
                  className="font-mono text-[9px] border-orange-400/60 text-orange-300 bg-orange-500/10"
                >
                  <FlaskConical className="h-2.5 w-2.5 mr-1" />
                  BETA
                </Badge>
              )}
              {isInternal && (
                <Badge
                  variant="outline"
                  className="font-mono text-[9px] border-muted-foreground/40 text-muted-foreground bg-muted/20"
                >
                  <Lock className="h-2.5 w-2.5 mr-1" />
                  INTERNAL
                </Badge>
              )}
              {isPlanned && (
                <Badge
                  variant="outline"
                  className="font-mono text-[9px] border-muted-foreground/40 text-muted-foreground"
                >
                  PLANNED
                </Badge>
              )}
            </div>
          </div>
          {isClickable ? (
            <ArrowRight className="h-4 w-4 text-muted-foreground/60 shrink-0 mt-1" />
          ) : (
            <Lock className="h-4 w-4 text-muted-foreground/40 shrink-0 mt-1" />
          )}
        </div>

        {/* 본문 — multiplier 칩 OR 내부 사용 라벨 OR BBDX 코어 안내 */}
        <div className="flex-1 flex flex-col gap-2">
          {hasMultiplier && tone ? (
            <div
              className={cn(
                "inline-flex items-center gap-2 self-start rounded-sm border px-2.5 py-1 font-mono uppercase tracking-wider text-xs",
                tone.cls
              )}
            >
              <span className="font-bold">
                ×{(currentMultiplier as number).toFixed(2)}
              </span>
              <span className="opacity-70 text-[10px]">{tone.label}</span>
            </div>
          ) : isBbdxCore ? (
            <div className="inline-flex items-center gap-1.5 self-start rounded-sm border border-neon-pink/50 bg-neon-pink/10 px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-neon-pink">
              <ArrowRight className="h-3 w-3" />
              Main Scanner
            </div>
          ) : isInternal ? (
            <div className="inline-flex items-center gap-1.5 self-start rounded-sm border border-muted-foreground/30 bg-muted/20 px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              <Lock className="h-3 w-3" />
              BBDX 내부 사용
            </div>
          ) : (
            <div className="text-[11px] font-mono text-muted-foreground/70 uppercase tracking-wider">
              실시간 데이터 미연결
            </div>
          )}

          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
            {reason ?? modifier.description}
          </p>
        </div>

        {/* 푸터 — Modifier Only 표준 라벨 (CharterFooter 의 미니 버전) */}
        <div className="flex items-center gap-1.5 pt-2 border-t border-border/30">
          <Info className="h-3 w-3 text-neon-cyan/70 shrink-0" />
          <span className="font-mono text-[9px] uppercase tracking-wider text-neon-cyan/70">
            Modifier Only · 헌장 규칙 3
          </span>
        </div>
      </div>
    </HudPanel>
  );
}
