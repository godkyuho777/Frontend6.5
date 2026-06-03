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
import { TrendingUp, TrendingDown, ShieldAlert, Activity, Layers, Target } from "lucide-react";
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
            {symbol} 시그널 상세
          </DialogTitle>
          <DialogDescription className="font-mono text-xs">
            BBDX-PATTERN v6.1 결정 분석
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* STOP — highest priority, surface first */}
          {(coin.isStopLossHit ?? false) && (
            <Section
              title="손절 발동"
              icon={<ShieldAlert className="h-4 w-4 text-neon-red" />}
              variant="danger"
            >
              <Row label="손절가" value={`$${formatPrice(coin.stopLossPrice)}`} />
              <Row label="현재가" value={`$${formatPrice(coin.price)}`} />
              <Row label="규칙" value="BB lower × 0.97" />
            </Section>
          )}

          {/* Entry Decision */}
          {coin.entryDecision && (
            <Section
              title={`LONG ${coin.entryDecision.path}`}
              icon={<TrendingUp className="h-4 w-4 text-neon-green" />}
              variant="positive"
            >
              <div className="font-sans text-xs text-muted-foreground mb-1">
                경로: <span className="text-neon-green">{coin.entryDecision.path}</span> ·
                강도: <span className="text-foreground">{coin.signalStrength}</span>
              </div>
              <div className="space-y-1">
                {coin.entryDecision.reasons.map((reason, i) => (
                  <div key={i} className="font-sans text-[11px] text-foreground/85 flex gap-2">
                    <span className="text-neon-green">✓</span>
                    {reason}
                  </div>
                ))}
              </div>
              {coin.entryDecision.bbStructure && (
                <Row label="BB 구조" value={formatBBStructure(coin.entryDecision.bbStructure)} />
              )}
              {coin.entryDecision.patterns && coin.entryDecision.patterns.length > 0 && (
                <Row
                  label="패턴"
                  value={coin.entryDecision.patterns
                    .map((p) => `${formatPatternName(p.name)} (${p.candlesAgo}↩)`)
                    .join(", ")}
                />
              )}

              {/* Additional Strategies multiplier (audit 03_ADDITIONAL_STRATEGIES) */}
              <ModifierBreakdown decision={coin.entryDecision} signalStrength={coin.signalStrength} />
            </Section>
          )}

          {/* Risk / Reward — 진입 시그널이 있을 때만. 표시 전용(헌장 안전):
              BBDX 결정 로직을 바꾸지 않고 기존 데이터로 R:R 만 계산. */}
          {coin.entryDecision && <RiskReward coin={coin} />}

          {/* Exit Decision */}
          {coin.exitDecision && (
            <Section
              title={
                coin.exitDecision.relaxedToBearish
                  ? "청산 (약세 패턴)"
                  : `청산 ${coin.exitDecision.conditionsMet}/4`
              }
              icon={<TrendingDown className="h-4 w-4 text-neon-yellow" />}
              variant="warning"
            >
              <Row
                label="충족 조건"
                value={`${coin.exitDecision.conditionsMet}/${coin.exitDecision.total}${
                  coin.exitDecision.relaxedToBearish ? " (약세 패턴으로 완화)" : ""
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
            <Section title="활성 시그널 없음" icon={<Activity className="h-4 w-4 text-muted-foreground" />}>
              <p className="font-sans text-[11px] text-muted-foreground">
                NUM / PTN / BB 진입 조건 중 충족된 것이 없으며, 청산 임계값도
                넘지 않았습니다.
              </p>
              {(coin.isFallingKnife ?? false) && (
                <p className="font-sans text-[11px] text-neon-red mt-2">
                  ⚠ Falling Knife 필터 활성 (-DI &gt; +DI AND ADX &gt; 25). 진입 차단.
                </p>
              )}
            </Section>
          )}

          {/* Indicator snapshot (always shown) */}
          <Section title="지표" icon={<Activity className="h-4 w-4 text-neon-cyan" />}>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <Row
                label="RSI(14)"
                value={`${coin.indicators.rsi.toFixed(1)} · ${rsiZone(coin.indicators.rsi)}`}
              />
              <Row
                label="ADX(14)"
                value={`${coin.indicators.adx.toFixed(1)} · ${adxZone(coin.indicators.adx)}`}
              />
              <Row label="+DI" value={coin.indicators.plusDi.toFixed(1)} />
              <Row label="-DI" value={coin.indicators.minusDi.toFixed(1)} />
              <Row label="BB 중심선" value={`$${formatPrice(coin.indicators.bbMiddle)}`} />
              <Row label="BB 하단" value={`$${formatPrice(coin.indicators.bbLower)}`} />
              {coin.atr != null && coin.atr > 0 && (
                <>
                  <Row label="ATR(14)" value={`$${formatPrice(coin.atr)}`} />
                  <Row
                    label="변동성(ATR%)"
                    value={`${coin.price > 0 ? ((coin.atr / coin.price) * 100).toFixed(2) : "0.00"}%`}
                  />
                </>
              )}
              <Row label="압력" value={formatPressure(coin.pressure ?? "NEUTRAL")} />
              <Row label="반전 확률" value={`${(coin.reversalProb ?? 0).toFixed(0)}%`} />
              <Row label="거래량 비율" value={(coin.volumeRatio ?? 1).toFixed(2)} />
              <Row label="손절가" value={`$${formatPrice(coin.stopLossPrice ?? 0)}`} />
            </div>
          </Section>

          {/* PATTERN_SYSTEM_AUDIT 권고 적용 합산 카드 — multi + 거래량 + 추세 + TF */}
          {coin.patternConfluence && (
            <Section
              title="패턴 컨플루언스 (audit v1)"
              icon={<Layers className="h-4 w-4 text-neon-cyan" />}
            >
              <PatternConfluenceCard summary={coin.patternConfluence} />
            </Section>
          )}

          {/* Patterns (raw 매치 리스트) */}
          {(coin.candlePatterns ?? []).length > 0 && (
            <Section title="감지된 패턴 (raw)" icon={<Activity className="h-4 w-4 text-neon-pink" />}>
              <div className="space-y-1">
                {(coin.candlePatterns ?? []).map((p, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex items-center gap-2 font-sans text-[11px]",
                      p.bias === "bullish" ? "text-neon-green" : "text-neon-red"
                    )}
                  >
                    <Badge
                      variant="outline"
                      className={cn(
                        "font-sans text-[10px] border-none",
                        p.bias === "bullish"
                          ? "bg-neon-green/10 text-neon-green"
                          : "bg-neon-red/10 text-neon-red"
                      )}
                    >
                      {p.bias === "bullish" ? "↑" : "↓"} {formatPatternName(p.name)}
                    </Badge>
                    <span className="text-muted-foreground">
                      {p.candlesAgo === 0 ? "현재" : `${p.candlesAgo}캔들 전`}
                    </span>
                    <span className="text-muted-foreground ml-auto">
                      강도 {p.strength}
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

/**
 * 리스크/보상(R:R) 카드 — 표시 전용. BBDX 진입/청산 결정에 영향 없음(헌장 안전).
 * 기존 스캔 결과(price · stopLossPrice · BB 중심선/상단)만으로 계산:
 *   리스크 = 진입 − 손절(BB하단×0.97), 목표 = BB 중심선/상단 (평균회귀).
 * 기존엔 손절가만 보였고 목표가·R:R 비율이 없어 트레이더가 기대 보상을 가늠 불가.
 */
function RiskReward({ coin }: { coin: CoinScanResult }) {
  const entry = coin.price;
  const stop = coin.stopLossPrice ?? 0;
  const risk = entry - stop;
  if (!(risk > 0) || !(entry > 0)) return null;
  const riskPct = (risk / entry) * 100;
  const t1 = coin.indicators.bbMiddle;
  const t2 = coin.indicators.bbUpper;
  const rr1 = t1 > entry ? (t1 - entry) / risk : null;
  const rr2 = t2 > entry ? (t2 - entry) / risk : null;

  return (
    <Section title="리스크 / 보상 (R:R)" icon={<Target className="h-4 w-4 text-neon-cyan" />}>
      <Row label="진입가" value={`$${formatPrice(entry)}`} />
      <Row
        label="손절가 (BB하단×0.97)"
        value={`$${formatPrice(stop)} · −${riskPct.toFixed(2)}%`}
      />
      {coin.atr != null && coin.atr > 0 && (
        <Row
          label="ATR 손절 제안 (1.5×ATR)"
          value={`$${formatPrice(entry - 1.5 * coin.atr)} · −${(((1.5 * coin.atr) / entry) * 100).toFixed(2)}%`}
        />
      )}
      <div className="my-1 border-t border-border/20" />
      <RRRow label="목표 1 · BB 중심선" target={t1} entry={entry} rr={rr1} />
      <RRRow label="목표 2 · BB 상단" target={t2} entry={entry} rr={rr2} />
      <p className="mt-1.5 text-[9px] font-mono text-muted-foreground/70 leading-relaxed">
        평균회귀 기준 (목표 = BB 중심선/상단). R:R = (목표−진입) ÷ (진입−손절).
        ATR 손절은 변동성 기반의 더 넓은 대안 (고정 BB 손절이 좁아 조기 손절될 때
        참고). 참고용이며 실제 청산은 EXIT 로직을 따름.
      </p>
    </Section>
  );
}

function RRRow({
  label,
  target,
  entry,
  rr,
}: {
  label: string;
  target: number;
  entry: number;
  rr: number | null;
}) {
  const rewardPct = entry > 0 ? ((target - entry) / entry) * 100 : 0;
  return (
    <div className="flex items-center justify-between font-sans text-[11px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground">
        ${formatPrice(target)} · +{rewardPct.toFixed(2)}%
        {rr != null ? (
          <span
            className={cn(
              "ml-2 font-bold tabular-nums",
              rr >= 2
                ? "text-neon-green"
                : rr >= 1
                  ? "text-neon-yellow"
                  : "text-neon-red"
            )}
          >
            {rr.toFixed(2)}:1
          </span>
        ) : (
          <span className="ml-2 text-muted-foreground">도달</span>
        )}
      </span>
    </div>
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
        <span className="font-display text-xs font-bold tracking-wider text-foreground">
          {title}
        </span>
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between font-sans text-[11px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}

// ─── Modifier breakdown (헌장 규칙 3) ─────────
//
// VWAP modifier 만 UI 노출. 나머지 modifier (MACD / Market Breadth / Funding
// Extreme / Order Block) 는 백엔드 trade-condition 입력으로만 사용 — UI 미표시.

const MODIFIER_DEFS: Array<{
  key: "vwapMult";
  label: string;
  dimension: string;
  range: string;
  beta?: boolean;
}> = [
  { key: "vwapMult", label: "VWAP", dimension: "5 구조", range: "0.85~1.15" },
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
          추가 모디파이어 (audit 03)
        </span>
        <span className="font-mono text-[10px] text-neon-cyan">
          {present.length}개 활성
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
        "flex items-center gap-1 font-sans text-[10px]",
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

/** RSI 해석 라벨 — 숫자만으론 일반 트레이더가 구간을 알기 어려움. */
function rsiZone(rsi: number): string {
  if (rsi <= 30) return "과매도";
  if (rsi <= 40) return "약과매도";
  if (rsi >= 70) return "과매수";
  if (rsi >= 60) return "약과매수";
  return "중립";
}

/** ADX 추세 강도 해석 — BBDX 는 저-ADX(레인지)에서 평균회귀 진입. */
function adxZone(adx: number): string {
  if (adx < 20) return "약추세";
  if (adx < 25) return "추세 형성";
  return "추세";
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
      return "매수 ↑ (강)";
    case "WEAK_BULL":
      return "매수 ↑ (약)";
    case "BEAR_PRESSURE":
      return "매도 ↓ (강)";
    case "WEAK_BEAR":
      return "매도 ↓ (약)";
    default:
      return "중립";
  }
}
