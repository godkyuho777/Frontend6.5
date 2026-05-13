/**
 * 전인구 시그널 — 히스토리 탭.
 *
 * 명세: JEON_IN_GU_SIGNAL_TRACKER §3.6 [6.6] — Timeline + filter.
 *
 * 백엔드 라우트 (Phase 1.5 polling cron 활성 후 사용 예정):
 *   - trpc.jeonInGu.recentContents.useQuery({ limit: 20 })
 *
 * Phase 1.5 미완 = 콘텐츠 DB 누적 X. 빈 timeline 표시.
 */

import { HistoryTab as HistoryTabStandard } from "@/components/trackers/tabs";
import { PhasePendingCard } from "../components/PhasePendingCard";

export function HistoryTab() {
  return (
    <HistoryTabStandard
      items={[]}
      isLoading={false}
      emptyState={
        <PhasePendingCard
          phase="Phase 1.5 pending"
          title="콘텐츠 timeline — polling cron 활성 후 누적"
          unlocksWhen="Phase 1.5 YouTube 폴링 cron (5분 주기) 활성 후 새 영상이 DB 에 누적되면 자동 표시"
        >
          <div className="space-y-3 font-mono text-xs">
            <div>
              <span className="text-muted-foreground uppercase tracking-wider text-[10px]">
                활성 시 표시되는 timeline 카드:
              </span>
              <ul className="space-y-1 mt-1.5 text-foreground/80">
                <li>
                  · <span className="text-yellow-400">소스</span>: 전인구 영상
                  썸네일 + 제목 + sentiment + 원본 링크
                </li>
                <li>
                  · <span className="text-neon-pink">진입</span>: BBDX 진입
                  카드 (side · confidence · entry_price · outcome)
                </li>
                <li>
                  · <span className="text-neon-cyan">청산</span>: PnL%
                  + 청산 사유
                </li>
                <li>
                  · <span className="text-purple-400">보정</span>: weight
                  변경 카드 (before → after · reason · R²)
                </li>
              </ul>
            </div>
            <div className="pt-2 border-t border-border/30">
              <span className="text-muted-foreground uppercase tracking-wider text-[10px]">
                trpc 경로:
              </span>
              <div className="mt-1.5 text-neon-cyan">
                <code>trpc.jeonInGu.recentContents.useQuery</code>(
                <code>{`{ limit: 20 }`}</code>)
              </div>
            </div>
          </div>
        </PhasePendingCard>
      }
    />
  );
}
