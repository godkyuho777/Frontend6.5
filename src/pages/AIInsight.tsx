import { trpc } from "@/lib/trpc";
import { AIChatBox, type Message } from "@/components/AIChatBox";
import { HudPanel } from "@/components/HudPanel";
import { useState } from "react";

export default function AIInsight() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "system",
      content: `You are an expert cryptocurrency trading analyst specializing in technical analysis on 4-hour timeframes.
You analyze market conditions using RSI, Bollinger Bands (BB), and ADX indicators.
Entry conditions: RSI 30-35, price near BB lower band, ADX ≤ 30
Exit conditions: Price reaches BB middle, RSI ≥ 70, ADX ≥ 30, or +DI ≥ 30
Always respond in Korean when the user writes in Korean.
Provide specific, actionable insights with numbers and clear reasoning.`,
    },
  ]);

  const analyzeMutation = trpc.ai.analyze.useMutation({
    onSuccess: (data) => {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.response },
      ]);
    },
    onError: () => {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "분석 중 오류가 발생했습니다. 다시 시도해주세요.",
        },
      ]);
    },
  });

  const handleSendMessage = (content: string) => {
    const newMessages: Message[] = [
      ...messages,
      { role: "user", content },
    ];
    setMessages(newMessages);
    analyzeMutation.mutate({
      messages: newMessages.filter((m) => m.role !== "system").map((m) => ({
        role: m.role,
        content: m.content,
      })),
      context: "4시간봉 기반 트레이딩 봇. 매수 조건: RSI 30~35, BB 하단선, ADX ≤ 30. 목표가: BB 기준선, RSI 70+, ADX 30+, +DI 30+",
    });
  };

  return (
    <div className="space-y-4 h-[calc(100vh-6rem)]">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
          AI analyst
        </h1>
        <p className="font-mono text-xs text-muted-foreground mt-1">
          LLM-POWERED MARKET INTELLIGENCE
        </p>
      </div>

      <HudPanel
        title="Trading Assistant"
        subtitle="Ask about market conditions, signals, or strategies"
        variant="highlight"
        className="flex-1"
      >
        <AIChatBox
          messages={messages}
          onSendMessage={handleSendMessage}
          isLoading={analyzeMutation.isPending}
          placeholder="시장 분석이나 트레이딩 전략에 대해 질문하세요..."
          height="calc(100vh - 16rem)"
          emptyStateMessage="AI 트레이딩 어시스턴트에게 질문하세요"
          suggestedPrompts={[
            "현재 BTC 시장 상황을 분석해주세요",
            "RSI 30~35 구간에서 매수 전략의 장단점은?",
            "ADX가 낮을 때 볼린저밴드 전략의 효과는?",
            "4시간봉 기반 스윙 트레이딩 팁을 알려주세요",
          ]}
        />
      </HudPanel>
    </div>
  );
}
