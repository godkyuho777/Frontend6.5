/**
 * EMA + ADX 정배열 추세 — 백테스트 탭.
 *
 * Backtest 페이지의 strategy="trend" 와 동일한 로직을 백테스트 엔진이 이미
 * 처리 중. 본 탭은 사용자가 Backtest 페이지로 이동해 trend 전략을 선택하도록
 * 안내 + Last run 메트릭 placeholder.
 */

import { useLocation } from "wouter";
import { HudPanel } from "@/components/HudPanel";
import { Button } from "@/components/ui/button";
import { FlaskConical, ExternalLink } from "lucide-react";

export function BacktestTab() {
  const [, setLocation] = useLocation();

  return (
    <div className="space-y-4">
      <HudPanel title="백테스트 안내" subtitle="공통 Backtest 엔진과 통합">
        <div className="space-y-4 font-mono text-xs">
          <p className="text-foreground/90 leading-relaxed">
            EMA + ADX 정배열 전략의 historical alpha 측정은 공통 Backtest 페이지의{" "}
            <span className="text-neon-cyan font-bold">strategy="trend"</span> 옵션으로 수행됩니다.
            동일한 룰 (EMA 정배열 + ADX≥20 + +DI {">"} -DI + SMA 상승 + HH/HL) 을 lookahead-free 로
            재생하여 winRate · Sharpe · Profit Factor · Max Drawdown 산출.
          </p>

          <Button
            onClick={() => setLocation("/backtest?strategy=trend")}
            className="bg-neon-cyan/10 border border-neon-cyan/40 text-neon-cyan hover:bg-neon-cyan/20 font-display font-bold tracking-wider"
          >
            <FlaskConical className="h-4 w-4 mr-2" />
            BACKTEST 페이지로 이동
            <ExternalLink className="h-3 w-3 ml-2" />
          </Button>
        </div>
      </HudPanel>

      <HudPanel title="권장 calibration 절차" subtitle="threshold ≥ 55 의 통계적 검증">
        <ol className="space-y-2 font-mono text-xs text-foreground/90 list-decimal list-inside">
          <li>Backtest 페이지에서 <span className="text-neon-cyan">strategy=trend</span> + <span className="text-neon-cyan">tf=4h</span> + 최근 1년 기간 설정</li>
          <li>RUN BACKTEST 실행 → winRate, Sharpe, Profit Factor 메트릭 확인</li>
          <li>--calibrate 옵션 (CLI) 또는 CALIBRATION 탭에서 Wilson 95% CI 측정</li>
          <li>Wilson CI lower ≥ 0.50 AND Profit Factor ≥ 1.50 만족 시 threshold 채택</li>
          <li>만족 안 되는 경우 임계값을 60/65 로 상향 후 재측정</li>
        </ol>
      </HudPanel>

      <HudPanel title="기존 백테스트 결과 (참고)" subtitle="현재 backtest engine 의 trend 전략 메트릭">
        <p className="font-mono text-xs text-muted-foreground py-2">
          Backtest 페이지에서 strategy=trend 로 마지막 실행한 결과가 자동 표시될 예정 (Phase 2).
          현재는 Backtest 페이지에서 직접 확인 가능합니다.
        </p>
      </HudPanel>
    </div>
  );
}
