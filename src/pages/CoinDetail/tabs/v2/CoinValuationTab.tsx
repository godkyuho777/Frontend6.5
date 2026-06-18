/**
 * CoinValuationTab — 코인 밸류에이션 (CoinDetail "밸류에이션" 탭).
 *
 * 백엔드 `trpc.coin.valuation` 소비. 핵심은 *모든 코인을 같은 잣대로 보지 않는 것* —
 * 분류(fundamental / 가치저장 / 부적합 / 제한적)를 먼저 보이고, 가용한 배수만 표시.
 * 헌장: 표시 전용 디스커버리/교육 지표. BBDX 시그널과 무관, 단독 매매 신호 X.
 */

import { TrendingUp, AlertTriangle, RotateCcw, Info } from "lucide-react";
import { trpc } from "@/lib/trpc";
import type { CoinValuation } from "@tradelab/backend/router";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const KIND_STYLE: Record<CoinValuation["kind"], { bg: string; text: string }> = {
  fundamental: { bg: "#E6F1FB", text: "#0C447C" },
  "store-of-value": { bg: "#FAEEDA", text: "#633806" },
  "not-applicable": { bg: "#FCEAF1", text: "#7A1D45" },
  limited: { bg: "#ECECEC", text: "#555555" },
};

function usd(v: number | null): string {
  if (v == null) return "—";
  const a = Math.abs(v);
  if (a >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (a >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${v.toFixed(2)}`;
}
const ratio = (v: number | null) => (v == null ? "—" : `${v.toFixed(2)}×`);
const pct = (v: number | null) => (v == null ? "—" : `${(v * 100).toFixed(1)}%`);

interface Metric {
  label: string;
  value: string;
  help: string;
  available: boolean;
}

export function CoinValuationTab({ symbol }: { symbol: string }) {
  const { data, isLoading, isError, refetch, isRefetching } =
    trpc.coin.valuation.useQuery(
      { symbol },
      { staleTime: 5 * 60 * 1000 },
    );

  if (isLoading) return <ValuationSkeleton />;
  if (isError || !data)
    return (
      <ValuationError onRetry={() => refetch()} retrying={isRefetching} />
    );
  return <ValuationView v={data} />;
}

function ValuationView({ v }: { v: CoinValuation }) {
  const ks = KIND_STYLE[v.kind] ?? KIND_STYLE.limited;
  const metrics: Metric[] = [
    { label: "시가총액", value: usd(v.marketCapUsd), help: "유통 공급 × 가격", available: v.marketCapUsd != null },
    { label: "FDV", value: usd(v.fdvUsd), help: "완전희석가치 (총공급 × 가격)", available: v.fdvUsd != null },
    { label: "FDV / 시총", value: ratio(v.fdvMcRatio), help: "미래 희석 배수 — 1=완전유통, ↑일수록 언락 부담", available: v.fdvMcRatio != null },
    { label: "유통 비율", value: pct(v.circulatingPct), help: "유통 ÷ 최대(또는 총) 공급", available: v.circulatingPct != null },
    { label: "NVT (근사)", value: ratio(v.nvtApprox), help: "시총 ÷ 24h 거래량 — 거래소 기준 근사(참고용)", available: v.nvtApprox != null },
    { label: "TVL", value: usd(v.tvlUsd), help: "온체인 예치총액 (DeFi·체인, DefiLlama)", available: v.tvlUsd != null },
    { label: "MC / TVL", value: ratio(v.mcTvlRatio), help: "시총 ÷ TVL — 낮을수록 TVL 대비 저평가", available: v.mcTvlRatio != null },
    { label: "P / F", value: ratio(v.priceToFees), help: "시총 ÷ 연환산 수수료 — 전통 P/S의 크립토판", available: v.priceToFees != null },
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* 분류 배너 */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center gap-2">
          <TrendingUp className="size-5 text-muted-foreground" />
          <span
            className="inline-flex items-center rounded-md px-2 py-0.5 text-[13px] font-bold"
            style={{ backgroundColor: ks.bg, color: ks.text }}
          >
            {v.kindLabel}
          </span>
          <span className="font-mono text-sm text-muted-foreground">
            {v.baseSymbol}
          </span>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-foreground">
          {v.kindNote}
        </p>
      </div>

      {/* 지표 그리드 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {metrics.map((m) => (
          <div
            key={m.label}
            className={cn(
              "rounded-xl border border-border bg-card p-4",
              !m.available && "opacity-55",
            )}
          >
            <div className="text-xs text-muted-foreground">{m.label}</div>
            <div className="mt-1 font-mono text-lg font-bold tracking-tight text-foreground">
              {m.value}
            </div>
            <div className="mt-1 text-[11px] leading-tight text-muted-foreground">
              {m.help}
            </div>
          </div>
        ))}
      </div>

      {/* 데이터 노트 */}
      {v.notes.length > 0 && (
        <div className="rounded-xl border border-border bg-muted/40 p-4">
          <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
            <Info className="size-3.5" />
            데이터 노트
          </div>
          <ul className="mt-2 flex flex-col gap-1">
            {v.notes.map((n, i) => (
              <li
                key={i}
                className="text-xs leading-relaxed text-muted-foreground"
              >
                · {n}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 면책 */}
      <p className="border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
        밸류에이션은 디스커버리·교육용 표시 지표이며 BBDX 시그널과 무관합니다. 단독
        매매 신호를 발행하지 않으며, 수치는 발행 시점(as-of) 기준입니다. 외부
        데이터(CoinGecko·DefiLlama) 가용성에 따라 일부 지표는 표시되지 않을 수
        있습니다.
      </p>
    </div>
  );
}

function ValuationSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true">
      <div className="h-24 animate-pulse rounded-xl bg-muted" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    </div>
  );
}

function ValuationError({
  onRetry,
  retrying,
}: {
  onRetry: () => void;
  retrying: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card px-6 py-16 text-center">
      <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <AlertTriangle className="size-5" />
      </div>
      <p className="text-base font-bold text-foreground">
        밸류에이션을 불러오지 못했어요
      </p>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">
        외부 데이터 제공처가 일시적으로 응답하지 않을 수 있어요. 잠시 후 다시
        시도해주세요.
      </p>
      <Button
        variant="outline"
        className="mt-5 h-9"
        onClick={onRetry}
        disabled={retrying}
      >
        <RotateCcw className={cn("size-4", retrying && "animate-spin")} />
        다시 시도
      </Button>
    </div>
  );
}
