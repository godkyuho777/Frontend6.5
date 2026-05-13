/**
 * CoinHistoryTab — 코인 상세 페이지의 "히스토리" 탭.
 *
 * 기존 TradeHistoryTab (백테스트 trade 배열 + TradeTable) 그대로 재사용 +
 * AIInsightTab (LLM-powered Q&A) + LiteModeTab (한국어 라벨 시그널) 통합.
 *
 * 명세: TRACKER_TAB_STANDARD §2.5 (히스토리 = 과거 시그널/매매 기록).
 */

import { useState } from "react";
import { TradeHistoryTab } from "../TradeHistoryTab";
import { AIInsightTab } from "../AIInsightTab";
import { LiteModeTab } from "../LiteModeTab";
import { useCoinSignal } from "../../hooks/useCoinSignal";
import { cn } from "@/lib/utils";

interface CoinHistoryTabProps {
  symbol: string;
}

type SubTab = "trades" | "lite" | "ai";

const SUB_TABS: { id: SubTab; label: string; color: string }[] = [
  { id: "trades", label: "거래 기록", color: "text-neon-green" },
  { id: "lite", label: "한국어 요약", color: "text-neon-pink" },
  { id: "ai", label: "AI 분석", color: "text-neon-cyan" },
];

export function CoinHistoryTab({ symbol }: CoinHistoryTabProps) {
  const [sub, setSub] = useState<SubTab>("trades");
  const { signal } = useCoinSignal(symbol, "4h");

  return (
    <div className="space-y-3">
      {/* Sub-tabs strip */}
      <div className="flex items-center gap-1 border-b border-border/30 overflow-x-auto">
        {SUB_TABS.map((t) => {
          const active = sub === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setSub(t.id)}
              className={cn(
                "font-mono text-[11px] uppercase tracking-wider px-3 py-2",
                "border-b-2 transition-all whitespace-nowrap",
                active
                  ? `${t.color} border-current`
                  : "text-muted-foreground border-transparent hover:text-foreground"
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Sub-tab content */}
      <div className="min-h-[300px]">
        {sub === "trades" && <TradeHistoryTab symbol={symbol} />}
        {sub === "lite" && <LiteModeTab symbol={symbol} tf="4h" />}
        {sub === "ai" && <AIInsightTab symbol={symbol} signal={signal} />}
      </div>
    </div>
  );
}
