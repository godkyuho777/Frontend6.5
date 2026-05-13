/**
 * Fibonacci & Trendline — 히스토리 탭 (placeholder).
 *
 * 명세: TRACKER_TAB_STANDARD §2.5. DB ingest 활성 후 신호 timeline 채워짐.
 * 본 탭은 사용자가 진입 권고 카드 → 청산 결과 → 보정 이력을 추적 가능.
 */

import { HistoryTab as HistoryTabStandard } from "@/components/trackers/tabs";
import { HudPanel } from "@/components/HudPanel";

export function HistoryTab() {
  return (
    <HistoryTabStandard
      items={[]}
      isLoading={false}
      emptyState={
        <HudPanel title="신호 히스토리 누적 중" subtitle="DB INGEST PENDING">
          <div className="space-y-3 font-mono text-xs">
            <p className="text-foreground/90 leading-relaxed">
              Fibonacci 시그널 히스토리는 DB ingest 활성화 후 자동 누적됩니다.
              매번 Fib zone 진입/이탈 + 추세선 break 이벤트가 timeline 카드로 표시될 예정.
            </p>
            <div className="pt-2 border-t border-border/30">
              <span className="text-muted-foreground uppercase tracking-wider text-[10px]">
                향후 표시 timeline 카드:
              </span>
              <ul className="space-y-1 mt-1.5 text-foreground/80">
                <li>
                  · <span className="text-neon-pink">진입</span>: Fib level 도달
                  + side / confidence / entry_price
                </li>
                <li>
                  · <span className="text-neon-cyan">청산</span>: PnL%
                  + Fib 다음 level 도달 / STOP / 추세선 break
                </li>
                <li>
                  · <span className="text-yellow-400">소스</span>: 추세선
                  자동 감지 + 갱신 로그
                </li>
                <li>
                  · <span className="text-purple-400">보정</span>: fibMult
                  weight 변경 (0.382 vs 0.618 contribution 재학습)
                </li>
              </ul>
            </div>
          </div>
        </HudPanel>
      }
    />
  );
}
