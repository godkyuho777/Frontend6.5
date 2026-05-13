/**
 * HistoryTab — 히스토리 표준 레이아웃.
 *
 * 명세: TRACKER_TAB_STANDARD §2.5.
 *   - date/type 필터
 *   - Timeline (entry · source · calibration · exit 카드)
 *   - Pagination
 *
 * 콘텐츠/시그널 누적 표시 — 트래커별 데이터 source 는 props 로 주입.
 */

import { ArrowRight, ExternalLink, History, TrendingDown, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";
import { HudPanel } from "@/components/HudPanel";
import { cn } from "@/lib/utils";

export type HistoryItemType = "entry" | "exit" | "source" | "calibration";

export interface HistoryEntryItem {
  type: "entry";
  id: string;
  timestamp: number;
  side: "long" | "short";
  confidence: number;
  entry_price?: number;
  outcome?: "win" | "loss" | "open" | "unknown";
}

export interface HistoryExitItem {
  type: "exit";
  id: string;
  timestamp: number;
  pnl_pct: number;
  reason: string;
}

export interface HistorySourceItem {
  type: "source";
  id: string;
  timestamp: number;
  title: string;
  sentiment?: "bullish" | "bearish" | "neutral";
  url?: string;
  thumbnail?: string;
}

export interface HistoryCalibrationItem {
  type: "calibration";
  id: string;
  timestamp: number;
  weight_before: number;
  weight_after: number;
  reason: string;
}

export type HistoryItem =
  | HistoryEntryItem
  | HistoryExitItem
  | HistorySourceItem
  | HistoryCalibrationItem;

export interface HistoryTabProps {
  items: HistoryItem[];
  /** 활성 필터. 미지정 시 모두 표시. */
  typeFilter?: ReadonlyArray<HistoryItemType>;
  onTypeFilterChange?: (filters: HistoryItemType[]) => void;
  /** Phase pending / empty 메시지. */
  emptyState?: ReactNode;
  isLoading?: boolean;
}

const TYPE_LABELS: Record<HistoryItemType, string> = {
  entry: "진입",
  exit: "청산",
  source: "소스",
  calibration: "보정",
};

function formatRelative(ts: number): string {
  const now = Date.now();
  const diff = now - ts;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}초 전`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  return `${day}일 전`;
}

function EntryCard({ item }: { item: HistoryEntryItem }) {
  const SideIcon = item.side === "long" ? TrendingUp : TrendingDown;
  const sideColor = item.side === "long" ? "text-neon-green" : "text-neon-red";
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <SideIcon className={cn("h-4 w-4 shrink-0", sideColor)} />
      <span
        className={cn(
          "font-display text-sm font-bold uppercase tracking-wider",
          sideColor
        )}
      >
        {item.side}
      </span>
      <span className="font-mono text-xs text-neon-cyan tabular-nums">
        {item.confidence.toFixed(0)}점
      </span>
      {item.entry_price != null && (
        <span className="font-mono text-xs text-muted-foreground">
          @ ${item.entry_price.toFixed(2)}
        </span>
      )}
      {item.outcome && item.outcome !== "unknown" && (
        <span
          className={cn(
            "font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-sm border",
            item.outcome === "win" && "border-neon-green/40 text-neon-green",
            item.outcome === "loss" && "border-neon-red/40 text-neon-red",
            item.outcome === "open" && "border-neon-cyan/40 text-neon-cyan"
          )}
        >
          {item.outcome}
        </span>
      )}
    </div>
  );
}

function ExitCard({ item }: { item: HistoryExitItem }) {
  const positive = item.pnl_pct >= 0;
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <span
        className={cn(
          "font-display text-sm font-bold tabular-nums",
          positive ? "text-neon-green" : "text-neon-red"
        )}
      >
        {positive ? "+" : ""}
        {item.pnl_pct.toFixed(2)}%
      </span>
      <span className="font-mono text-xs text-muted-foreground">{item.reason}</span>
    </div>
  );
}

function SourceCard({ item }: { item: HistorySourceItem }) {
  const sentimentColor =
    item.sentiment === "bullish"
      ? "text-neon-green"
      : item.sentiment === "bearish"
        ? "text-neon-red"
        : "text-muted-foreground";
  return (
    <div className="flex items-start gap-3 flex-wrap">
      {item.thumbnail && (
        <img
          src={item.thumbnail}
          alt=""
          className="h-12 w-20 object-cover rounded-sm border border-border/30 shrink-0"
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="font-mono text-sm text-foreground/90 line-clamp-2">
          {item.title}
        </div>
        <div className="flex items-center gap-3 mt-1">
          {item.sentiment && (
            <span
              className={cn(
                "font-mono text-[10px] uppercase tracking-wider",
                sentimentColor
              )}
            >
              {item.sentiment}
            </span>
          )}
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-[10px] text-neon-cyan hover:text-neon-pink inline-flex items-center gap-1"
            >
              원본 <ExternalLink className="h-2.5 w-2.5" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function CalibrationCard({ item }: { item: HistoryCalibrationItem }) {
  const diff = item.weight_after - item.weight_before;
  return (
    <div className="flex items-center gap-3 flex-wrap font-mono text-xs">
      <span className="text-muted-foreground">Weight:</span>
      <span className="tabular-nums">{item.weight_before.toFixed(2)}</span>
      <ArrowRight className="h-3 w-3 text-muted-foreground" />
      <span
        className={cn(
          "tabular-nums font-bold",
          diff >= 0 ? "text-neon-green" : "text-neon-red"
        )}
      >
        {item.weight_after.toFixed(2)}
      </span>
      <span className="text-muted-foreground">— {item.reason}</span>
    </div>
  );
}

function TimelineRow({ item }: { item: HistoryItem }) {
  const dotColor =
    item.type === "entry"
      ? "bg-neon-pink"
      : item.type === "exit"
        ? "bg-neon-cyan"
        : item.type === "source"
          ? "bg-yellow-400"
          : "bg-purple-400";

  return (
    <div className="flex items-start gap-3 py-3 border-b border-border/20 last:border-b-0">
      <div className="flex flex-col items-center gap-1 shrink-0 pt-1">
        <span className={cn("h-2 w-2 rounded-full", dotColor)} />
        <span className="font-mono text-[10px] text-muted-foreground uppercase">
          {TYPE_LABELS[item.type]}
        </span>
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="font-mono text-[10px] text-muted-foreground">
          {formatRelative(item.timestamp)}
        </div>
        {item.type === "entry" && <EntryCard item={item} />}
        {item.type === "exit" && <ExitCard item={item} />}
        {item.type === "source" && <SourceCard item={item} />}
        {item.type === "calibration" && <CalibrationCard item={item} />}
      </div>
    </div>
  );
}

export function HistoryTab({
  items,
  typeFilter,
  onTypeFilterChange,
  emptyState,
  isLoading,
}: HistoryTabProps) {
  const allTypes: HistoryItemType[] = ["entry", "exit", "source", "calibration"];
  const active = typeFilter ?? allTypes;
  const filtered = items.filter((it) => active.includes(it.type));

  const toggleType = (t: HistoryItemType) => {
    if (!onTypeFilterChange) return;
    if (active.includes(t)) {
      onTypeFilterChange(active.filter((x) => x !== t));
    } else {
      onTypeFilterChange([...active, t]);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Type:
        </span>
        {allTypes.map((t) => {
          const isActive = active.includes(t);
          return (
            <button
              key={t}
              type="button"
              onClick={() => toggleType(t)}
              disabled={!onTypeFilterChange}
              className={cn(
                "px-2.5 py-1 font-mono text-xs uppercase tracking-wider border rounded-sm transition-all",
                isActive
                  ? "border-neon-pink/40 bg-neon-pink/10 text-neon-pink"
                  : "border-border/30 text-muted-foreground hover:text-neon-cyan",
                !onTypeFilterChange && "opacity-60 cursor-not-allowed"
              )}
            >
              {TYPE_LABELS[t]}
            </button>
          );
        })}
      </div>

      <HudPanel
        title="Timeline"
        subtitle={isLoading ? "LOADING..." : `${filtered.length} items`}
        headerRight={<History className="h-4 w-4 text-neon-cyan" />}
      >
        {filtered.length === 0 ? (
          <div className="py-6">
            {emptyState ?? (
              <p className="font-mono text-xs text-muted-foreground italic">
                기록 없음
              </p>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border/20">
            {filtered.map((it) => (
              <TimelineRow key={`${it.type}-${it.id}`} item={it} />
            ))}
          </div>
        )}
      </HudPanel>
    </div>
  );
}
