/**
 * AIInsightTab — 코인별 AI Insight (LLM-powered).
 *
 * 기존 /ai 페이지의 핵심 로직을 임베드. 코인 컨텍스트가 prepopulated.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { AIChatBox, type Message } from "@/components/AIChatBox";
import type { CoinSignal } from "../hooks/useCoinSignal";

interface AIInsightTabProps {
  symbol: string;
  signal: CoinSignal | null;
}

export function AIInsightTab({ symbol, signal }: AIInsightTabProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "system",
      content: `You are an expert cryptocurrency trading analyst specializing in ${symbol}.
You analyze BBDX (RSI + Bollinger Bands + ADX) signals on multiple timeframes.
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
    const ctx = signal?.entry
      ? `${symbol} 현재 ${signal.entry.path} 경로 ${signal.finalConfidence.toFixed(0)}점, 진입가 ${signal.price.toFixed(2)}, 손절 ${signal.stopLoss.toFixed(2)}.`
      : `${symbol} 현재 BBDX 진입 조건 미충족.`;
    analyzeMutation.mutate({
      messages: newMessages
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: m.role, content: m.content })),
      context: `BBDX 트레이딩 봇 — ${ctx}`,
    });
  };

  return (
    <AIChatBox
      messages={messages}
      onSendMessage={handleSendMessage}
      isLoading={analyzeMutation.isPending}
      placeholder={`${symbol} 시장 분석이나 트레이딩 전략에 대해 질문하세요...`}
      height="600px"
      emptyStateMessage={`${symbol} AI 분석을 시작하세요`}
      suggestedPrompts={[
        `현재 ${symbol} 시장 상황을 분석해주세요`,
        `${symbol} 매수 시점을 판단해주세요`,
        `${symbol} 의 단기 ・ 장기 전망은?`,
        `BBDX 시그널 신뢰도가 어떻게 평가되나요?`,
      ]}
    />
  );
}
