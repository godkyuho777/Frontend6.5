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

import { useRef, useState } from "react";
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
  Download,
  Upload,
  AlertTriangle,
} from "lucide-react";
import type { SimUser } from "@/hooks/useSimUser";
import {
  nukeAllSimData,
  exportSimData,
  importSimData,
} from "@/lib/sim-local-store";

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
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  /**
   * Export — 현재 localStorage 의 sim 데이터를 JSON 파일로 다운로드.
   *
   * 신규 사용자는 export 할 데이터가 없을 수도 있어 (version+data 만 있는 빈 객체)
   * 미리 확인 후 빈 데이터면 안내만 띄운다.  AUDIT.md §2.4 (local-only 적응).
   */
  const handleExport = () => {
    const json = exportSimData();
    try {
      const parsed = JSON.parse(json) as { data?: Record<string, string> };
      const keyCount = parsed.data ? Object.keys(parsed.data).length : 0;
      if (keyCount === 0) {
        window.alert("내보낼 시뮬레이터 데이터가 없습니다.");
        return;
      }
    } catch {
      // 검증 실패해도 export 자체는 진행
    }
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    a.href = url;
    a.download = `tradelab-simulator-backup-${date}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  /**
   * Import — 사용자가 선택한 JSON 파일을 읽어 localStorage 를 복원.
   *
   * 정책: REPLACE — 기존 sim 데이터 모두 삭제 후 백업 파일로 덮어쓴다.
   * 확인 dialog 후 진행, 복원 성공 시 reload (simUser hook 이 mount 시 한 번만
   * 읽으므로 새 닉네임이 즉시 반영되려면 reload 필요).
   */
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // 같은 파일 재선택 가능하도록 reset
    if (!file) return;
    if (
      !window.confirm(
        "현재 시뮬레이터 데이터를 백업 파일로 덮어쓰시겠습니까?\n\n" +
          "- 기존 닉네임 · UUID · 포지션 · 거래 내역이 모두 교체됩니다.\n" +
          "- 본 브라우저에서만 적용.\n" +
          "- 복원 후 페이지가 자동 reload 됩니다.",
      )
    ) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      const result = importSimData(text);
      if (!result.ok) {
        window.alert(`복원 실패: ${result.error ?? "올바른 백업 파일이 아닙니다."}`);
        return;
      }
      window.alert(
        `복원 완료 (${result.restored ?? 0}개 항목). 페이지를 새로고침합니다.`,
      );
      window.location.reload();
    };
    reader.onerror = () => {
      window.alert("파일 읽기 실패");
    };
    reader.readAsText(file);
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

          {/* Phase 2 #13: 면책 안내 — 가상자산법 / 모의거래 명시.
              사용자가 닉네임 입력 전에 명확히 인지하도록 카드 상단 배치. */}
          <div
            className={cn(
              "mt-3 mb-1 rounded-md border p-3",
              "border-amber-500/40 bg-amber-500/10",
            )}
            role="note"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="flex flex-col gap-1">
                <p className="font-display font-bold text-xs text-amber-300 uppercase tracking-wider">
                  Investment Simulator 사용 안내
                </p>
                <ul className="font-mono text-[10px] text-amber-200/90 leading-relaxed space-y-0.5 list-disc pl-4">
                  <li>본 서비스는 <strong>가상 자본을 사용한 모의 거래</strong> 입니다. 실제 자금은 거래되지 않습니다.</li>
                  <li>
                    체결 / PnL 은 가상이며 실거래 결과와 차이 가능 (slippage,
                    latency, 수수료 모델 차이).
                  </li>
                  <li>
                    한국 가상자산법: 본 시뮬레이션은 투자 자문이 아니며, 어떠한
                    수익도 보장하지 않습니다.
                  </li>
                  <li>
                    데이터는 본 브라우저의 <strong>localStorage</strong> 에만
                    저장되며 서버로 전송되지 않습니다.
                  </li>
                </ul>
              </div>
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

          {/* Backup / Restore + Reset / Nuke */}
          <div className="mt-4 pt-3 border-t border-border/20 flex flex-col items-center gap-2">
            {/* Hidden file input — handleImportClick 가 클릭 트리거 */}
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={handleImportFile}
              className="hidden"
            />

            {/* Export / Import — 백업 · 복구 (AUDIT.md §2.4) */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExport}
                className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm",
                  "border border-neon-cyan/30 bg-neon-cyan/5 text-neon-cyan",
                  "hover:bg-neon-cyan/15 hover:border-neon-cyan/60",
                  "font-mono text-[10px] uppercase tracking-wider transition-colors",
                )}
                title="현재 시뮬레이터 데이터를 JSON 백업 파일로 다운로드"
              >
                <Download className="h-3 w-3" />
                Export
              </button>
              <button
                type="button"
                onClick={handleImportClick}
                className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm",
                  "border border-neon-green/30 bg-neon-green/5 text-neon-green",
                  "hover:bg-neon-green/15 hover:border-neon-green/60",
                  "font-mono text-[10px] uppercase tracking-wider transition-colors",
                )}
                title="JSON 백업 파일에서 시뮬레이터 데이터를 복원"
              >
                <Upload className="h-3 w-3" />
                Import
              </button>
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
                Reset
              </button>
            </div>
            <p className="font-mono text-[9px] text-muted-foreground/70 text-center">
              · Export: 현재 데이터를 JSON 으로 다운로드 · Import: 백업 파일로 복원 · Reset: 모두 삭제
              <br />
              · 닉네임 · UUID · 포지션 · 거래 내역 전부 본 브라우저 한정
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
