/**
 * /lite/alerts — 단순화된 알림 설정 (인증 필요)
 *
 * Pro AlertSettings 의 RSI/ADX 임계값 조정 기능 대신, 일반인용 프리셋 3개:
 *   1. 매수 추천이 뜨면 알려줘 (Lite recommendation: BUY/STRONG_BUY)
 *   2. 내 포지션이 일정 수익/손실에 도달하면 알려줘
 *   3. 시장 분위기가 크게 바뀌면 알려줘
 */

import { LiteCard } from "@/components/lite/LiteCard";
import { Button } from "@/components/ui/button";
import { Bell, LogIn, Sparkles, Wallet, Compass } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { toast } from "sonner";

interface PresetState {
  buyAlert: boolean;
  pnlAlert: boolean;
  pnlThreshold: number;
  moodAlert: boolean;
}

const ALERT_PREFS_KEY = "tradelab.lite.alertPrefs";

const DEFAULT_PREFS: PresetState = {
  buyAlert: true,
  pnlAlert: true,
  pnlThreshold: 5,
  moodAlert: false,
};

function loadPrefs(): PresetState {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(ALERT_PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<PresetState>) };
  } catch {
    return DEFAULT_PREFS;
  }
}

export default function LiteAlerts() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const isLoggedIn = !!user;

  const [state, setState] = useState<PresetState>(loadPrefs);

  if (!isLoggedIn) {
    return (
      <LiteCard
        icon={<LogIn className="h-5 w-5 text-neon-cyan" />}
        title="로그인이 필요해요"
        subtitle="알림은 본인 계정에만 도착해요"
        variant="muted"
      >
        <Button
          size="sm"
          variant="outline"
          onClick={() => setLocation("/lite")}
          className="font-sans text-[11px] border-neon-cyan/30 text-neon-cyan"
        >
          돌아가기
        </Button>
      </LiteCard>
    );
  }

  return (
    <div className="space-y-4">
      <LiteCard
        icon={<Bell className="h-5 w-5 text-neon-pink" />}
        title="알림 설정"
        subtitle="복잡한 임계값 대신, 평소에 쓰는 말로 골라요"
      >
        <p className="font-sans text-sm text-muted-foreground">
          RSI 나 ADX 같은 숫자를 직접 정하지 않아도 돼요. 필요한 경우만 켜면, 우리가
          시그널 시스템을 모니터링해서 알려드려요.
        </p>
      </LiteCard>

      <PresetToggle
        icon={<Sparkles className="h-5 w-5 text-neon-green" />}
        title="매수 추천이 뜨면 알려줘"
        desc="시장에서 BUY / STRONG_BUY 라벨이 새로 발생할 때 알림."
        on={state.buyAlert}
        onChange={(v) => setState({ ...state, buyAlert: v })}
      />

      <PresetToggle
        icon={<Wallet className="h-5 w-5 text-neon-cyan" />}
        title="내 포지션이 ±5% 가면 알려줘"
        desc="오픈 포지션의 PnL 이 일정 폭 도달 시 익절 / 손절 검토 알림."
        on={state.pnlAlert}
        onChange={(v) => setState({ ...state, pnlAlert: v })}
      >
        {state.pnlAlert && (
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            {[3, 5, 8, 10].map((p) => (
              <button
                key={p}
                onClick={() => setState({ ...state, pnlThreshold: p })}
                className={cn(
                  "px-3 py-1 rounded-lg font-sans text-[11px] border transition-colors",
                  state.pnlThreshold === p
                    ? "border-neon-cyan/40 bg-neon-cyan/10 text-neon-cyan"
                    : "border-border/30 text-muted-foreground hover:text-foreground"
                )}
              >
                ±{p}%
              </button>
            ))}
          </div>
        )}
      </PresetToggle>

      <PresetToggle
        icon={<Compass className="h-5 w-5 text-neon-yellow" />}
        title="시장 분위기가 바뀌면 알려줘"
        desc="bullish ↔ bearish 전환 같은 큰 변화가 있을 때만 (소음 적음)."
        on={state.moodAlert}
        onChange={(v) => setState({ ...state, moodAlert: v })}
      />

      <Button
        onClick={() => {
          // 선택한 프리셋을 이 기기에 저장한다 (localStorage). 서버 측 알림
          // 발송은 다음 릴리스이며, 토스트에 그 사실을 정직하게 안내한다.
          // TODO: trpc.alerts.upsert 로 계정에 동기화 + 실제 발송.
          try {
            window.localStorage.setItem(ALERT_PREFS_KEY, JSON.stringify(state));
          } catch {
            // localStorage 차단 환경 — 저장 실패를 알린다.
            toast.error("이 브라우저에서는 설정을 저장할 수 없어요.");
            return;
          }
          toast.success("알림 설정을 이 기기에 저장했어요.", {
            description: "실제 알림 발송은 다음 릴리스에 켜집니다.",
          });
        }}
        className="w-full bg-neon-pink/20 hover:bg-neon-pink/30 text-neon-pink border border-neon-pink/40 font-sans text-sm"
      >
        설정 저장
      </Button>

      <LiteCard variant="muted">
        <p className="font-sans text-[10px] text-muted-foreground leading-relaxed">
          전문가 모드의 RSI / ADX / Bollinger 임계값 조정은 [Pro 모드로 → /alerts]
          에서 가능해요.
        </p>
      </LiteCard>
    </div>
  );
}

function PresetToggle({
  icon,
  title,
  desc,
  on,
  onChange,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  on: boolean;
  onChange: (v: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <LiteCard variant={on ? "good" : "default"}>
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5">{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="font-display text-sm font-bold text-foreground">
            {title}
          </div>
          <p className="font-sans text-[11px] text-muted-foreground mt-0.5">
            {desc}
          </p>
          {children}
        </div>
        <button
          role="switch"
          aria-checked={on}
          onClick={() => onChange(!on)}
          className={cn(
            "relative w-10 h-5 rounded-full border transition-colors shrink-0",
            on
              ? "bg-neon-green/40 border-neon-green/60"
              : "bg-muted border-border/40"
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-foreground transition-transform",
              on && "translate-x-5"
            )}
          />
        </button>
      </div>
    </LiteCard>
  );
}
