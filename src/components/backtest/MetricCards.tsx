/**
 * 백테스트 메트릭 카드 그리드 (winRate / Sharpe / MDD / PF + 추가 메트릭).
 *
 * 단일 책임: overall 객체 → stat 카드 렌더.
 */

import { cn } from "@/lib/utils";
import {
  BarChart2,
  Target,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";

export interface OverallMetrics {
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  sharpe: number;
  expectancy: number;
  profitFactor: number;
  maxDrawdown: number;
  avgWin: number;
  avgLoss: number;
  avgMaxFavorable: number;
  avgMaxAdverse: number;
}

interface MetricCardsProps {
  overall: OverallMetrics;
  /** "compact" 는 단일 코인 (4 카드), "full" 은 전체 6 카드 */
  variant?: "compact" | "full";
}

function StatCard({
  label,
  value,
  sub,
  color = "cyan",
  icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: "pink" | "cyan" | "green" | "yellow" | "red";
  icon?: React.ElementType;
}) {
  const colorMap = {
    pink: "text-neon-pink",
    cyan: "text-neon-cyan",
    green: "text-neon-green",
    yellow: "text-neon-yellow",
    red: "text-red-400",
  };
  return (
    <div className="flex flex-col gap-1 p-3 rounded-sm border border-border/20 bg-card/40">
      <div className="flex items-center gap-1.5">
        {Icon && <Icon className={cn("h-3 w-3", colorMap[color])} />}
        <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
          {label}
        </span>
      </div>
      <div className={cn("font-display text-xl font-bold", colorMap[color])}>
        {value}
      </div>
      {sub && (
        <div className="font-mono text-[10px] text-muted-foreground">{sub}</div>
      )}
    </div>
  );
}

export function MetricCards({ overall, variant = "full" }: MetricCardsProps) {
  if (variant === "compact") {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatCard
          label="승률"
          value={`${(overall.winRate * 100).toFixed(1)}%`}
          sub={`${overall.wins}W / ${overall.losses}L`}
          color={overall.winRate >= 0.5 ? "green" : "red"}
          icon={overall.winRate >= 0.5 ? TrendingUp : TrendingDown}
        />
        <StatCard
          label="Sharpe"
          value={overall.sharpe.toFixed(3)}
          sub={
            overall.sharpe >= 1
              ? "양호 ≥1.0"
              : overall.sharpe >= 0
                ? "보통"
                : "위험"
          }
          color={
            overall.sharpe >= 1 ? "green" : overall.sharpe >= 0 ? "yellow" : "red"
          }
          icon={BarChart2}
        />
        <StatCard
          label="Max Drawdown"
          value={`-${overall.maxDrawdown.toFixed(2)}%`}
          sub="누적 최대 낙폭"
          color="red"
          icon={TrendingDown}
        />
        <StatCard
          label="Profit Factor"
          value={isFinite(overall.profitFactor) ? overall.profitFactor.toFixed(2) : "∞"}
          sub="이익/손실 비"
          color={
            overall.profitFactor >= 1.5
              ? "green"
              : overall.profitFactor >= 1
                ? "yellow"
                : "red"
          }
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
      <StatCard
        label="총 시그널"
        value={String(overall.totalTrades)}
        sub={`${overall.wins}W / ${overall.losses}L`}
        color="cyan"
        icon={Zap}
      />
      <StatCard
        label="승률"
        value={`${(overall.winRate * 100).toFixed(1)}%`}
        sub="기준 50%"
        color={overall.winRate >= 0.5 ? "green" : "red"}
        icon={overall.winRate >= 0.5 ? TrendingUp : TrendingDown}
      />
      <StatCard
        label="Sharpe"
        value={overall.sharpe.toFixed(3)}
        sub={
          overall.sharpe >= 1
            ? "양호 ≥1.0"
            : overall.sharpe >= 0
              ? "보통"
              : "위험"
        }
        color={
          overall.sharpe >= 1 ? "green" : overall.sharpe >= 0 ? "yellow" : "red"
        }
        icon={BarChart2}
      />
      <StatCard
        label="기댓값"
        value={`${overall.expectancy >= 0 ? "+" : ""}${overall.expectancy.toFixed(2)}%`}
        sub="per trade"
        color={overall.expectancy > 0 ? "cyan" : "red"}
        icon={Target}
      />
      <StatCard
        label="Profit Factor"
        value={isFinite(overall.profitFactor) ? overall.profitFactor.toFixed(2) : "∞"}
        sub="이익/손실 비"
        color={
          overall.profitFactor >= 1.5
            ? "green"
            : overall.profitFactor >= 1
              ? "yellow"
              : "red"
        }
      />
      <StatCard
        label="Max Drawdown"
        value={`-${overall.maxDrawdown.toFixed(2)}%`}
        sub="누적 최대 낙폭"
        color="red"
        icon={TrendingDown}
      />
    </div>
  );
}

// re-export for callers that want a direct StatCard (e.g. avg win/loss row).
export { StatCard as BacktestStatCard };
