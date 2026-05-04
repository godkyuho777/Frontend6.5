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
    active: { icon: TrendingUp, color: "text-neon-green", label: "ACTIVE" },
    target_hit: { icon: Target, color: "text-neon-cyan", label: "TARGET HIT" },
    expired: { icon: Clock, color: "text-neon-yellow", label: "EXPIRED" },
    closed: { icon: XCircle, color: "text-muted-foreground", label: "CLOSED" },
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-wider text-neon-pink glow-pink">
          SIGNAL HISTORY
        </h1>
        <p className="font-mono text-xs text-muted-foreground mt-1">
          PAST ENTRY SIGNALS // PERFORMANCE LOG
        </p>
      </div>

      <HudPanel title="Signal Log" subtitle={`${history?.length ?? 0} signals recorded`}>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-neon-pink" />
          </div>
        ) : !history?.length ? (
          <div className="text-center py-12">
            <Clock className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
            <p className="font-mono text-sm text-muted-foreground">No signals recorded yet</p>
            <p className="font-mono text-xs text-muted-foreground/60 mt-1">
              Save signals from the scanner to build your history
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
                        <Badge className={cn("font-mono text-[10px] border", config.color, `bg-transparent border-current/30`)}>
                          {config.label}
                        </Badge>
                      </div>
                      <div className="font-mono text-[10px] text-muted-foreground mt-0.5">
                        {new Date(signal.detectedAt).toLocaleString("ko-KR")}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right hidden sm:block">
                      <div className="font-mono text-[10px] text-muted-foreground">Entry</div>
                      <div className="font-mono text-xs text-foreground">{formatPrice(signal.entryPrice)}</div>
                    </div>
                    <div className="text-right hidden sm:block">
                      <div className="font-mono text-[10px] text-muted-foreground">Target (BB Mid)</div>
                      <div className="font-mono text-xs text-neon-cyan">{formatPrice(signal.bbMiddle)}</div>
                    </div>
                    <div className="text-right hidden md:block">
                      <div className="font-mono text-[10px] text-muted-foreground">RSI</div>
                      <div className="font-mono text-xs text-neon-yellow">{signal.rsiValue.toFixed(1)}</div>
                    </div>
                    <div className="text-right hidden md:block">
                      <div className="font-mono text-[10px] text-muted-foreground">ADX</div>
                      <div className="font-mono text-xs text-foreground">{signal.adxValue.toFixed(1)}</div>
                    </div>
                    {pnl !== null && (
                      <div className="text-right">
                        <div className="font-mono text-[10px] text-muted-foreground">PnL</div>
                        <div className={cn(
                          "font-mono text-xs font-bold",
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
