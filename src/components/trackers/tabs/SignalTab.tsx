/**
 * SignalTab — 실시간 시그널 표준 레이아웃.
 *
 * 명세: TRACKER_TAB_STANDARD §2.2.
 *   - PrimarySignalCard: side / final_confidence / threshold / status
 *   - Breakdown: 각 차원 contribution bar
 *   - Active Modifiers: 현재 적용된 modifier 목록 (값/source/decay)
 *   - Price Table: 진입가 / STOP / 목표
 *   - SparkLine: 지난 N 시간 변화
 *
 * 데이터 미정 시 placeholder 카드를 prop 으로 받음.
 */

import { Activity, Clock, Loader2, Target, TrendingDown, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { HudPanel, StatCard } from "@/components/HudPanel";
import { cn } from "@/lib/utils";

export type SignalSide = "long" | "short" | "neutral";

export interface BreakdownItem {
  category: string;
  /** raw 값 (0~1 또는 -1~+1) */
  value: number;
  /** 가중치 (예: 0.30) */
  weight: number;
  /** contribution = value * weight * 100 */
  contribution: number;
  /** Tailwind 색상 클래스 또는 oklch 값 */
  color?: string;
}

export interface ActiveModifier {
  name: string;
  /** -50 ~ +50 점수 */
  value: number;
  source: string;
  /** 0~1 감쇠 비율 */
  decay_factor: number;
}

export interface SignalSnapshot {
  side: SignalSide;
  final_confidence: number;
  threshold: number;
  breakdown: BreakdownItem[];
  active_modifiers: ActiveModifier[];
  entry_price?: number;
  stop_price?: number;
  stop_pct?: number;
  targets?: number[];
  targets_pct?: number[];
  history_6h?: Array<{ ts: number; confidence: number }>;
}

export interface SignalTabProps {
  /** 시그널 데이터. undefined 면 로딩, null 면 시그널 없음. */
  signal?: SignalSnapshot | null;
  isLoading?: boolean;
  /** 시그널 미수신 시 안내 문구 / 카드 (Phase pending 등). */
  emptyState?: ReactNode;
}

function PrimarySignalCard({ signal }: { signal: SignalSnapshot }) {
  const isLong = signal.side === "long";
  const isShort = signal.side === "short";
  const passed = signal.final_confidence >= signal.threshold;

  const sideColor = isLong
    ? "text-neon-green"
    : isShort
      ? "text-neon-red"
      : "text-muted-foreground";

  const SideIcon = isLong ? TrendingUp : isShort ? TrendingDown : Activity;

  return (
    <HudPanel
      title="현재 시그널"
      subtitle="PRIMARY SIGNAL"
      variant={passed ? "highlight" : "default"}
    >
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <SideIcon className={cn("h-8 w-8", sideColor)} />
          <div>
            <div
              className={cn(
                "font-display text-3xl font-bold uppercase tracking-wider",
                sideColor
              )}
            >
              {signal.side}
            </div>
            <div className="font-mono text-[10px] text-muted-foreground uppercase">
              direction
            </div>
          </div>
        </div>

        <div className="h-12 w-px bg-border/40" />

        <div>
          <div className="font-display text-3xl font-bold text-neon-cyan tabular-nums">
            {signal.final_confidence.toFixed(1)}
          </div>
          <div className="font-mono text-[10px] text-muted-foreground uppercase">
            confidence
          </div>
        </div>

        <div className="h-12 w-px bg-border/40" />

        <div>
          <div className="font-display text-3xl font-bold text-foreground tabular-nums">
            {signal.threshold}
          </div>
          <div className="font-mono text-[10px] text-muted-foreground uppercase">
            threshold
          </div>
        </div>

        <div className="ml-auto">
          <span
            className={cn(
              "px-3 py-1.5 rounded-sm font-mono text-xs uppercase tracking-wider",
              passed
                ? "bg-neon-green/10 text-neon-green border border-neon-green/40"
                : "bg-muted/20 text-muted-foreground border border-border/40"
            )}
          >
            {passed ? "진입 권고" : "대기"}
          </span>
        </div>
      </div>
    </HudPanel>
  );
}

function BreakdownBar({ item }: { item: BreakdownItem }) {
  const pct = Math.max(-100, Math.min(100, item.contribution));
  const positive = pct >= 0;
  const color = item.color ?? (positive ? "bg-neon-green" : "bg-neon-red");
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs font-mono">
        <span className="text-foreground/90">{item.category}</span>
        <span className="tabular-nums text-muted-foreground">
          {item.weight.toFixed(2)} × {(item.value * 100).toFixed(0)} ={" "}
          <span className={positive ? "text-neon-green" : "text-neon-red"}>
            {positive ? "+" : ""}
            {pct.toFixed(1)}
          </span>
        </span>
      </div>
      <div className="relative h-2 bg-background/60 border border-border/30 rounded-sm overflow-hidden">
        <div
          className={cn("absolute top-0 bottom-0 left-1/2 transition-all", color)}
          style={{
            width: `${Math.abs(pct) / 2}%`,
            transform: positive ? "translateX(0)" : "translateX(-100%)",
          }}
        />
        <div className="absolute top-0 bottom-0 left-1/2 w-px bg-border/60" />
      </div>
    </div>
  );
}

function ModifierCard({ mod }: { mod: ActiveModifier }) {
  const positive = mod.value >= 0;
  return (
    <div className="border border-border/30 rounded-sm bg-background/40 p-3 space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-foreground">{mod.name}</span>
        <span
          className={cn(
            "font-display text-sm font-bold tabular-nums",
            positive ? "text-neon-green" : "text-neon-red"
          )}
        >
          {positive ? "+" : ""}
          {mod.value.toFixed(1)}점
        </span>
      </div>
      <div className="flex items-center justify-between gap-2 text-[10px] font-mono text-muted-foreground">
        <span className="truncate">{mod.source}</span>
        <span className="flex items-center gap-1 shrink-0">
          <Clock className="h-3 w-3" />
          decay {(mod.decay_factor * 100).toFixed(0)}%
        </span>
      </div>
    </div>
  );
}

function SparkLine({ data }: { data: Array<{ ts: number; confidence: number }> }) {
  if (data.length === 0) {
    return (
      <p className="font-mono text-xs text-muted-foreground italic">데이터 없음</p>
    );
  }
  return (
    <div className="h-24 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="sigSpark" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="oklch(0.85 0.25 320)" stopOpacity={0.5} />
              <stop offset="100%" stopColor="oklch(0.85 0.25 320)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="confidence"
            stroke="oklch(0.85 0.25 320)"
            strokeWidth={2}
            fill="url(#sigSpark)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SignalTab({ signal, isLoading, emptyState }: SignalTabProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-neon-cyan" />
        <p className="font-mono text-xs text-muted-foreground">시그널 로드 중...</p>
      </div>
    );
  }

  if (signal == null) {
    return (
      <div>
        {emptyState ?? (
          <HudPanel title="시그널 없음">
            <p className="font-mono text-sm text-muted-foreground">
              현재 활성 시그널이 없습니다. 새 콘텐츠/이벤트 수신 시 자동 갱신됩니다.
            </p>
          </HudPanel>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PrimarySignalCard signal={signal} />

      <div className="grid gap-4 md:grid-cols-2">
        <HudPanel title="점수 분해 (Breakdown)">
          <div className="space-y-3">
            {signal.breakdown.length === 0 ? (
              <p className="font-mono text-xs text-muted-foreground italic">
                기여 데이터 없음
              </p>
            ) : (
              signal.breakdown.map((b, i) => <BreakdownBar key={`${b.category}-${i}`} item={b} />)
            )}
          </div>
        </HudPanel>

        <HudPanel title="현재 적용된 modifier">
          <div className="space-y-2">
            {signal.active_modifiers.length === 0 ? (
              <p className="font-mono text-xs text-muted-foreground italic">
                활성 modifier 없음
              </p>
            ) : (
              signal.active_modifiers.map((m, i) => (
                <ModifierCard key={`${m.name}-${i}`} mod={m} />
              ))
            )}
          </div>
        </HudPanel>
      </div>

      {/* Price + targets */}
      {(signal.entry_price != null || signal.targets?.length) && (
        <HudPanel
          title="진입가 / STOP / 목표"
          headerRight={<Target className="h-4 w-4 text-neon-cyan" />}
        >
          <div className="grid gap-3 sm:grid-cols-3 md:grid-cols-4">
            {signal.entry_price != null && (
              <StatCard label="ENTRY" value={`$${signal.entry_price.toFixed(2)}`} />
            )}
            {signal.stop_price != null && (
              <StatCard
                label="STOP"
                value={`$${signal.stop_price.toFixed(2)}`}
                variant="negative"
                change={signal.stop_pct}
              />
            )}
            {(signal.targets ?? []).map((tp, i) => (
              <StatCard
                key={i}
                label={`TP${i + 1}`}
                value={`$${tp.toFixed(2)}`}
                variant="positive"
                change={signal.targets_pct?.[i]}
              />
            ))}
          </div>
        </HudPanel>
      )}

      {/* SparkLine */}
      {signal.history_6h && signal.history_6h.length > 0 && (
        <HudPanel title="시그널 변화 (지난 6시간)">
          <SparkLine data={signal.history_6h} />
        </HudPanel>
      )}
    </div>
  );
}
