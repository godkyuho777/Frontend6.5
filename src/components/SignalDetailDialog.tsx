import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, ShieldAlert, Activity } from "lucide-react";
import type { CoinScanResult } from "@shared/types";

type SignalDetailDialogProps = {
  coin: CoinScanResult;
  children: ReactNode;
};

/**
 * Click-to-detail dialog for a coin's signal state. Surfaces the
 * BBDX-PATTERN v6.1 decisions (entry path, exit conditions met,
 * stop-loss, pressure, patterns, volume) in a single readable panel.
 */
export function SignalDetailDialog({ coin, children }: SignalDetailDialogProps) {
  const symbol = coin.symbol.replace("USDT", "");

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display tracking-wider flex items-center gap-2">
            <Activity className="h-4 w-4 text-neon-cyan" />
            {symbol} Signal Detail
          </DialogTitle>
          <DialogDescription className="font-mono text-xs">
            BBDX-PATTERN v6.1 decision breakdown
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* STOP — highest priority, surface first */}
          {coin.isStopLossHit && (
            <Section
              title="Stop Loss Triggered"
              icon={<ShieldAlert className="h-4 w-4 text-neon-red" />}
              variant="danger"
            >
              <Row label="Stop Price" value={`$${formatPrice(coin.stopLossPrice)}`} />
              <Row label="Current Price" value={`$${formatPrice(coin.price)}`} />
              <Row label="Rule" value="BB lower × 0.97" />
            </Section>
          )}

          {/* Entry Decision */}
          {coin.entryDecision && (
            <Section
              title={`LONG ${coin.entryDecision.path}`}
              icon={<TrendingUp className="h-4 w-4 text-neon-green" />}
              variant="positive"
            >
              <div className="font-mono text-xs text-muted-foreground mb-1">
                Path: <span className="text-neon-green">{coin.entryDecision.path}</span> ·
                Strength: <span className="text-foreground">{coin.signalStrength}</span>
              </div>
              <div className="space-y-1">
                {coin.entryDecision.reasons.map((reason, i) => (
                  <div key={i} className="font-mono text-[11px] text-foreground/85 flex gap-2">
                    <span className="text-neon-green">✓</span>
                    {reason}
                  </div>
                ))}
              </div>
              {coin.entryDecision.bbStructure && (
                <Row label="BB Structure" value={formatBBStructure(coin.entryDecision.bbStructure)} />
              )}
              {coin.entryDecision.patterns && coin.entryDecision.patterns.length > 0 && (
                <Row
                  label="Patterns"
                  value={coin.entryDecision.patterns
                    .map((p) => `${formatPatternName(p.name)} (${p.candlesAgo}↩)`)
                    .join(", ")}
                />
              )}
            </Section>
          )}

          {/* Exit Decision */}
          {coin.exitDecision && (
            <Section
              title={
                coin.exitDecision.relaxedToBearish
                  ? "EXIT (약세 패턴)"
                  : `EXIT ${coin.exitDecision.conditionsMet}/4`
              }
              icon={<TrendingDown className="h-4 w-4 text-neon-yellow" />}
              variant="warning"
            >
              <Row
                label="Conditions"
                value={`${coin.exitDecision.conditionsMet}/${coin.exitDecision.total}${
                  coin.exitDecision.relaxedToBearish ? " (relaxed by bearish pattern)" : ""
                }`}
              />
              <div className="grid grid-cols-2 gap-1 mt-1">
                <Trigger label="≥ BB Middle" met={coin.exitDecision.triggers.includes("bbMiddle")} />
                <Trigger label="RSI ≥ 65" met={coin.exitDecision.triggers.includes("rsi65")} />
                <Trigger label="ADX ≥ 30" met={coin.exitDecision.triggers.includes("adx30")} />
                <Trigger label="+DI ≥ 25" met={coin.exitDecision.triggers.includes("plusDi25")} />
              </div>
            </Section>
          )}

          {/* No active signal */}
          {!coin.entryDecision && !coin.exitDecision && !coin.isStopLossHit && (
            <Section title="No Active Signal" icon={<Activity className="h-4 w-4 text-muted-foreground" />}>
              <p className="font-mono text-[11px] text-muted-foreground">
                None of the NUM / PTN / BB entry conditions are satisfied, and no
                exit threshold has been crossed.
              </p>
              {coin.isFallingKnife && (
                <p className="font-mono text-[11px] text-neon-red mt-2">
                  ⚠ Falling Knife filter active (-DI &gt; +DI AND ADX &gt; 25). Entry blocked.
                </p>
              )}
            </Section>
          )}

          {/* Indicator snapshot (always shown) */}
          <Section title="Indicators" icon={<Activity className="h-4 w-4 text-neon-cyan" />}>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <Row label="RSI(14)" value={coin.indicators.rsi.toFixed(1)} />
              <Row label="ADX(14)" value={coin.indicators.adx.toFixed(1)} />
              <Row label="+DI" value={coin.indicators.plusDi.toFixed(1)} />
              <Row label="-DI" value={coin.indicators.minusDi.toFixed(1)} />
              <Row label="BB Middle" value={`$${formatPrice(coin.indicators.bbMiddle)}`} />
              <Row label="BB Lower" value={`$${formatPrice(coin.indicators.bbLower)}`} />
              <Row label="Pressure" value={formatPressure(coin.pressure)} />
              <Row label="Reversal Prob" value={`${coin.reversalProb.toFixed(0)}%`} />
              <Row label="Volume Ratio" value={coin.volumeRatio.toFixed(2)} />
              <Row label="Stop Loss" value={`$${formatPrice(coin.stopLossPrice)}`} />
            </div>
          </Section>

          {/* Patterns */}
          {coin.candlePatterns.length > 0 && (
            <Section title="Detected Patterns" icon={<Activity className="h-4 w-4 text-neon-pink" />}>
              <div className="space-y-1">
                {coin.candlePatterns.map((p, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex items-center gap-2 font-mono text-[11px]",
                      p.bias === "bullish" ? "text-neon-green" : "text-neon-red"
                    )}
                  >
                    <Badge
                      variant="outline"
                      className={cn(
                        "font-mono text-[10px] border-none",
                        p.bias === "bullish"
                          ? "bg-neon-green/10 text-neon-green"
                          : "bg-neon-red/10 text-neon-red"
                      )}
                    >
                      {p.bias === "bullish" ? "↑" : "↓"} {formatPatternName(p.name)}
                    </Badge>
                    <span className="text-muted-foreground">
                      {p.candlesAgo === 0 ? "current" : `${p.candlesAgo} candle${p.candlesAgo > 1 ? "s" : ""} ago`}
                    </span>
                    <span className="text-muted-foreground ml-auto">
                      strength {p.strength}
                    </span>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Section({
  title,
  icon,
  variant,
  children,
}: {
  title: string;
  icon: ReactNode;
  variant?: "positive" | "warning" | "danger";
  children: ReactNode;
}) {
  const borderColor =
    variant === "positive"
      ? "border-neon-green/30"
      : variant === "warning"
      ? "border-neon-yellow/30"
      : variant === "danger"
      ? "border-neon-red/30"
      : "border-border/30";
  return (
    <div className={cn("rounded-sm border bg-card/30 p-3", borderColor)}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="font-display text-xs font-bold tracking-wider uppercase text-foreground">
          {title}
        </span>
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between font-mono text-[11px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}

function Trigger({ label, met }: { label: string; met: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 font-mono text-[10px]",
        met ? "text-neon-green" : "text-muted-foreground"
      )}
    >
      <span>{met ? "✓" : "✗"}</span>
      <span>{label}</span>
    </div>
  );
}

function formatPrice(p: number): string {
  if (p === 0) return "—";
  return p < 1 ? p.toFixed(6) : p < 100 ? p.toFixed(4) : p.toFixed(2);
}

function formatPatternName(name: string): string {
  // CamelCase → "Camel Case", capitalized
  return name
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

function formatBBStructure(s: string): string {
  return formatPatternName(s);
}

function formatPressure(p: string): string {
  switch (p) {
    case "BULL_PRESSURE":
      return "BULL ↑ (strong)";
    case "WEAK_BULL":
      return "BULL ↑ (weak)";
    case "BEAR_PRESSURE":
      return "BEAR ↓ (strong)";
    case "WEAK_BEAR":
      return "BEAR ↓ (weak)";
    default:
      return "Neutral";
  }
}
