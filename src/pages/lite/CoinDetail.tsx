/**
 * /lite/coin/:symbol — 단일 코인 상세 (Lite)
 * 가격 + 한 줄 추천 + 차트 + 위험도 + 이유 1~2줄.
 */

import { useRoute, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { LiteCard } from "@/components/lite/LiteCard";
import { LiteRecommendationBadge } from "@/components/lite/LiteRecommendationBadge";
import { LiteRiskGauge } from "@/components/lite/LiteRiskGauge";
import { LiteCoinChart } from "@/components/lite/LiteCoinChart";
import { Button } from "@/components/ui/button";
import { ArrowLeft, BarChart3, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { TOP_COINS } from "@shared/types";
import { useState } from "react";

function formatPrice(p: number): string {
  if (p === 0) return "—";
  if (p < 1) return p.toFixed(6);
  if (p < 100) return p.toFixed(4);
  return p.toFixed(2);
}

export default function LiteCoinDetail() {
  const [match, params] = useRoute("/lite/coin/:symbol");
  const [, setLocation] = useLocation();
  const symbol = match ? (params.symbol ?? "BTCUSDT").toUpperCase() : "BTCUSDT";

  const { data, isLoading, error } = trpc.lite.coin.useQuery(
    { symbol },
    { staleTime: 60_000, refetchOnWindowFocus: false }
  );

  const [pickerOpen, setPickerOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-neon-pink" />
        <span className="font-mono text-sm text-muted-foreground">
          {symbol} 분석 중...
        </span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <LiteCard variant="bad" title="코인 정보를 불러오지 못했어요">
        <p className="font-mono text-xs text-neon-red mb-3">
          {String(error?.message ?? "데이터 없음")}
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setLocation("/lite")}
          className="border-border/40 font-mono text-[11px]"
        >
          <ArrowLeft className="h-3 w-3 mr-1" />
          돌아가기
        </Button>
      </LiteCard>
    );
  }

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setLocation("/lite")}
            className="h-8 w-8 p-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="font-display text-2xl font-bold tracking-wide text-foreground">
              {data.base}
            </div>
            <div className="font-mono text-xs text-muted-foreground">
              {data.symbol}
            </div>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setPickerOpen((v) => !v)}
          className="font-mono text-[11px]"
        >
          코인 바꾸기
        </Button>
      </div>

      {pickerOpen && (
        <LiteCard variant="muted">
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {TOP_COINS.slice(0, 24).map((s) => (
              <button
                key={s}
                onClick={() => {
                  setPickerOpen(false);
                  setLocation(`/lite/coin/${s}`);
                }}
                className={cn(
                  "px-2 py-1.5 rounded-lg font-mono text-[11px] border transition-colors",
                  s === data.symbol
                    ? "border-neon-cyan/40 bg-neon-cyan/10 text-neon-cyan"
                    : "border-border/30 text-muted-foreground hover:text-foreground hover:bg-muted/30"
                )}
              >
                {s.replace("USDT", "")}
              </button>
            ))}
          </div>
        </LiteCard>
      )}

      {/* Hero — 가격 + 추천 */}
      <LiteCard
        variant={
          data.recommendation === "STRONG_BUY" || data.recommendation === "BUY"
            ? "good"
            : data.recommendation === "STRONG_SELL"
              ? "bad"
              : data.recommendation === "SELL"
                ? "caution"
                : "default"
        }
      >
        <div className="space-y-3">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <div>
              <div className="font-mono text-xs text-muted-foreground">현재 가격</div>
              <div className="font-display text-3xl font-bold text-foreground">
                ${formatPrice(data.price)}
              </div>
              <div
                className={cn(
                  "font-mono text-sm",
                  data.change24h >= 0 ? "text-neon-green" : "text-neon-red"
                )}
              >
                {data.change24h >= 0 ? "+" : ""}
                {data.change24h.toFixed(2)}% (24h)
              </div>
            </div>
            <LiteRecommendationBadge
              recommendation={data.recommendation}
              label={data.recommendationLabel.label}
              size="lg"
            />
          </div>
          <p className="font-mono text-sm text-foreground leading-relaxed">
            {data.recommendationLabel.oneLiner}
          </p>
          {data.reasons.length > 0 && (
            <ul className="font-mono text-[12px] text-muted-foreground space-y-1 pt-2 border-t border-border/30">
              {data.reasons.map((r, i) => (
                <li key={i} className="leading-relaxed">• {r}</li>
              ))}
            </ul>
          )}
        </div>
      </LiteCard>

      {/* 차트 */}
      <LiteCard
        icon={<BarChart3 className="h-5 w-5 text-neon-cyan" />}
        title="가격 흐름"
        subtitle="최근 60개 캔들 · 색상 점선이 평소 평균선 / 싼/비싼 영역"
      >
        {data.chartCandles.length > 0 ? (
          <LiteCoinChart candles={data.chartCandles} bb={data.bb} height={240} />
        ) : (
          <p className="font-mono text-xs text-muted-foreground py-6 text-center">
            차트 데이터 없음
          </p>
        )}
      </LiteCard>

      {/* 위험도 */}
      <LiteCard title="지금의 위험도" subtitle={data.riskLabel.oneLiner}>
        <LiteRiskGauge level={data.riskLevel} label={data.riskLabel.label} />
      </LiteCard>

      {/* Pro 모드로 전환 */}
      <div className="text-center">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setLocation(`/coin/${data.symbol}`)}
          className="font-mono text-[11px] border-neon-cyan/30 text-neon-cyan"
        >
          Pro 상세 분석 보기
        </Button>
      </div>
    </div>
  );
}
