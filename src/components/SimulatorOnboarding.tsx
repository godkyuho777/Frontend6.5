/**
 * SimulatorOnboarding — 신규 사용자 5-step 가이드 모달 (Phase 4 #15, 2026-05-21).
 *
 * 진입 시점:
 *   - SimulatorWelcome 의 register 성공 → Simulator main 첫 mount 시 1회.
 *   - localStorage `tradelab.sim.onboardingShown` 키가 false 일 때만 노출.
 *   - 사용자가 "건너뛰기" 또는 "시작하기" 클릭 시 자동 mark → 다시 보이지 않음.
 *
 * 재진입 시점:
 *   - Simulator 헤더의 HelpCircle 버튼 → 부모가 직접 `open=true` 로 강제 노출.
 *   - 이 경로는 onboardingShown 키를 변경하지 않음 (이미 true 라도 그대로 유지).
 *
 * 정책:
 *   - shadcn Dialog (Radix) 사용 — esc / overlay 클릭으로 닫기 가능.
 *   - 한국어 본문 + 이모지 (사용자 친화) — 헌장: 모의투자 UX 학습 목적.
 *   - 본 컴포넌트는 자체 mark 책임 X — 부모가 onClose 콜백 안에서 결정.
 */

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Wallet,
  TrendingUp,
  Settings2,
  ShieldAlert,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";

interface OnboardingStep {
  /** Step 헤더 아이콘 (lucide). */
  Icon: React.ComponentType<{ className?: string }>;
  /** Step 헤더 타이틀 (이모지 + 한글 가능). */
  title: string;
  /** Step 본문 — 문장 단위 줄바꿈을 위해 string[] 로 분리. */
  body: string[];
  /** 강조 색 (cyberpunk 테마 oklch 계열). */
  accent: string;
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    Icon: Wallet,
    title: "가상 자본 $200,000",
    accent: "text-neon-green",
    body: [
      "실제 자금 없이 모의 거래를 체험합니다. 모든 데이터는 본 브라우저의 localStorage 에만 저장되며 서버로 전송되지 않습니다.",
      "언제든 Reset 버튼으로 초기화 가능 · Export / Import 로 다른 브라우저에 백업 복원 가능.",
    ],
  },
  {
    Icon: TrendingUp,
    title: "BBDX 시그널 따라 첫 거래",
    accent: "text-neon-cyan",
    body: [
      "RSI / Bollinger Bands / ADX 기반 진입 시그널을 확인하고 LONG (상승 베팅) 또는 SHORT (하락 베팅) 을 선택합니다.",
      "Market 주문은 즉시 체결, Limit 주문은 사용자가 지정한 가격에 도달 시 자동 체결됩니다.",
    ],
  },
  {
    Icon: Settings2,
    title: "레버리지 이해 (권장 1x ~ 10x)",
    accent: "text-neon-yellow",
    body: [
      "Leverage 10x = 1% 가격 변동 → 10% ROE (Return on Equity). 작은 margin 으로 큰 notional 보유.",
      "청산 임계: 1/leverage + 유지 margin (0.5%) 만큼 가격이 불리하게 움직이면 자동 청산.",
      "초보자는 1x~5x 권장 — 변동성 큰 알트는 50x+ 사용 시 분 단위 청산 가능.",
    ],
  },
  {
    Icon: ShieldAlert,
    title: "강제 청산 자동 작동",
    accent: "text-neon-red",
    body: [
      "Positions 탭의 Liq Price 컬럼이 청산 임박 위치를 표시합니다 (LONG 은 아래, SHORT 은 위 방향).",
      "Mark price 가 도달 시 즉시 자동 청산되어 margin 전손 (실 거래소 isolated margin 표준).",
      "MR (Margin Ratio) >= 80% 부터 노란색 / 빨간색 경고 — 추가 margin 또는 사전 종료 권장.",
    ],
  },
  {
    Icon: BarChart3,
    title: "1주일 후 결과 확인",
    accent: "text-neon-pink",
    body: [
      "Simulator Stats 카드에서 본인의 Win Rate · Avg Win/Loss · Expectancy · Max DD 를 확인할 수 있습니다.",
      "BBDX 시스템 baseline (백테스트 표시 승률 · 평균 수익) 과 한 줄 비교도 자동 표시됩니다.",
      "Export 로 백업 파일을 만들어두면 브라우저 캐시 삭제 시에도 데이터를 보존할 수 있습니다.",
    ],
  },
];

interface Props {
  /** Dialog open state — 부모가 제어. */
  open: boolean;
  /**
   * Dialog 가 닫혀야 할 때 호출.
   *   - completed=true: 사용자가 "시작하기" 로 완료 → 부모는 markOnboardingShown.
   *   - completed=false: 사용자가 "건너뛰기" 또는 esc/overlay 클릭 → 부모가 동일하게 mark.
   *   현재 정책 (AUDIT.md §15): 둘 다 다시 안 보이게 mark.
   */
  onClose: (completed: boolean) => void;
}

export function SimulatorOnboarding({ open, onClose }: Props) {
  const [stepIdx, setStepIdx] = useState(0);

  // open 변경 시 첫 step 으로 리셋 — "다시 보기" 호출 후에도 항상 1/5 부터.
  useEffect(() => {
    if (open) setStepIdx(0);
  }, [open]);

  const total = ONBOARDING_STEPS.length;
  const step = ONBOARDING_STEPS[stepIdx];
  const isFirst = stepIdx === 0;
  const isLast = stepIdx === total - 1;

  const handleNext = () => {
    if (isLast) {
      onClose(true);
    } else {
      setStepIdx((i) => Math.min(total - 1, i + 1));
    }
  };
  const handlePrev = () => {
    setStepIdx((i) => Math.max(0, i - 1));
  };
  const handleSkip = () => {
    onClose(false);
  };
  const handleOpenChange = (next: boolean) => {
    // esc / overlay 클릭으로 닫히는 경로 — 정책 §15: skip 과 동일하게 처리.
    if (!next) onClose(false);
  };

  const Icon = step.Icon;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md max-w-[calc(100vw-1.5rem)] border-neon-cyan/30 bg-card/95 backdrop-blur-sm shadow-[0_0_40px_-15px_rgba(0,229,255,0.4)]">
        <DialogHeader>
          {/* Top accent */}
          <div className="inline-flex items-center gap-2 self-start px-2 py-0.5 rounded-full border border-neon-cyan/40 bg-neon-cyan/5 font-mono text-[10px] uppercase tracking-wider text-neon-cyan mb-2">
            <Sparkles className="h-3 w-3" />
            <span>Quick Guide · {stepIdx + 1} / {total}</span>
          </div>

          <DialogTitle className="font-display font-bold text-xl flex items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center justify-center rounded-md p-1.5 border",
                step.accent,
                "border-current/40 bg-current/10",
              )}
            >
              <Icon className="h-5 w-5" />
            </span>
            <span className={step.accent}>{step.title}</span>
          </DialogTitle>
          <DialogDescription className="sr-only">
            Simulator 가이드 step {stepIdx + 1} / {total}: {step.title}
          </DialogDescription>
        </DialogHeader>

        {/* Body */}
        <div className="flex flex-col gap-2.5 mt-1">
          {step.body.map((line, i) => (
            <p
              key={i}
              className="font-mono text-[12px] leading-relaxed text-foreground/90"
            >
              {line}
            </p>
          ))}
        </div>

        {/* Step progress dots */}
        <div className="flex items-center justify-center gap-1.5 mt-1">
          {ONBOARDING_STEPS.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setStepIdx(i)}
              aria-label={`Step ${i + 1}`}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === stepIdx
                  ? "w-6 bg-neon-cyan"
                  : i < stepIdx
                    ? "w-1.5 bg-neon-cyan/60"
                    : "w-1.5 bg-border/40 hover:bg-border/70",
              )}
            />
          ))}
        </div>

        <DialogFooter className="!flex-row !justify-between gap-2 mt-2 sm:!justify-between">
          {/* Skip — 항상 왼쪽 */}
          <Button
            type="button"
            variant="ghost"
            onClick={handleSkip}
            className="font-mono text-[11px] text-muted-foreground hover:text-foreground"
          >
            건너뛰기
          </Button>

          {/* Prev / Next — 오른쪽 그룹 */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handlePrev}
              disabled={isFirst}
              className={cn(
                "font-mono text-[11px]",
                isFirst && "opacity-40 cursor-not-allowed",
              )}
            >
              <ChevronLeft className="h-3.5 w-3.5 mr-1" />
              이전
            </Button>
            <Button
              type="button"
              onClick={handleNext}
              className={cn(
                "font-mono text-[11px]",
                isLast
                  ? "bg-neon-cyan hover:bg-neon-cyan/80 text-background"
                  : "bg-neon-cyan/80 hover:bg-neon-cyan text-background",
              )}
            >
              {isLast ? (
                <>
                  <Sparkles className="h-3.5 w-3.5 mr-1" />
                  시작하기
                </>
              ) : (
                <>
                  다음
                  <ChevronRight className="h-3.5 w-3.5 ml-1" />
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
