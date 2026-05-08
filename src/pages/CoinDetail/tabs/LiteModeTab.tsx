/**
 * LiteModeTab — 한국어 라벨로 번역된 시그널 (일반인용).
 *
 * 백엔드 trpc.lite.translateCoin 호출 → LiteCoinCard | null.
 * 응답이 null 이면 BBDX 시그널 자체가 없다는 뜻 → 관망 placeholder.
 */

import { AlertTriangle, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import type { TimeframeValue } from "@shared/types";

interface LiteModeTabProps {
  symbol: string;
  tf?: TimeframeValue;
}

const TF_MAP: Partial<Record<TimeframeValue, "1H" | "4H" | "1D" | "1W">> = {
  "1h": "1H",
  "4h": "4H",
  "6h": "4H",
  "1d": "1D",
  "1w": "1W",
  "1M": "1W",
};

const RISK_COLOR: Record<string, string> = {
  very_low: "text-neon-green",
  low: "text-neon-green",
  medium: "text-neon-yellow",
  high: "text-neon-pink",
  very_high: "text-neon-red",
};

const TONE_COLOR: Record<string, string> = {
  good: "text-neon-green",
  caution: "text-neon-yellow",
  bad: "text-neon-red",
  neutral: "text-neon-cyan",
  muted: "text-muted-foreground",
};

export function LiteModeTab({ symbol, tf = "4h" }: LiteModeTabProps) {
  const query = trpc.lite.translateCoin.useQuery(
    { symbol, tf: TF_MAP[tf] ?? "4H" },
    { staleTime: 60_000, retry: 0 }
  );

  if (query.isLoading) {
    return (
      <div className="flex items-center justify-center py-12 gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-neon-cyan" />
        <span className="font-mono text-xs text-muted-foreground">
          한국어 라벨로 번역 중...
        </span>
      </div>
    );
  }

  if (query.error) {
    return (
      <p className="font-mono text-xs text-neon-red py-4">
        ✗ {query.error.message}
      </p>
    );
  }

  const card = query.data;

  if (!card) {
    return (
      <div className="space-y-4">
        <div className="p-4 rounded-sm border border-border/20 bg-card/40">
          <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
            추천
          </div>
          <div className="font-display text-xl font-bold text-muted-foreground">
            관망 (Hold)
          </div>
          <p className="font-mono text-[11px] text-muted-foreground mt-2">
            현재 BBDX 시그널이 발생하지 않았습니다. 진입 조건이 충족되면 자동으로
            라벨이 갱신됩니다.
          </p>
        </div>
        <div className="bg-yellow-300/5 border border-yellow-300/30 rounded-sm px-3 py-2 font-mono text-[10px] text-yellow-300/80 flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5" />
          이건 추천이 아니라 트레이딩 시그널 요약입니다. 자기책임 원칙.
        </div>
      </div>
    );
  }

  const recColor = TONE_COLOR[card.recommendationTone] ?? "text-neon-cyan";
  const riskColor = RISK_COLOR[card.riskLevel] ?? "text-muted-foreground";

  return (
    <div className="space-y-4">
      {/* 추천 chip + 위험도 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="p-4 rounded-sm border border-border/20 bg-card/40">
          <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
            추천
          </div>
          <div className={`font-display text-2xl font-bold ${recColor}`}>
            {card.recommendationLabel}
          </div>
          <div className="font-mono text-[10px] text-muted-foreground mt-1">
            강도 {card.strength.toFixed(0)} / 100
          </div>
        </div>
        <div className="p-4 rounded-sm border border-border/20 bg-card/40">
          <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
            위험도
          </div>
          <div className={`font-display text-2xl font-bold ${riskColor}`}>
            {card.riskLabel}
          </div>
        </div>
      </div>

      {/* 추천 근거 */}
      {card.reasons.length > 0 && (
        <div className="p-4 rounded-sm border border-border/20 bg-card/40">
          <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-2">
            추천 근거
          </div>
          <ul className="space-y-1">
            {card.reasons.map((r, i) => (
              <li
                key={i}
                className="font-mono text-xs text-foreground/90 flex items-start gap-2"
              >
                <span className="text-neon-cyan shrink-0">•</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 가격 + 24h 변동 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-sm border border-border/20 bg-card/40">
          <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
            현재 가격
          </div>
          <div className="font-display text-lg font-bold text-neon-cyan">
            ${card.price.toFixed(card.price < 1 ? 6 : 2)}
          </div>
        </div>
        <div className="p-3 rounded-sm border border-border/20 bg-card/40">
          <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
            24h 변동
          </div>
          <div
            className={`font-display text-lg font-bold ${
              card.change24h >= 0 ? "text-neon-green" : "text-neon-red"
            }`}
          >
            {card.change24h >= 0 ? "+" : ""}
            {card.change24h.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* 면책 footer */}
      <div className="bg-yellow-300/5 border border-yellow-300/30 rounded-sm px-3 py-2 font-mono text-[10px] text-yellow-300/80 flex items-center gap-2">
        <AlertTriangle className="h-3.5 w-3.5" />
        이건 추천이 아니라 트레이딩 시그널 요약입니다. 자기책임 원칙.
      </div>
    </div>
  );
}
