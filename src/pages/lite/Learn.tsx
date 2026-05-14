/**
 * /lite/learn — 용어 사전 (학습 카드)
 *
 * trpc.lite.translate 로 라이브 BTC 데이터를 받아 raw → 자연어 라벨 매핑을
 * 보여줌. "RSI 28 → 과매도, 단기적으로 너무 많이 팔렸어요" 같은 형태.
 */

import { trpc } from "@/lib/trpc";
import { LiteCard } from "@/components/lite/LiteCard";
import { BookOpen, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const LESSONS: { kind: "rsi" | "adx" | "regime" | "phase" | "strength"; example: number | string; title: string; desc: string }[] = [
  {
    kind: "rsi",
    example: 28,
    title: "RSI — 코인이 얼마나 빠르게 움직였나",
    desc: "최근 14개 캔들에서 오른 폭과 내린 폭 비교. 0~100. 30 이하면 너무 많이 팔린 상태(과매도), 70 이상이면 너무 많이 산 상태(과매수).",
  },
  {
    kind: "adx",
    example: 18,
    title: "ADX — 흐름의 세기",
    desc: "지금 가격이 한 방향으로 강하게 가는지(추세), 갈팡질팡(횡보)인지 측정. 30 이상이면 강한 추세, 20 미만이면 횡보.",
  },
  {
    kind: "strength",
    example: 72,
    title: "신호 강도 — 진입 조건이 얼마나 맞았나",
    desc: "RSI / Bollinger Bands / ADX / 캔들 패턴 / 거래량 등 5개 점수를 합쳐 0~100 으로 환산. 60 이상이면 신뢰할 만한 신호.",
  },
  {
    kind: "regime",
    example: "accumulation",
    title: "Regime — 큰 자금이 어디로 가고 있나",
    desc: "거래소 자금 흐름 / 고래 송금 / 스테이블 수급 / 코인베이스 프리미엄 등 7개 온체인 지표 합산. 매집(들어오는) vs 분배(빠지는).",
  },
  {
    kind: "phase",
    example: "BULLISH",
    title: "추세 단계 — 4개 타임프레임 종합",
    desc: "1시간 / 4시간 / 일봉 / 주봉 추세를 가중치 (1:2:3:4) 로 합쳐 7단계로 분류. 강한 상승 → 상승 → 약화 → 횡보 → 하락 약화 → 하락 → 강한 하락.",
  },
];

export default function LiteLearn() {
  return (
    <div className="space-y-4">
      <LiteCard
        icon={<BookOpen className="h-5 w-5 text-neon-cyan" />}
        title="용어 사전"
        subtitle="실제 BTC 의 현재 값으로 보여드려요"
      >
        <p className="font-sans text-sm text-muted-foreground">
          어려워 보이는 단어들을 일상 언어로 풀어드려요. 각 카드의 *현재 라벨*은 지금
          BTC 의 실제 값을 기반으로 해요.
        </p>
      </LiteCard>

      <div className="space-y-3">
        {LESSONS.map((l) => (
          <LearnCard key={l.kind} {...l} />
        ))}
      </div>

      <LiteCard variant="muted">
        <p className="font-sans text-[11px] text-muted-foreground leading-relaxed">
          이 모든 단어는 결국 한 가지를 알려줘요: <strong>지금 사도 좋은 자리인가, 팔
          시점인가, 아니면 가만히 있어야 하는가</strong>. Lite 모드는 이 결론만 보여
          드리고 raw 수치는 숨겨요. 더 자세한 수치를 보고 싶으면 상단 [Pro 모드로]
          버튼을 누르세요.
        </p>
      </LiteCard>
    </div>
  );
}

function LearnCard({
  kind,
  example,
  title,
  desc,
}: {
  kind: "rsi" | "adx" | "regime" | "phase" | "strength";
  example: number | string;
  title: string;
  desc: string;
}) {
  const { data } = trpc.lite.translate.useQuery(
    { kind, value: example },
    { staleTime: 5 * 60_000 }
  );

  return (
    <LiteCard title={title} icon={<Sparkles className="h-5 w-5 text-neon-pink" />}>
      <p className="font-sans text-[12px] text-muted-foreground leading-relaxed mb-3">
        {desc}
      </p>
      <div className="border-t border-border/30 pt-2">
        <div className="font-sans text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
          예시 — {kind} = {String(example)}
        </div>
        {data ? (
          <>
            <div
              className={cn(
                "font-display text-base font-bold",
                data.result.color === "neon-green"
                  ? "text-neon-green"
                  : data.result.color === "neon-red"
                    ? "text-neon-red"
                    : data.result.color === "neon-yellow"
                      ? "text-neon-yellow"
                      : data.result.color === "neon-cyan"
                        ? "text-neon-cyan"
                        : "text-muted-foreground"
              )}
            >
              {data.result.label}
            </div>
            <p className="font-sans text-[12px] text-foreground mt-0.5">
              {data.result.oneLiner}
            </p>
          </>
        ) : (
          <span className="font-sans text-[11px] text-muted-foreground">로딩...</span>
        )}
      </div>
    </LiteCard>
  );
}
