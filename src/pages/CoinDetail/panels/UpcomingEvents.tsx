/**
 * UpcomingEvents — 코인 별 예정 이벤트 (token unlock, mainnet upgrade 등).
 *
 * 백엔드 trpc.events.list 가 미존재 시 빈 상태 메시지 표시.
 */

import { HudPanel } from "@/components/HudPanel";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "lucide-react";
import type { UpcomingEvent } from "../hooks/useUpcomingEvents";

interface UpcomingEventsProps {
  events: UpcomingEvent[];
  isAvailable: boolean;
}

const EVENT_TYPE_COLORS: Record<UpcomingEvent["eventType"], string> = {
  unlock: "border-neon-yellow/30 text-neon-yellow",
  upgrade: "border-neon-cyan/30 text-neon-cyan",
  fork: "border-neon-pink/30 text-neon-pink",
  listing: "border-neon-green/30 text-neon-green",
  other: "border-muted/40 text-muted-foreground",
};

export function UpcomingEvents({ events, isAvailable }: UpcomingEventsProps) {
  return (
    <HudPanel
      title="Upcoming Events"
      subtitle="Token unlocks · upgrades · listings"
    >
      {!isAvailable ? (
        <div className="text-center py-6">
          <Calendar className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
          <p className="font-mono text-[11px] text-muted-foreground">
            이벤트 API 미연결 — 백엔드 events.list 라우트 추가 후 표시됩니다.
          </p>
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-6">
          <p className="font-mono text-[11px] text-muted-foreground">
            이 코인에 예정된 이벤트가 없습니다. 어드민에서 추가하세요.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {events.map((e) => (
            <div
              key={e.id}
              className="flex items-start gap-2 p-2 rounded-sm border border-border/20 bg-card/40"
            >
              <div className="flex flex-col items-center justify-center w-10 shrink-0">
                <span className="font-mono text-[9px] text-neon-cyan">
                  D-{e.daysUntil}
                </span>
                <span className="font-display text-sm font-bold text-foreground">
                  {new Date(e.date).getDate()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-display text-xs font-bold text-foreground truncate">
                  {e.title}
                </h4>
                <p className="font-mono text-[10px] text-muted-foreground line-clamp-2">
                  {e.description}
                </p>
              </div>
              <Badge
                variant="outline"
                className={`text-[9px] shrink-0 ${EVENT_TYPE_COLORS[e.eventType]}`}
              >
                {e.eventType.toUpperCase()}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </HudPanel>
  );
}
