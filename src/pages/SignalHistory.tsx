import { trpc } from "@/lib/trpc";
import { HudPanel } from "@/components/HudPanel";
import { Badge } from "@/components/ui/badge";
import { Loader2, Clock, TrendingUp, Target, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";

export default function SignalHistory() {
  const [, setLocation] = useLocation();
  const { data: history, isLoading } = trpc.signals.history.useQuery(
    { limit: 100 },
    { refetchInterval: 60000 }
  );

  const formatPrice = (p: number | null) => {
    if (p === null || p === undefined) return "—";
    return p < 1 ? `$${p.toFixed(6)}` : p < 100 ? `$${p.toFixed(4)}` : `$${p.toFixed(2)}`;
  };

  const statusConfig: Record<string, { icon: React.ElementType; color: string; label: string }> = {
    active: { icon: TrendingUp, color: "text-neon-green", label: "진행 중" },
    target_hit: { icon: Target, color: "text-neon-cyan", label: "목표 도달" },
    expired: { icon: Clock, color: "text-neon-yellow", label: "만료" },
    closed: { icon: XCircle, color: "text-muted-foreground", label: "종료" },
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
          시그널 기록
        </h1>
        <p className="font-mono text-xs text-muted-foreground mt-1">
          저장한 진입 시그널과 이후 성과를 추적합니다
        </p>
      </div>

      <HudPanel title="시그널 로그" subtitle={`${history?.length ?? 0}개 기록됨`}>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-neon-pink" />
          </div>
        ) : !history?.length ? (
          <div className="text-center py-12">
            <Clock className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
            <p className="font-sans text-sm text-muted-foreground">아직 저장된 시그널이 없습니다</p>
            <p className="font-sans text-xs text-muted-foreground/60 mt-1">
              스캐너에서 시그널을 저장하면 여기에 기록됩니다
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {history.map((signal) => {
              const config = statusConfig[signal.status] ?? statusConfig.closed;
              const StatusIcon = config.icon;
              const pnl = signal.currentPrice && signal.entryPrice
                ? ((signal.currentPrice - signal.entryPrice) / signal.entryPrice) * 100
                : null;

              return (
                <div
                  key={signal.id}
                  onClick={() => setLocation(`/coin/${signal.symbol}`)}
                  className="flex items-center justify-between p-3 rounded-sm border border-border/20 bg-card/50 hover:border-neon-cyan/20 cursor-pointer transition-all"
                >
                  <div className="flex items-center gap-3">
                    <StatusIcon className={cn("h-4 w-4", config.color)} />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-display text-sm font-bold text-foreground">
                          {signal.symbol.replace("USDT", "")}
                        </span>
                        <Badge className={cn("font-sans text-[10px] border", config.color, `bg-transparent border-current/30`)}>
                          {config.label}
                        </Badge>
                      </div>
                      <div className="font-sans text-[10px] text-muted-foreground mt-0.5">
                        {new Date(signal.detectedAt).toLocaleString("ko-KR")}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right hidden sm:block">
                      <div className="font-sans text-[10px] text-muted-foreground">진입가</div>
                      <div className="font-sans text-xs text-foreground">{formatPrice(signal.entryPrice)}</div>
                    </div>
                    <div className="text-right hidden sm:block">
                      <div className="font-sans text-[10px] text-muted-foreground">목표가 (BB 중심)</div>
                      <div className="font-sans text-xs text-neon-cyan">{formatPrice(signal.bbMiddle)}</div>
                    </div>
                    <div className="text-right hidden md:block">
                      <div className="font-sans text-[10px] text-muted-foreground">RSI</div>
                      <div className="font-sans text-xs text-neon-yellow">{signal.rsiValue.toFixed(1)}</div>
                    </div>
                    <div className="text-right hidden md:block">
                      <div className="font-sans text-[10px] text-muted-foreground">ADX</div>
                      <div className="font-sans text-xs text-foreground">{signal.adxValue.toFixed(1)}</div>
                    </div>
                    {pnl !== null && (
                      <div className="text-right">
                        <div className="font-sans text-[10px] text-muted-foreground">PnL</div>
                        <div className={cn(
                          "font-sans text-xs font-bold",
                          pnl >= 0 ? "text-neon-green" : "text-neon-red"
                        )}>
                          {pnl >= 0 ? "+" : ""}{pnl.toFixed(2)}%
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </HudPanel>
    </div>
  );
}
