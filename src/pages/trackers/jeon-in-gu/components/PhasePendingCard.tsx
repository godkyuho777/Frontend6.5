/**
 * Phase Pending 안내 카드 — 전인구 시그널 트래커 전용.
 *
 * 가중치 ±0.50 경고 + 활성 조건 + SCHEDULE_DEFERRED.md 참조를 일관되게 표시.
 */

import { AlertTriangle, FileText, KeyRound, Scale } from "lucide-react";
import type { ReactNode } from "react";
import { HudPanel } from "@/components/HudPanel";

interface PhasePendingCardProps {
  phase: string;
  title: string;
  /** 어떤 단계가 활성되면 본 카드가 사라지는지. */
  unlocksWhen: string;
  /** 추가 본문. */
  children?: ReactNode;
}

export function PhasePendingCard({
  phase,
  title,
  unlocksWhen,
  children,
}: PhasePendingCardProps) {
  return (
    <HudPanel title={title} subtitle={phase} variant="highlight">
      <div className="space-y-4">
        {/* 가중치 ±0.50 경고 — 모든 카드에 동일 표시 */}
        <div className="flex items-start gap-2 px-3 py-2 border border-neon-pink/40 bg-neon-pink/5 rounded-sm">
          <AlertTriangle className="h-4 w-4 text-neon-pink shrink-0 mt-0.5" />
          <div className="font-mono text-[11px] text-foreground/90 leading-relaxed">
            <span className="text-neon-pink font-bold">가중치 ±0.50</span> =
            BBDX 100점 시스템에 <span className="text-neon-pink font-bold">최대 ±50점 영향</span>.
            LLM 분류 오류 (~20%) · 표본 부족 · 코인 매핑 약함 → 명시적 안전 장치 필요.
          </div>
        </div>

        {/* Phase 활성 조건 */}
        <div className="space-y-2">
          <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            활성 조건
          </div>
          <ul className="space-y-1.5 text-xs font-mono">
            <li className="flex items-start gap-2">
              <KeyRound className="h-3.5 w-3.5 text-neon-cyan shrink-0 mt-0.5" />
              <span className="text-foreground/90">
                <span className="text-neon-cyan">YOUTUBE_API_KEY</span> ·{" "}
                <span className="text-neon-cyan">ANTHROPIC_API_KEY</span> ·{" "}
                <span className="text-neon-cyan">JEON_IN_GU_CHANNEL_ID</span>{" "}
                env 설정
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Scale className="h-3.5 w-3.5 text-yellow-400 shrink-0 mt-0.5" />
              <span className="text-foreground/90">변호사 검토 완료 (명예훼손 위험)</span>
            </li>
            <li className="flex items-start gap-2">
              <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
              <span className="text-foreground/90">
                Schedule: <code className="text-neon-cyan">docs/SCHEDULE_DEFERRED.md</code>{" "}
                <code className="text-neon-cyan">D-002</code>
              </span>
            </li>
          </ul>
        </div>

        {/* Unlock condition */}
        <div className="px-3 py-2 border border-border/30 bg-background/40 rounded-sm">
          <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
            unlock 시점
          </div>
          <div className="font-mono text-xs text-neon-cyan">{unlocksWhen}</div>
        </div>

        {/* 추가 본문 */}
        {children && <div className="pt-2">{children}</div>}
      </div>
    </HudPanel>
  );
}
