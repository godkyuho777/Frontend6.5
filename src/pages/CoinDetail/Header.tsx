/**
 * Header — sticky 상단 (h-14, z-40).
 *
 * Back 버튼 + symbol + tf 선택. AI / Save 버튼은 우측.
 */

import { Button } from "@/components/ui/button";
import { ArrowLeft, Clock } from "lucide-react";
import { TIMEFRAMES } from "@shared/types";
import type { TimeframeValue } from "@shared/types";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

interface HeaderProps {
  symbol: string;
  interval: TimeframeValue;
  onIntervalChange: (tf: TimeframeValue) => void;
}

export function Header({ symbol, interval, onIntervalChange }: HeaderProps) {
  const [, setLocation] = useLocation();
  const tfLabel =
    TIMEFRAMES.find((t) => t.value === interval)?.label ?? interval;

  return (
    <div className="sticky top-0 z-40 h-14 -mx-4 px-4 flex items-center justify-between gap-3 bg-background/95 backdrop-blur supports-[backdrop-filter]:backdrop-blur border-b border-border/30">
      <div className="flex items-center gap-3 min-w-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLocation("/")}
          className="text-neon-cyan hover:bg-neon-cyan/10 h-8 px-2"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="font-display text-xl font-bold tracking-wider text-neon-pink glow-pink truncate">
              {symbol.replace("USDT", "")}
            </h1>
            <span className="font-mono text-xs text-muted-foreground">
              /USDT
            </span>
          </div>
          <p className="font-mono text-[10px] text-muted-foreground -mt-0.5">
            {tfLabel} · WORKSTATION
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 bg-card/50 border border-border/30 rounded-sm px-2 py-1">
        <Clock className="h-3 w-3 text-neon-cyan" />
        <div className="flex gap-0.5">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.value}
              onClick={() => onIntervalChange(tf.value as TimeframeValue)}
              className={cn(
                "font-mono text-[10px] px-2 py-1 rounded-sm transition-all",
                interval === tf.value
                  ? "bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
              )}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
