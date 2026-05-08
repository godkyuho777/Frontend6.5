/**
 * /lite/portfolio — 사용자 포지션 요약 (인증 필요)
 */

import { trpc } from "@/lib/trpc";
import { LiteCard } from "@/components/lite/LiteCard";
import { Button } from "@/components/ui/button";
import { Wallet, Loader2, LogIn } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";

function formatMoney(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("ko-KR", { maximumFractionDigits: 2 });
}

function formatPercent(n: number | null | undefined): string {
  if (n == null) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

export default function LitePortfolio() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const isLoggedIn = !!user;

  const { data, isLoading, error } = trpc.lite.portfolio.useQuery(undefined, {
    enabled: isLoggedIn,
    staleTime: 30_000,
  });

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-neon-pink" />
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <LiteCard
        icon={<LogIn className="h-5 w-5 text-neon-cyan" />}
        title="로그인이 필요해요"
        subtitle="포트폴리오는 본인만 볼 수 있어요"
        variant="muted"
      >
        <p className="font-mono text-sm text-muted-foreground mb-3">
          포트폴리오 기능은 본인의 거래 내역과 연결되기 때문에 로그인이 필요해요.
          나머지 Lite 기능 (오늘의 추천, 코인 살펴보기, 학습)은 로그인 없이도 그대로
          사용할 수 있어요.
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setLocation("/lite")}
          className="font-mono text-[11px] border-neon-cyan/30 text-neon-cyan"
        >
          오늘의 추천으로 가기
        </Button>
      </LiteCard>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-neon-pink" />
        <span className="font-mono text-sm text-muted-foreground">
          포지션을 불러오고 있어요...
        </span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <LiteCard variant="bad" title="포트폴리오를 불러오지 못했어요">
        <p className="font-mono text-xs text-neon-red">
          {String(error?.message ?? "데이터 없음")}
        </p>
      </LiteCard>
    );
  }

  if (data.positions.length === 0) {
    return (
      <LiteCard
        icon={<Wallet className="h-5 w-5 text-muted-foreground" />}
        title="아직 오픈 포지션이 없어요"
        variant="muted"
      >
        <p className="font-mono text-sm text-muted-foreground">
          첫 진입을 하면 여기에 PnL 과 추천 액션이 표시돼요.
        </p>
      </LiteCard>
    );
  }

  const overallTone =
    data.pnl24h > 0 ? "good" : data.pnl24h < 0 ? "bad" : "default";

  return (
    <div className="space-y-4">
      <LiteCard
        variant={overallTone}
        icon={<Wallet className="h-5 w-5 text-neon-cyan" />}
        title="내 자산"
        subtitle={`오픈 포지션 ${data.positions.length}개`}
      >
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2">
          <Stat label="총 자산" value={`$${formatMoney(data.totalEquity)}`} />
          <Stat
            label="누적 PnL"
            value={`$${formatMoney(data.pnl24h)}`}
            tone={data.pnl24h >= 0 ? "good" : "bad"}
          />
          <Stat label="알림" value={`${data.pendingAlerts}건`} />
        </div>
      </LiteCard>

      <section className="space-y-2">
        <h2 className="font-display text-sm font-bold tracking-wider text-foreground px-1">
          포지션별 추천
        </h2>
        {data.positions.map((p) => (
          <LiteCard
            key={p.positionId}
            variant={
              p.suggestedActionTone === "good"
                ? "good"
                : p.suggestedActionTone === "bad"
                  ? "bad"
                  : p.suggestedActionTone === "caution"
                    ? "caution"
                    : "default"
            }
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <div className="font-display text-base font-bold text-foreground">
                  {p.base}
                </div>
                <div className="font-mono text-[11px] text-muted-foreground">
                  진입 ${formatMoney(p.entryPrice)} → 현재 ${formatMoney(p.currentPrice)}
                </div>
              </div>
              <div className="text-right">
                <div
                  className={cn(
                    "font-display text-base font-bold",
                    (p.pnlPercent ?? 0) >= 0 ? "text-neon-green" : "text-neon-red"
                  )}
                >
                  {formatPercent(p.pnlPercent)}
                </div>
                <div className="font-mono text-[10px] text-muted-foreground">
                  {p.suggestedAction}
                </div>
              </div>
            </div>
          </LiteCard>
        ))}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "bad";
}) {
  return (
    <div>
      <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
        {label}
      </div>
      <div
        className={cn(
          "font-display text-lg font-bold mt-0.5",
          tone === "good"
            ? "text-neon-green"
            : tone === "bad"
              ? "text-neon-red"
              : "text-foreground"
        )}
      >
        {value}
      </div>
    </div>
  );
}
