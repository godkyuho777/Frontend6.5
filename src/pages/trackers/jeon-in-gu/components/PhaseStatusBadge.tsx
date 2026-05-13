/**
 * 전인구 시그널 Phase 상태 배지 — 헤더 우측 표시.
 *
 * Phase 1.3~5 미완 = "Beta · Phase pending" 노출.
 */

import { AlertTriangle } from "lucide-react";

export function PhaseStatusBadge() {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 border border-yellow-500/40 bg-yellow-500/10 rounded-sm">
      <AlertTriangle className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
      <div className="font-mono text-[10px] uppercase tracking-wider">
        <span className="text-yellow-400 font-bold">Beta</span>
        <span className="text-muted-foreground mx-1.5">·</span>
        <span className="text-yellow-200/80">Phase 1.3~5 pending</span>
      </div>
    </div>
  );
}
