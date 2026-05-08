/**
 * /lite — 오늘의 추천 대시보드
 * Top buy / Top sell + 시장 분위기 + 학습 카드.
 */

import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { LiteCard } from "@/components/lite/LiteCard";
import { LiteRecommendationBadge } from "@/components/lite/LiteRecommendationBadge";
import { LiteRiskGauge } from "@/components/lite/LiteRiskGauge";
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  Loader2,
  Lightbulb,
  Compass,
} from "lucide-react";
import { cn } from "@/lib/utils";

function formatPrice(p: number): string {
  if (p === 0) return "—";
  if (p < 1) return p.toFixed(6);
  if (p < 100) return p.toFixed(4);
  return p.toFixed(2);
}

function MoodColor(mood: string): string {
  switch (mood) {
    case "bullish_strong": return "text-neon-green";
    case "bullish": return "text-neon-cyan";
    case "neutral": return "text-muted-foreground";
    case "bearish": return "text-neon-yellow";
    case "bearish_strong": return "text-neon-red";
    default: return "text-muted-foreground";
  }
}

export default function LiteDashboard() {
  const { data, isLoading, error } = trpc.lite.dashboard.useQuery(
    {},
    { staleTime: 60_000, refetchOnWindowFocus: false }
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-neon-pink" />
        <span className="font-mono text-sm text-muted-foreground">
          오늘의 시그널을 모으고 있어요...
        </span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <LiteCard variant="bad" title="문제가 생겼어요" subtitle="잠시 후 새로고침">
        <p className="font-mono text-xs text-neon-red">
          {String(error?.message ?? "알 수 없는 오류")}
        </p>
      </LiteCard>
    );
  }

  return (
    <div className="space-y-5">
      {/* Hero — 시장 분위기 */}
      <LiteCard
        variant={
          data.marketMood === "bullish_strong" || data.marketMood === "bullish"
            ? "good"
            : data.marketMood === "bearish_strong"
              ? "bad"
              : data.marketMood === "bearish"
                ? "caution"
                : "default"
        }
        icon={<Compass className={cn("h-6 w-6", MoodColor(data.marketMood))} />}
        title="지금 시장 분위기"
      >
        <div className="space-y-2">
          <div className={cn("font-display text-2xl font-bold tracking-wide", MoodColor(data.marketMood))}>
            {data.marketMoodLabel}
          </div>
          <p className="font-mono text-sm text-muted-foreground leading-relaxed">
            {data.marketMoodOneLiner}
          </p>
        </div>
      </LiteCard>

      {/* Top Buy */}
      <section>
        <header className="flex items-center gap-2 mb-3">
          <div className="h-7 w-7 rounded-lg bg-neon-green/15 border border-neon-green/30 flex items-center justify-center">
            <TrendingUp className="h-4 w-4 text-neon-green" />
          </div>
          <div>
            <h2 className="font-display text-base font-bold tracking-wider text-foreground">
              오늘의 매수 추천 Top {data.topBuy.length}
            </h2>
            <p className="font-mono text-[11px] text-muted-foreground">
              평소보다 싸졌거나 반등 신호가 보이는 코인
            </p>
          </div>
        </header>
        {data.topBuy.length === 0 ? (
          <LiteCard variant="muted">
            <p className="font-mono text-sm text-muted-foreground text-center py-2">
              지금은 추천할 매수 코인이 없어요. 잠시 후 다시 확인해주세요.
            </p>
          </LiteCard>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.topBuy.map((c) => (
              <CoinRecommendationCard key={c.symbol} coin={c} />
            ))}
          </div>
        )}
      </section>

      {/* Top Sell */}
      <section>
        <header className="flex items-center gap-2 mb-3">
          <div className="h-7 w-7 rounded-lg bg-neon-red/15 border border-neon-red/30 flex items-center justify-center">
            <TrendingDown className="h-4 w-4 text-neon-red" />
          </div>
          <div>
            <h2 className="font-display text-base font-bold tracking-wider text-foreground">
              매도 / 익절 후보 Top {data.topSell.length}
            </h2>
            <p className="font-mono text-[11px] text-muted-foreground">
              평소보다 비싸졌거나 반전 신호가 보이는 코인
            </p>
          </div>
        </header>
        {data.topSell.length === 0 ? (
          <LiteCard variant="muted">
            <p className="font-mono text-sm text-muted-foreground text-center py-2">
              매도 신호가 뚜렷한 코인이 없어요.
            </p>
          </LiteCard>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.topSell.map((c) => (
              <CoinRecommendationCard key={c.symbol} coin={c} />
            ))}
          </div>
        )}
      </section>

      {/* 학습 카드 */}
      <LiteCard
        variant="muted"
        icon={<Lightbulb className="h-5 w-5 text-neon-cyan" />}
        title="잠깐, 모르는 단어가 있나요?"
      >
        <p className="font-mono text-sm text-muted-foreground mb-2">
          RSI, BB, ADX 같은 단어를 클릭 한 번에 쉽게 풀어드려요.
        </p>
        <Link href="/lite/learn">
          <a className="inline-flex items-center gap-1 font-mono text-sm text-neon-cyan hover:underline cursor-pointer">
            <Sparkles className="h-3.5 w-3.5" />
            용어 사전 보기 →
          </a>
        </Link>
      </LiteCard>
    </div>
  );
}

function CoinRecommendationCard({
  coin,
}: {
  coin: {
    symbol: string;
    base: string;
    price: number;
    change24h: number;
    recommendation:
      | "STRONG_BUY"
      | "BUY"
      | "WATCH"
      | "HOLD"
      | "SELL"
      | "STRONG_SELL"
      | "BLOCKED";
    riskLevel: "very_low" | "low" | "medium" | "high" | "very_high";
    reasons: string[];
    strength: number;
  };
}) {
  return (
    <Link href={`/lite/coin/${coin.symbol}`}>
      <a className="block">
        <LiteCard
          variant={
            coin.recommendation === "STRONG_BUY" || coin.recommendation === "BUY"
              ? "good"
              : coin.recommendation === "STRONG_SELL"
                ? "bad"
                : coin.recommendation === "SELL"
                  ? "caution"
                  : "default"
          }
          onClick={() => {}}
        >
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2 flex-wrap">
              <div>
                <div className="font-display text-xl font-bold tracking-wide text-foreground">
                  {coin.base}
                </div>
                <div className="font-mono text-sm text-muted-foreground">
                  ${formatPrice(coin.price)}{" "}
                  <span
                    className={cn(
                      "ml-1 text-[11px]",
                      coin.change24h >= 0 ? "text-neon-green" : "text-neon-red"
                    )}
                  >
                    {coin.change24h >= 0 ? "+" : ""}
                    {coin.change24h.toFixed(2)}%
                  </span>
                </div>
              </div>
              <LiteRecommendationBadge
                recommendation={coin.recommendation}
                size="sm"
              />
            </div>

            {coin.reasons.length > 0 && (
              <ul className="font-mono text-[11px] text-muted-foreground space-y-0.5">
                {coin.reasons.map((r, i) => (
                  <li key={i} className="leading-snug">• {r}</li>
                ))}
              </ul>
            )}

            <LiteRiskGauge level={coin.riskLevel} />
          </div>
        </LiteCard>
      </a>
    </Link>
  );
}
