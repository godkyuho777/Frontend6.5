import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * 6개 modifier 전략 페이지 공통 헤더.
 * Symbol 입력 + TF 셀렉터 + 차원 라벨 + (선택) BETA 배지.
 */
export type StrategyTf = "1h" | "4h" | "1d";

const TF_OPTIONS: StrategyTf[] = ["1h", "4h", "1d"];

const DIMENSION_LABEL: Record<number, string> = {
  1: "1차원 모멘텀",
  2: "2차원 변동성",
  3: "3차원 추세",
  4: "4차원 거래량",
  5: "5차원 구조",
  6: "6차원 매크로",
  7: "7차원 온체인",
};

export interface StrategyHeaderProps {
  title: string;
  subtitle?: string;
  dimension: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  symbol: string;
  tf: StrategyTf;
  onSymbolChange: (symbol: string) => void;
  onTfChange: (tf: StrategyTf) => void;
  isBeta?: boolean;
  showSymbolInput?: boolean;
}

export function StrategyHeader({
  title,
  subtitle,
  dimension,
  symbol,
  tf,
  onSymbolChange,
  onTfChange,
  isBeta = false,
  showSymbolInput = true,
}: StrategyHeaderProps) {
  return (
    <div className="flex flex-col gap-3 mb-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-display text-xl font-bold tracking-wider uppercase text-neon-pink glow-pink">
              {title}
            </h1>
            <Badge
              variant="outline"
              className="font-mono text-[10px] border-neon-cyan/40 text-neon-cyan"
            >
              {DIMENSION_LABEL[dimension]}
            </Badge>
            {isBeta && (
              <Badge
                variant="outline"
                className="font-mono text-[10px] border-orange-400/60 text-orange-300 bg-orange-500/10"
              >
                BETA
              </Badge>
            )}
          </div>
          {subtitle && (
            <p className="text-xs font-mono text-muted-foreground mt-1">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        {showSymbolInput && (
          <div className="flex flex-col gap-1">
            <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
              Symbol
            </label>
            <Input
              value={symbol}
              onChange={(e) => onSymbolChange(e.target.value.toUpperCase())}
              className="h-8 w-36 font-mono text-xs"
              placeholder="BTCUSDT"
            />
          </div>
        )}
        <div className="flex flex-col gap-1">
          <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
            Timeframe
          </label>
          <div className="flex items-center gap-1">
            {TF_OPTIONS.map((opt) => (
              <Button
                key={opt}
                size="sm"
                variant="ghost"
                onClick={() => onTfChange(opt)}
                className={cn(
                  "h-8 px-3 font-mono text-xs uppercase",
                  tf === opt
                    ? "bg-neon-cyan/15 text-neon-cyan border border-neon-cyan/40"
                    : "text-muted-foreground hover:text-neon-cyan"
                )}
              >
                {opt}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
