/**
 * 전인구 시그널 — 실시간 신호 탭.
 *
 * 명세: JEON_IN_GU_SIGNAL_TRACKER §3.6 [6.3].
 *
 * 백엔드 라우트 (Phase 1.3+ 활성 후 사용 예정):
 *   - trpc.jeonInGu.currentModifier.useQuery({ symbol, side })
 *   - trpc.jeonInGu.config.useQuery()
 *
 * 본 페이지는 현재 활성화된 router 가 frontend 타입에 없으므로 placeholder.
 * Phase 1 데이터 수집 cron 활성 + DB 데이터 누적 후 본 placeholder 제거.
 */

import { SignalTab as SignalTabStandard } from "@/components/trackers/tabs";
import { PhasePendingCard } from "../components/PhasePendingCard";

export function SignalTab() {
  return (
    <SignalTabStandard
      signal={null}
      isLoading={false}
      emptyState={
        <PhasePendingCard
          phase="Phase 1.3 ~ 3 pending"
          title="실시간 시그널 — API keys & cron 활성 대기"
          unlocksWhen={
            "Phase 1.3 YouTube monitor + Phase 1.5 polling cron + Phase 2 LLM classifier + Phase 3 modifier ±0.50 통합 활성 후"
          }
        >
          <div className="space-y-3 font-mono text-xs">
            <div>
              <span className="text-muted-foreground uppercase tracking-wider text-[10px]">
                활성 시 표시:
              </span>
              <ul className="space-y-1 mt-1.5 text-foreground/80">
                <li>· PrimarySignalCard (side · final_confidence · threshold)</li>
                <li>· Breakdown (BBDX · Wave · Macro · Onchain · 전인구 기여)</li>
                <li>· Active modifiers (sentiment_score · decay · source URL)</li>
                <li>· 진입가 / STOP / TP1 / TP2 표</li>
                <li>· 시그널 변화 sparkline (지난 6시간)</li>
              </ul>
            </div>
            <div className="pt-2 border-t border-border/30">
              <span className="text-muted-foreground uppercase tracking-wider text-[10px]">
                trpc 경로:
              </span>
              <div className="mt-1.5 text-neon-cyan">
                <code>trpc.jeonInGu.currentModifier.useQuery</code>(
                <code>{`{ symbol: "BTCUSDT", side: "long" }`}</code>)
              </div>
            </div>
          </div>
        </PhasePendingCard>
      }
    />
  );
}
