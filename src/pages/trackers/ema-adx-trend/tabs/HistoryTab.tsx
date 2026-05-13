/**
 * EMA + ADX 정배열 추세 — 히스토리 탭 (Phase 2 — DB 미연결 placeholder).
 */

import { HudPanel } from "@/components/HudPanel";
import { History } from "lucide-react";

export function HistoryTab() {
  return (
    <div className="space-y-4">
      <HudPanel title="시그널 히스토리" subtitle="DB 연결 후 활성 (Phase 2)">
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <History className="h-10 w-10 text-muted-foreground/40" />
          <p className="font-mono text-xs text-muted-foreground text-center">
            EMA + ADX 정배열 추세 시그널의 entries/exits/calibration 이벤트는 추후 DB
            persistence (`backtest_runs` 와 동일 패턴) 활성 후 본 탭에 timeline 으로
            표시됩니다.
          </p>
          <p className="font-mono text-[10px] text-muted-foreground/60 text-center pt-3 max-w-md">
            현재는 실시간 시그널 (Signal 탭) 과 백테스트 결과 (Backtest 탭) 를
            참조해주세요.
          </p>
        </div>
      </HudPanel>
    </div>
  );
}
