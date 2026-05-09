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
import { TrendingUp, TrendingDown, ShieldAlert, Activity, Layers } from "lucide-react";
import type { CoinScanResult } from "@shared/types";
import { PatternConfluenceCard } from "@/components/PatternConfluenceCard";

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
          {(coin.isStopLossHit ?? false) && (
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

              {/* Additional Strategies multiplier (audit 03_ADDITIONAL_STRATEGIES) */}
              <ModifierBreakdown decision={coin.entryDecision} signalStrength={coin.signalStrength} />
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
          {!coin.entryDecision && !coin.exitDecision && !(coin.isStopLossHit ?? false) && (
            <Section title="No Active Signal" icon={<Activity className="h-4 w-4 text-muted-foreground" />}>
              <p className="font-mono text-[11px] text-muted-foreground">
                None of the NUM / PTN / BB entry conditions are satisfied, and no
                exit threshold has been crossed.
              </p>
              {(coin.isFallingKnife ?? false) && (
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
              <Row label="Pressure" value={formatPressure(coin.pressure ?? "NEUTRAL")} />
              <Row label="Reversal Prob" value={`${(coin.reversalProb ?? 0).toFixed(0)}%`} />
              <Row label="Volume Ratio" value={(coin.volumeRatio ?? 1).toFixed(2)} />
              <Row label="Stop Loss" value={`$${formatPrice(coin.stopLossPrice ?? 0)}`} />
            </div>
          </Section>

          {/* PATTERN_SYSTEM_AUDIT 권고 적용 합산 카드 — multi + 거래량 + 추세 + TF */}
          {coin.patternConfluence && (
            <Section
              title="Pattern Confluence (audit v1)"
              icon={<Layers className="h-4 w-4 text-neon-cyan" />}
            >
              <PatternConfluenceCard summary={coin.patternConfluence} />
            </Section>
          )}

          {/* Patterns (raw 매치 리스트) */}
          {(coin.candlePatterns ?? []).length > 0 && (
            <Section title="Detected Patterns (raw)" icon={<Activity className="h-4 w-4 text-neon-pink" />}>
              <div className="space-y-1">
                {(coin.candlePatterns ?? []).map((p, i) => (
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

// ─── Additional Strategies modifier breakdown (헌장 규칙 3) ─────────
//
// scanner.ts 가 entryDecision 에 EMA Ribbon / MACD Divergence /
// Order Block multiplier 를 surface 함. v6.5 후속 PR 에서 final_confidence
// 곱셈 체인에 통합 예정. 현재는 표시만.

const MODIFIER_DEFS: Array<{
  key:
    | "vwapMult"
    | "emaRibbonMult"
    | "marketBreadthMult"
    | "macdDivergenceMult"
    | "fundingExtremeMult"
    | "cvdDivergenceMult"
    | "orderBlockMult";
  label: string;
  dimension: string;
  range: string;
  beta?: boolean;
}> = [
  { key: "vwapMult", label: "VWAP", dimension: "5 structure", range: "0.85~1.15" },
  { key: "emaRibbonMult", label: "EMA Ribbon", dimension: "3 trend", range: "0.30~1.15" },
  { key: "macdDivergenceMult", label: "MACD Divergence", dimension: "1 momentum", range: "0.80~1.20" },
  { key: "marketBreadthMult", label: "Market Breadth", dimension: "6 macro", range: "0.60~1.30" },
  { key: "fundingExtremeMult", label: "Funding Extreme", dimension: "6 macro", range: "0.85~1.20" },
  { key: "cvdDivergenceMult", label: "CVD Divergence", dimension: "4 volume", range: "0.80~1.20", beta: true },
  { key: "orderBlockMult", label: "Order Block", dimension: "5 structure", range: "0.95~1.05", beta: true },
];

function ModifierBreakdown({
  decision,
  signalStrength,
}: {
  decision: NonNullable<CoinScanResult["entryDecision"]>;
  signalStrength: number;
}) {
  const present = MODIFIER_DEFS.map((d) => ({
    ...d,
    value: decision[d.key],
  })).filter((m) => m.value != null && Number.isFinite(m.value));

  if (present.length === 0) return null;

  // 합산: 곱셈 체인 (헌장 외부 차원 결합)
  const product = present.reduce((acc, m) => acc * (m.value ?? 1), 1);
  const adjustedStrength = Math.round(signalStrength * product);
  const delta = adjustedStrength - signalStrength;

  return (
    <div className="mt-3 pt-3 border-t border-border/30">
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
          Additional Modifiers (audit 03)
        </span>
        <span className="font-mono text-[10px] text-neon-cyan">
          {present.length} active
        </span>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {present.map((m) => (
          <ModifierCell
            key={m.key}
            label={m.label}
            dimension={m.dimension}
            range={m.range}
            value={m.value!}
            beta={m.beta}
          />
        ))}
      </div>

      <div className="mt-2 pt-2 border-t border-border/20 flex items-center justify-between font-mono text-[11px]">
        <span className="text-muted-foreground">
          신호 강도 보정 (= base × Π modifiers)
        </span>
        <span
          className={cn(
            "font-bold",
            delta > 0 ? "text-emerald-400" : delta < 0 ? "text-red-400" : "text-foreground",
          )}
        >
          {signalStrength} × {product.toFixed(3)} ={" "}
          <span className="text-base">{adjustedStrength}</span>
          {delta !== 0 && (
            <span className="text-[10px] ml-1 opacity-70">
              ({delta >= 0 ? "+" : ""}
              {delta})
            </span>
          )}
        </span>
      </div>

      <p className="mt-1.5 text-[9px] font-mono text-muted-foreground/70 leading-relaxed">
        ⚠ 단독 신호 X — 헌장 규칙 3. 모든 modifier 는 BBDX (RSI/BB/ADX) 시그널의
        곱셈 가중치로만 적용. 공식 통합은 v6.5 confidence pipeline 후속 PR.
      </p>
    </div>
  );
}

function ModifierCell({
  label,
  dimension,
  range,
  value,
  beta,
}: {
  label: string;
  dimension: string;
  range: string;
  value: number;
  beta?: boolean;
}) {
  // 1.0 = neutral; > 1.0 = boost; < 1.0 = damp
  const tone =
    value > 1.05
      ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-400"
      : value < 0.95
      ? "border-red-500/40 bg-red-500/5 text-red-400"
      : "border-border/30 bg-card/30 text-muted-foreground";

  return (
    <div className={cn("p-1.5 rounded-sm border text-[10px] font-mono", tone)}>
      <div className="flex items-center justify-between gap-1">
        <span className="font-bold truncate">
          {label}
          {beta && (
            <span className="ml-1 text-[8px] opacity-60 uppercase">β</span>
          )}
        </span>
        <span className="font-bold tabular-nums">×{value.toFixed(2)}</span>
      </div>
      <div className="text-[8px] opacity-70 mt-0.5">
        {dimension} · {range}
      </div>
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
