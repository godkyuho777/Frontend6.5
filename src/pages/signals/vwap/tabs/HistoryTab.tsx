/**
 * VWAP Strategy — 히스토리 탭 (placeholder).
 *
 * 명세: TRACKER_TAB_STANDARD §2.5. DB ingest 활성 후 신호 timeline 채워짐.
 * 본 탭은 사용자가 VWAP cross / Pullback 감지 / σ band touch 이벤트 추적 가능.
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
              VWAP 시그널 히스토리는 DB ingest 활성화 후 자동 누적됩니다.
              VWAP cross / Pullback v2 감지 / σ band touch 이벤트가 timeline 카드로
              표시될 예정.
            </p>
            <div className="pt-2 border-t border-border/30">
              <span className="text-muted-foreground uppercase tracking-wider text-[10px]">
                향후 표시 timeline 카드:
              </span>
              <ul className="space-y-1 mt-1.5 text-foreground/80">
                <li>
                  · <span className="text-neon-pink">진입</span>: VWAP cross
                  + Pullback v2 + EMA(9) 동의 → side / confidence
                </li>
                <li>
                  · <span className="text-neon-cyan">청산</span>: σ band TP1/TP2
                  도달 또는 VWAP 반대 cross → PnL%
                </li>
                <li>
                  · <span className="text-yellow-400">소스</span>: Volume Profile
                  POC/HVN/LVN 갱신 이벤트
                </li>
                <li>
                  · <span className="text-purple-400">보정</span>: vwapMult
                  weight 변경 (Pullback / σ band 성능 재학습)
                </li>
              </ul>
            </div>
          </div>
        </HudPanel>
      }
    />
  );
}
