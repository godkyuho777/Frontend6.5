import { BookOpen, History, Lightbulb, Sparkles, TrendingDown, TrendingUp } from "lucide-react";

import { HudPanel } from "@/components/HudPanel";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { MacroLayer } from "@shared/macro-types";
import {
  REGIME_RULEBOOK,
  type MacroIndicatorMeta,
  type MacroRegimeDescriptor,
} from "@shared/macro-indicator-types";
import type {
  MacroIndicatorStatus,
  MacroSeriesData,
} from "@/hooks/useMacroIndicator";

/**
 * MacroInterpretation — 가장 중요한 카드.
 *
 * regime / composite signals / 역사적 사례 / BBDX 영향 시뮬레이션을 모두 결합해
 * 한국어 동적 분석 텍스트 6단계 구성.
 *
 *  1. 현재 상황 1줄 요약 (regime + primary metric)
 *  2. regime 해석 2~3줄 (왜 그 regime 이 나왔는지)
 *  3. C1~C4 composite 영향
 *  4. 학술 레퍼런스 (Bowman 등) 인용
 *  5. BBDX 영향 시뮬레이션
 *  6. 다음 단계 시나리오 (regime 전환 가능성)
 *
 * Stub 상태 → 정적 룰북 텍스트 + 5단계 일반 설명.
 */
interface MacroInterpretationProps {
  meta: MacroIndicatorMeta;
  layer: MacroLayer | null;
  status: MacroIndicatorStatus;
  series: MacroSeriesData[];
  /** 차트의 derived (또는 primary) 시리즈 ID — 1줄 요약에 사용. */
  primarySeriesId?: string;
}

function fmtSign(v: number, digits = 1): string {
  return `${v >= 0 ? "+" : ""}${v.toFixed(digits)}`;
}

function pickPrimarySeries(
  series: MacroSeriesData[],
  primarySeriesId?: string,
): MacroSeriesData | undefined {
  if (primarySeriesId) {
    const m = series.find(s => s.id === primarySeriesId);
    if (m) return m;
  }
  // fallback: derived 시리즈 우선, 없으면 마지막 시리즈
  return series.find(s => s.derived) ?? series[series.length - 1];
}

export function MacroInterpretation({
  meta,
  layer,
  status,
  series,
  primarySeriesId,
}: MacroInterpretationProps) {
  const isStub = status === "stub" || layer == null;
  const currentRegime: MacroRegimeDescriptor =
    REGIME_RULEBOOK.find(r => r.key === (layer?.regime ?? "neutral")) ??
    REGIME_RULEBOOK[2];

  const primarySeries = pickPrimarySeries(series, primarySeriesId);
  const primaryLatest = primarySeries?.latest ?? null;
  const primaryUnit = primarySeries?.unit ?? "";

  // composite signals (layer 가 있을 때만 의미)
  const c1 = layer?.c1_crisis ?? 0;
  const c2 = layer?.c2_riskOn ?? 0;
  const c3 = layer?.c3_net_liquidity_30d_pct ?? 0;
  const c4 = layer?.c4_cycle_phase ?? "neutral";

  // ── 동적 요약 (live 모드) ───────────────────────────────
  const summaryLine = isStub
    ? `${meta.title} — 데이터 미연결 (FRED_API_KEY 미설정). 정적 룰북 기반 일반 해석을 표시 중.`
    : primaryLatest != null
      ? `${meta.title} 현재 ${primaryLatest.toFixed(2)}${primaryUnit} · regime ${currentRegime.label} (×${currentRegime.multiplier.toFixed(2)})`
      : `${meta.title} — snapshot 수신 완료 · regime ${currentRegime.label} (×${currentRegime.multiplier.toFixed(2)})`;

  // ── regime 해석 텍스트 ─────────────────────────────────
  const regimeExplain = isStub
    ? "FRED 데이터 수신 후 regime 이 동적으로 분류됩니다. 현재는 5단계 룰북 기반 일반 설명을 참고하세요."
    : buildRegimeExplain(currentRegime, layer);

  // ── composite 해석 ─────────────────────────────────────
  const compositeExplain = isStub
    ? "C1 (crisis) / C2 (risk-on) / C3 (net liquidity) / C4 (cycle phase) composite 는 FRED 시계열 수신 후 실시간 계산됩니다."
    : buildCompositeExplain(c1, c2, c3, c4);

  // ── BBDX 영향 시뮬레이션 텍스트 ─────────────────────────
  const bbdxExplain = isStub
    ? "FRED 키 등록 후 macro multiplier × BBDX score 의 실제 영향이 표시됩니다. 현재는 multiplier 1.00 = base score 유지."
    : buildBbdxExplain(layer, currentRegime);

  // ── 다음 시나리오 ──────────────────────────────────────
  const nextScenario = isStub
    ? "현재 stub 상태 — 키 등록 후 실시간 시나리오 텍스트가 활성화됩니다."
    : buildNextScenario(currentRegime, layer);

  return (
    <HudPanel
      title="Interpretation"
      subtitle="regime + composite + 학술 레퍼런스 + BBDX 영향 동적 분석"
      variant={currentRegime.key === "crisis" ? "danger" : "highlight"}
    >
      <div className="space-y-4">
        {/* 1) 요약 1줄 */}
        <div className="rounded-md border border-foreground/10 bg-muted/20 p-3">
          <div className="flex items-start gap-2">
            <Sparkles className="h-4 w-4 text-neon-cyan mt-0.5 shrink-0" />
            <p
              className={cn(
                "text-sm font-display font-bold leading-relaxed",
                isStub ? "text-muted-foreground" : currentRegime.textClass,
              )}
            >
              {summaryLine}
            </p>
          </div>
        </div>

        {/* 2) regime 해석 */}
        <Section
          icon={<TrendingUp className="h-3.5 w-3.5 text-neon-green" />}
          label="REGIME 해석"
        >
          <p className="text-xs text-foreground/90 leading-relaxed whitespace-pre-line">
            {regimeExplain}
          </p>
        </Section>

        {/* 3) composite 해석 */}
        <Section
          icon={<TrendingDown className="h-3.5 w-3.5 text-orange-400" />}
          label="COMPOSITE 영향 (C1/C2/C3/C4)"
        >
          <p className="text-xs text-foreground/90 leading-relaxed whitespace-pre-line">
            {compositeExplain}
          </p>
        </Section>

        {/* 4) 학술 레퍼런스 */}
        <Section
          icon={<BookOpen className="h-3.5 w-3.5 text-neon-cyan" />}
          label="학술 레퍼런스 / Baseline"
        >
          <div className="space-y-2">
            {meta.references.map((ref, i) => (
              <div
                key={i}
                className="rounded-md border border-foreground/10 bg-card p-2"
              >
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-mono text-[10px] text-neon-cyan font-bold">
                    {ref.source}
                  </span>
                  {ref.tag && (
                    <Badge
                      variant="outline"
                      className="font-mono text-[9px] border-neon-cyan/30 text-neon-cyan/90"
                    >
                      {ref.tag}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-foreground/80 leading-relaxed">
                  {ref.finding}
                </p>
              </div>
            ))}
          </div>
        </Section>

        {/* 5) 역사적 사례 */}
        <Section
          icon={<History className="h-3.5 w-3.5 text-neon-yellow" />}
          label="역사적 사례 (BTC 동시 수익률)"
        >
          <div className="space-y-1.5">
            {meta.historicalEvents.map((ev, i) => (
              <div
                key={i}
                className="grid grid-cols-12 gap-2 items-center rounded-md border border-foreground/10 bg-card p-2"
              >
                <div className="col-span-3 sm:col-span-2 font-mono text-[10px] text-neon-yellow font-bold">
                  {ev.date}
                </div>
                <div className="col-span-3 sm:col-span-2 font-mono text-xs text-foreground">
                  {fmtSign(ev.value, ev.value > 100 ? 1 : 2)}
                  {ev.unit}
                </div>
                <div
                  className={cn(
                    "col-span-3 sm:col-span-2 font-mono text-xs font-bold",
                    ev.btcReturn >= 0 ? "text-neon-green" : "text-red-400",
                  )}
                >
                  BTC {fmtSign(ev.btcReturn, 1)}%
                </div>
                <div className="col-span-12 sm:col-span-6 text-xs text-muted-foreground leading-tight">
                  {ev.description}
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* 6) BBDX 영향 + 다음 시나리오 */}
        <Section
          icon={<Lightbulb className="h-3.5 w-3.5 text-primary" />}
          label="BBDX 영향 시뮬레이션 + 다음 시나리오"
        >
          <div className="space-y-2">
            <p className="text-xs text-foreground/90 leading-relaxed whitespace-pre-line">
              {bbdxExplain}
            </p>
            <div className="rounded-md border-l-2 border-neon-cyan/50 bg-cyan-500/5 p-2">
              <div className="font-mono text-[9px] text-neon-cyan tracking-wider mb-0.5">
                NEXT SCENARIO
              </div>
              <p className="text-xs text-foreground/85 leading-relaxed">
                {nextScenario}
              </p>
            </div>
          </div>
        </Section>

        {/* 정적 룰북 (stub 또는 항상 표시 — 사용자 reference 용) */}
        <Section
          icon={<BookOpen className="h-3.5 w-3.5 text-muted-foreground" />}
          label="STATIC RULEBOOK (영구 참조)"
        >
          <p className="text-xs text-muted-foreground leading-relaxed">
            {meta.staticInterpretation}
          </p>
        </Section>
      </div>
    </HudPanel>
  );
}

// ─── Helpers ─────────────────────────────────────────────────

function Section({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="font-mono text-[10px] tracking-wider text-muted-foreground">
          {label}
        </span>
      </div>
      <div className="pl-5">{children}</div>
    </div>
  );
}

// ─── 동적 텍스트 빌더 ────────────────────────────────────────

function buildRegimeExplain(
  regime: MacroRegimeDescriptor,
  layer: MacroLayer,
): string {
  const baseTxt = regime.description;
  const score = layer.score;
  const scoreTxt =
    score >= 60
      ? "+60 이상의 강한 risk-on 점수"
      : score >= 20
        ? "중립 ~ 약한 risk-on"
        : score >= -20
          ? "명확한 방향 없는 중립"
          : score >= -60
            ? "약한 ~ 중간 risk-off"
            : "-60 미만의 강한 risk-off";
  return `${baseTxt}\n\n현재 macro score ${score.toFixed(0)} (-100 ~ +100) = ${scoreTxt}. ${regime.label} regime 에 대응되는 multiplier ${regime.multiplier.toFixed(2)} 가 BBDX 시그널의 entry confidence 에 곱셈으로 적용됩니다.`;
}

function buildCompositeExplain(
  c1: number,
  c2: number,
  c3: number,
  c4: string,
): string {
  const c1Txt =
    c1 >= 0.6
      ? `C1 crisis ${c1.toFixed(2)} → 위기 강화 신호 (≥0.6 임계 통과)`
      : `C1 crisis ${c1.toFixed(2)} → 위기 신호 없음`;
  const c2Txt =
    c2 >= 0.8
      ? `C2 risk-on ${c2.toFixed(2)} → 강한 risk-on 강화 (≥0.8 임계 통과)`
      : c2 >= 0.5
        ? `C2 risk-on ${c2.toFixed(2)} → 중립적 risk-on`
        : `C2 risk-on ${c2.toFixed(2)} → risk-on 신호 약함`;
  const c3Txt =
    c3 >= 0
      ? `C3 net liquidity 30d ${c3 >= 0 ? "+" : ""}${c3.toFixed(2)}% → 순유동성 유입 환경`
      : `C3 net liquidity 30d ${c3.toFixed(2)}% → 순유동성 유출 / drain 환경`;
  const c4LabelMap: Record<string, string> = {
    pre_recession: "PRE-RECESSION (yield curve 역전 후 초기)",
    recession_imminent: "RECESSION IMMINENT (Fed pivot 임박)",
    fed_pivot: "FED PIVOT (금리 인하 시작)",
    crypto_rally: "CRYPTO RALLY (사이클 강세 단계)",
    neutral: "NEUTRAL (특정 phase 미식별)",
  };
  const c4Txt = `C4 cycle phase: ${c4LabelMap[c4] ?? c4}`;
  return `${c1Txt}.\n${c2Txt}.\n${c3Txt}.\n${c4Txt}.`;
}

function buildBbdxExplain(
  layer: MacroLayer,
  regime: MacroRegimeDescriptor,
): string {
  const baseScore = 65;
  const effectiveMult = 1 + (regime.multiplier - 1) * layer.freshness_mult;
  const finalScore = baseScore * effectiveMult;
  const delta = finalScore - baseScore;
  const deltaTxt =
    delta >= 0
      ? `+${delta.toFixed(1)} 가중 (multiplier ${regime.multiplier.toFixed(2)} × freshness ${layer.freshness_mult.toFixed(2)})`
      : `${delta.toFixed(1)} 감쇄 (multiplier ${regime.multiplier.toFixed(2)} × freshness ${layer.freshness_mult.toFixed(2)})`;
  return `예시 base BBDX LONG score ${baseScore} 가정 시:\n→ macro ${regime.label} multiplier ×${effectiveMult.toFixed(2)} 적용\n→ final BBDX score ≈ ${finalScore.toFixed(1)} (${deltaTxt})\n\n실제 EntryDecision 은 signal × wave × structure × volatility × volume × macro × onchain 의 7차원 곱셈. 본 multiplier 는 그중 macro 차원의 기여만 표시.`;
}

function buildNextScenario(
  current: MacroRegimeDescriptor,
  layer: MacroLayer,
): string {
  // 현재 regime 보다 한 단계 위 / 아래 후보 제시
  const order: MacroRegimeDescriptor[] = REGIME_RULEBOOK;
  const idx = order.findIndex(r => r.key === current.key);
  const up = idx < order.length - 1 ? order[idx + 1] : null;
  const down = idx > 0 ? order[idx - 1] : null;

  const score = layer.score;
  // 점수가 어느 방향으로 가까운지에 따라 우선 표시
  const lean = score >= 0 ? "up" : "down";
  const lines: string[] = [];

  if (lean === "up" && up) {
    lines.push(
      `score 가 추가 상승 시 → ${up.label} (×${up.multiplier.toFixed(2)}) 진입 가능. 65 base BBDX score 예시는 ${(65 * (1 + (up.multiplier - 1) * layer.freshness_mult)).toFixed(1)} 로 상승.`,
    );
  } else if (down) {
    lines.push(
      `score 가 추가 하락 시 → ${down.label} (×${down.multiplier.toFixed(2)}) 진입 가능. 65 base BBDX score 예시는 ${(65 * (1 + (down.multiplier - 1) * layer.freshness_mult)).toFixed(1)} 로 감쇄.`,
    );
  }

  if (lean === "up" && down) {
    lines.push(
      `반대 방향: score 가 하락 시 ${down.label} (×${down.multiplier.toFixed(2)}) 로 후퇴 가능.`,
    );
  } else if (lean === "down" && up) {
    lines.push(
      `반대 방향: score 가 상승 시 ${up.label} (×${up.multiplier.toFixed(2)}) 로 회복 가능.`,
    );
  }

  if (lines.length === 0) {
    lines.push(`현재 ${current.label} 가 극단 — 추가 regime 전환 여지 제한적.`);
  }

  return lines.join("\n\n");
}
