/**
 * CriteriaTab — 매매기준 표준 레이아웃.
 *
 * 명세: TRACKER_TAB_STANDARD §2.1 — 모든 트래커가 동일 props 구조로 매매기준 표시.
 * LONG/SHORT 룰 + 가중치 표 + 임계 + 안전 장치 + EXIT + 헌장 통과.
 *
 * 트래커별 데이터는 props 로 주입 (전인구, BBDX v6.6, VP+Trend, Macro 등).
 */

import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import type { ReactNode } from "react";
import { HudPanel } from "@/components/HudPanel";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface WeightRow {
  /** 표시 이름 (예: "전인구", "RSI") */
  name: string;
  /** 가중치 크기 ±값 (예: 0.50, 0.30) */
  value: number;
  /** 매우 높음 강조 여부 */
  highlight?: boolean;
  /** 추가 경고 메시지 */
  warning?: string;
}

export interface CharterRow {
  /** 1, 2, 3, "V" 등 헌장 규칙 식별자 */
  rule: 1 | 2 | 3 | "V";
  /** 통과 상태 */
  status: "pass" | "warn" | "fail";
  /** 표시 라벨 (예: "다차원 합의", "Lookahead-free") */
  label: string;
}

export interface CriteriaTabProps {
  entry_rules: {
    long: string[];
    short: string[];
  };
  weights: WeightRow[];
  /** 가중치 출처/근거 (예: "직관값 — calibration 미완"). */
  weights_source_note?: string;
  thresholds: Record<string, string | number>;
  safety_mechanisms: string[];
  exit_rules: string[];
  charter_compliance: CharterRow[];
  /** 페이지별 부가 안내 (예: Phase pending 카드). */
  footer?: ReactNode;
}

function Section({
  title,
  children,
  variant,
}: {
  title: string;
  children: ReactNode;
  variant?: "default" | "highlight" | "danger";
}) {
  return (
    <HudPanel title={title} variant={variant ?? "default"}>
      {children}
    </HudPanel>
  );
}

function RuleList({ items, accent }: { items: string[]; accent: "long" | "short" }) {
  if (items.length === 0) {
    return (
      <p className="font-mono text-xs text-muted-foreground italic">
        룰 없음
      </p>
    );
  }
  const dotColor = accent === "long" ? "bg-neon-green" : "bg-neon-red";
  return (
    <ul className="space-y-2">
      {items.map((rule, i) => (
        <li key={i} className="flex items-start gap-2 text-sm font-mono">
          <span className={cn("mt-1.5 h-1.5 w-1.5 rounded-full shrink-0", dotColor)} />
          <span className="text-foreground/90">{rule}</span>
        </li>
      ))}
    </ul>
  );
}

const CHARTER_LABELS: Record<CharterRow["rule"], string> = {
  1: "헌장 1 — 다차원 합의",
  2: "헌장 2 — Lookahead-free",
  3: "헌장 3 — Modifier-only",
  V: "헌장 V — 검증 통과",
};

export function CriteriaTab({
  entry_rules,
  weights,
  weights_source_note,
  thresholds,
  safety_mechanisms,
  exit_rules,
  charter_compliance,
  footer,
}: CriteriaTabProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* LONG 진입 룰 */}
      <Section title="LONG 진입 조건">
        <RuleList items={entry_rules.long} accent="long" />
      </Section>

      {/* SHORT 진입 룰 */}
      <Section title="SHORT 진입 조건">
        <RuleList items={entry_rules.short} accent="short" />
      </Section>

      {/* 가중치 표 (전체 폭) */}
      <div className="md:col-span-2">
        <Section title="가중치 (Weights)">
          <div className="space-y-2">
            {weights.map((w, i) => (
              <div
                key={`${w.name}-${i}`}
                className={cn(
                  "flex items-center justify-between gap-3 px-3 py-2 rounded-sm",
                  "border",
                  w.highlight
                    ? "border-neon-pink/40 bg-neon-pink/5"
                    : "border-border/30 bg-background/40"
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={cn(
                      "font-mono text-sm truncate",
                      w.highlight ? "text-neon-pink font-bold" : "text-foreground"
                    )}
                  >
                    {w.name}
                  </span>
                  {w.warning && (
                    <Badge
                      variant="outline"
                      className="border-neon-red/40 text-neon-red text-[10px] font-mono gap-1"
                    >
                      <AlertTriangle className="h-3 w-3" />
                      {w.warning}
                    </Badge>
                  )}
                </div>
                <span
                  className={cn(
                    "font-display tabular-nums shrink-0",
                    w.highlight ? "text-neon-pink text-lg font-bold" : "text-neon-cyan text-sm"
                  )}
                >
                  ±{w.value.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
          {weights_source_note && (
            <p className="mt-3 font-mono text-[11px] text-muted-foreground italic">
              {weights_source_note}
            </p>
          )}
        </Section>
      </div>

      {/* 임계값 */}
      <Section title="임계 (Thresholds)">
        <dl className="space-y-2">
          {Object.entries(thresholds).map(([k, v]) => (
            <div
              key={k}
              className="flex items-center justify-between gap-3 text-sm font-mono"
            >
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="text-neon-cyan tabular-nums">{String(v)}</dd>
            </div>
          ))}
        </dl>
      </Section>

      {/* 안전 장치 */}
      <Section title="안전 장치">
        <ul className="space-y-1.5">
          {safety_mechanisms.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm font-mono">
              <CheckCircle2 className="h-3.5 w-3.5 text-neon-green shrink-0 mt-0.5" />
              <span className="text-foreground/90">{item}</span>
            </li>
          ))}
        </ul>
      </Section>

      {/* EXIT 룰 */}
      <Section title="EXIT 룰">
        <RuleList items={exit_rules} accent="short" />
      </Section>

      {/* 헌장 통과 */}
      <Section title="헌장 통과 (Charter Compliance)">
        <ul className="space-y-2">
          {charter_compliance.map((c, i) => {
            const Icon =
              c.status === "pass"
                ? CheckCircle2
                : c.status === "warn"
                  ? AlertTriangle
                  : XCircle;
            const color =
              c.status === "pass"
                ? "text-neon-green"
                : c.status === "warn"
                  ? "text-yellow-400"
                  : "text-neon-red";
            return (
              <li
                key={i}
                className="flex items-center justify-between gap-2 text-sm font-mono"
              >
                <span className="flex items-center gap-2">
                  <Icon className={cn("h-3.5 w-3.5 shrink-0", color)} />
                  <span className="text-foreground/90">{c.label}</span>
                </span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  {CHARTER_LABELS[c.rule]}
                </span>
              </li>
            );
          })}
        </ul>
      </Section>

      {footer && <div className="md:col-span-2">{footer}</div>}
    </div>
  );
}
