import { Activity, AlertCircle, Clock, Loader2, ServerCrash } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { MacroIndicatorStatus } from "@/hooks/useMacroIndicator";

/**
 * MacroIndicatorPage 헤더에 표시되는 LIVE / STUB / STALE / ERROR / LOADING 배지.
 * 한 곳에서 색상/아이콘 정리 — 5개 페이지 공통.
 */
export function MacroStatusBadge({
  status,
}: {
  status: MacroIndicatorStatus;
}) {
  const map: Record<
    MacroIndicatorStatus,
    {
      label: string;
      icon: typeof Activity;
      className: string;
    }
  > = {
    live: {
      label: "LIVE",
      icon: Activity,
      className: "border-emerald-500/50 text-neon-green bg-emerald-500/10",
    },
    stub: {
      label: "STUB",
      icon: AlertCircle,
      className: "border-orange-400/60 text-orange-300 bg-orange-500/10",
    },
    stale: {
      label: "STALE",
      icon: Clock,
      className: "border-yellow-500/60 text-neon-yellow bg-yellow-500/10",
    },
    error: {
      label: "ERROR",
      icon: ServerCrash,
      className: "border-red-500/60 text-red-400 bg-red-500/10",
    },
    loading: {
      label: "LOADING",
      icon: Loader2,
      className: "border-neon-cyan/50 text-neon-cyan bg-cyan-500/10",
    },
  };
  const cfg = map[status];
  const Icon = cfg.icon;
  return (
    <Badge
      variant="outline"
      className={cn("font-mono text-[10px] inline-flex items-center gap-1", cfg.className)}
    >
      <Icon className={cn("h-3 w-3", status === "loading" && "animate-spin")} />
      {cfg.label}
    </Badge>
  );
}
