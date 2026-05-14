/**
 * Header — sticky 상단 (h-14, z-40).
 *
 * Back 버튼 + symbol + tf 선택. AI / Save 버튼은 우측.
 */

import { Button } from "@/components/ui/button";
import { TimeRangeSegmented } from "@/components/TimeRangeSegmented";
import { ArrowLeft } from "lucide-react";
import { TIMEFRAMES } from "@shared/types";
import type { TimeframeValue } from "@shared/types";
import { useLocation } from "wouter";

interface HeaderProps {
  symbol: string;
  interval: TimeframeValue;
  onIntervalChange: (tf: TimeframeValue) => void;
}

export function Header({ symbol, interval, onIntervalChange }: HeaderProps) {
  const [, setLocation] = useLocation();
  const tfLabel =
    TIMEFRAMES.find((t) => t.value === interval)?.label ?? interval;
  const timeframeOptions = TIMEFRAMES.map((tf) => ({
    label: tf.label,
    value: tf.value as TimeframeValue,
  }));

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
          <h1 className="truncate font-display text-xl font-bold tracking-tight text-foreground">
            {symbol.replace("USDT", "")} / USDT
          </h1>
          <p className="font-sans text-[10px] text-muted-foreground -mt-0.5">
            {tfLabel} · WORKSTATION
          </p>
        </div>
      </div>

      <TimeRangeSegmented
        options={timeframeOptions}
        value={interval}
        onChange={onIntervalChange}
      />
    </div>
  );
}
