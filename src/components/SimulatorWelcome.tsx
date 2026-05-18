/**
 * SimulatorWelcome — Investment Simulator 의 onboarding 화면 (2026-05-15).
 *
 * 사용자가 닉네임을 입력하고 [Start with $200,000] 버튼을 누르면
 * useSimUser.register(nickname) 를 호출. 부모(`Simulator`)가 그 결과로
 * simUser 가 채워지면 자동으로 trading UI 로 전환.
 *
 * 정책:
 *   - 닉네임 1~24 자, 공백 제거.
 *   - 자동 닉네임 제안 (Random) 버튼 — 한 번 클릭으로 빠른 시작.
 *   - 로그인 불요 / 회원가입 없음 — 헌장: 시뮬레이터는 실제 자본 영향 X.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Wallet,
  Sparkles,
  ChevronRight,
  TrendingUp,
  Shield,
  Wand2,
  Trash2,
} from "lucide-react";
import type { SimUser } from "@/hooks/useSimUser";
import { nukeAllSimData } from "@/lib/sim-local-store";

const ADJECTIVES = [
  "Cyber", "Quantum", "Crypto", "Nebula", "Lunar", "Solar", "Pixel",
  "Neon", "Stealth", "Phantom", "Volt", "Plasma", "Nova", "Vortex",
];
const ANIMALS = [
  "Wolf", "Falcon", "Tiger", "Eagle", "Dragon", "Shark", "Panther",
  "Phoenix", "Lynx", "Cobra", "Raven", "Mantis", "Otter", "Whale",
];

function randomNickname(): string {
  const a = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const b = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  const n = Math.floor(Math.random() * 9000 + 1000);
  return `${a}${b}${n}`;
}

interface Props {
  onRegister: (nickname: string) => SimUser | null;
}

export function SimulatorWelcome({ onRegister }: Props) {
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleNuke = () => {
    if (
      !window.confirm(
        "정말 모든 시뮬레이터 데이터를 삭제하시겠습니까?\n\n" +
          "- 모든 닉네임 · UUID · 포지션 · 거래 내역이 영구 삭제됩니다.\n" +
          "- 본 브라우저에서만 적용 (다른 브라우저 / 기기는 영향 X).\n" +
          "- 삭제 후 자동 reload 됩니다.",
      )
    ) {
      return;
    }
    nukeAllSimData();
    // 사용자 시각적 확신을 위해 reload — fresh load 후 Welcome 화면 그대로 노출.
    window.location.reload();
  };

  const handleStart = () => {
    setError(null);
    const trimmed = nickname.trim();
    if (!trimmed) {
      setError("닉네임을 입력해주세요.");
      return;
    }
    if (trimmed.length > 24) {
      setError("닉네임은 24자 이하로 입력해주세요.");
      return;
    }
    const result = onRegister(trimmed);
    if (!result) {
      setError("닉네임 등록 실패. 다시 시도해주세요.");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-3rem)] p-4">
      <div className="w-full max-w-xl">
        {/* Top accent */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-neon-cyan/40 bg-neon-cyan/5 font-mono text-[10px] uppercase tracking-wider text-neon-cyan">
            <Sparkles className="h-3 w-3" />
            Investment Simulator · 모의투자
          </div>
        </div>

        {/* Main card */}
        <div className="rounded-lg border border-neon-cyan/30 bg-card/80 backdrop-blur-sm p-6 sm:p-8 shadow-[0_0_40px_-15px_rgba(0,229,255,0.4)]">
          <div className="flex items-center gap-3 mb-2">
            <div className="rounded-md bg-neon-cyan/10 border border-neon-cyan/40 p-2">
              <Wallet className="h-6 w-6 text-neon-cyan" />
            </div>
            <div>
              <h1 className="font-display font-bold text-2xl sm:text-3xl text-foreground">
                Welcome, Trader
              </h1>
              <p className="font-mono text-xs text-muted-foreground">
                닉네임을 입력하고 가상 자금 $200,000 USD 를 받아 모의 거래를 시작하세요.
              </p>
            </div>
          </div>

          {/* Features */}
          <div className="grid grid-cols-3 gap-2 my-5">
            <FeatureCard
              icon={<Wallet className="h-4 w-4" />}
              title="$200,000"
              subtitle="가상 자금"
              color="text-neon-green"
            />
            <FeatureCard
              icon={<TrendingUp className="h-4 w-4" />}
              title="Perp 125×"
              subtitle="최대 레버리지"
              color="text-neon-cyan"
            />
            <FeatureCard
              icon={<Shield className="h-4 w-4" />}
              title="No Login"
              subtitle="익명 시작"
              color="text-neon-pink"
            />
          </div>

          {/* Nickname input */}
          <div className="space-y-3">
            <div>
              <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 block">
                Nickname (닉네임)
              </label>
              <div className="flex gap-2">
                <Input
                  autoFocus
                  value={nickname}
                  onChange={(e) => {
                    setNickname(e.target.value);
                    if (error) setError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleStart();
                  }}
                  placeholder="예: CryptoNinja007"
                  maxLength={24}
                  className="font-mono text-base h-11 flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setNickname(randomNickname())}
                  className="font-mono text-xs h-11"
                  title="랜덤 닉네임"
                >
                  <Wand2 className="h-4 w-4 sm:mr-1" />
                  <span className="hidden sm:inline">Random</span>
                </Button>
              </div>
              {error && (
                <p className="font-mono text-[11px] text-neon-red mt-1.5">{error}</p>
              )}
              <p className="font-mono text-[10px] text-muted-foreground mt-1.5">
                · 1~24자 · 거래 화면 상단에 표시됩니다 · 언제든 변경 가능
              </p>
            </div>

            {/* Start button */}
            <Button
              onClick={handleStart}
              disabled={!nickname.trim()}
              className={cn(
                "w-full h-12 font-display font-bold text-base uppercase",
                "bg-neon-cyan hover:bg-neon-cyan/80 text-background",
                "shadow-[0_0_20px_-5px_rgba(0,229,255,0.6)]",
                !nickname.trim() && "opacity-50 cursor-not-allowed",
              )}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Start with $200,000
              <ChevronRight className="h-5 w-5 ml-2" />
            </Button>
          </div>

          {/* Rules / disclaimer */}
          <div className="mt-5 pt-4 border-t border-border/30 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-[10px] font-mono text-muted-foreground">
            <RuleLine>가상 자금 — 실제 자본 영향 X</RuleLine>
            <RuleLine>커미션 0.01% × Leverage 적용</RuleLine>
            <RuleLine>Perp Funding 4h 마다 정산</RuleLine>
            <RuleLine>BBDX 시그널 시스템과 완전 분리</RuleLine>
            <RuleLine>닉네임 + 익명 UUID 만 저장</RuleLine>
            <RuleLine>다른 사용자에게 공유되지 않음</RuleLine>
          </div>

          {/* Reset / nuke — 기존 시뮬레이터 데이터 완전 삭제 */}
          <div className="mt-4 pt-3 border-t border-border/20 flex flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={handleNuke}
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm",
                "border border-neon-red/30 bg-neon-red/5 text-neon-red",
                "hover:bg-neon-red/15 hover:border-neon-red/60",
                "font-mono text-[10px] uppercase tracking-wider transition-colors",
              )}
              title="모든 시뮬레이터 데이터를 영구 삭제"
            >
              <Trash2 className="h-3 w-3" />
              기존 시뮬레이터 데이터 모두 삭제 (리셋)
            </button>
            <p className="font-mono text-[9px] text-muted-foreground/70">
              · 닉네임 · UUID · 포지션 · 거래 내역 전부 삭제 · 본 브라우저 한정
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center mt-4 font-mono text-[10px] text-muted-foreground">
          Tradelab · Investment Simulator v1 (2026-05-15)
        </p>
      </div>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  subtitle,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  color: string;
}) {
  return (
    <div className="rounded-md border border-border/30 bg-background/40 p-2.5 flex flex-col items-center text-center gap-1">
      <span className={color}>{icon}</span>
      <span className={cn("font-display font-bold text-sm", color)}>{title}</span>
      <span className="font-mono text-[9px] uppercase text-muted-foreground">
        {subtitle}
      </span>
    </div>
  );
}

function RuleLine({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-1.5">
      <span className="text-neon-cyan mt-px">·</span>
      <span>{children}</span>
    </div>
  );
}
