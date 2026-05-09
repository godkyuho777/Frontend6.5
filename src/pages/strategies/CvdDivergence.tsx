import { HudPanel } from "@/components/HudPanel";
import { CharterFooter } from "@/components/strategies/CharterFooter";
import { MultiplierChip } from "@/components/strategies/MultiplierChip";
import { StatusBadge } from "@/components/strategies/StatusBadge";
import {
  StrategyHeader,
  type StrategyTf,
} from "@/components/strategies/StrategyHeader";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Construction, Loader2 } from "lucide-react";
import { useState } from "react";

export default function CvdDivergence() {
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [tf, setTf] = useState<StrategyTf>("4h");

  const query = trpc.modifiers.cvdDivergence.useQuery(
    { symbol, tf },
    {
      enabled: !!symbol,
      staleTime: 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    }
  );

  const result = query.data;

  return (
    <div className="space-y-4 max-w-5xl">
      <StrategyHeader
        title="CVD Divergence"
        subtitle="Cumulative Volume Delta divergence — 4차원 거래량/유동성"
        dimension={4}
        symbol={symbol}
        tf={tf}
        onSymbolChange={setSymbol}
        onTfChange={setTf}
        isBeta
      />

      <HudPanel variant="danger" className="border-orange-400/40">
        <div className="flex items-start gap-3">
          <Construction className="h-5 w-5 text-orange-300 mt-0.5 shrink-0" />
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-display text-sm font-bold uppercase tracking-wider text-orange-300">
                BETA SCAFFOLD
              </span>
              <Badge
                variant="outline"
                className="font-mono text-[10px] border-orange-400/60 text-orange-300 bg-orange-500/10"
              >
                WebSocket integration pending
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground font-mono">
              현재 모든 코인에 대해 multiplier 1.0 (영향 없음) 반환. 후속 작업으로
              WebSocket publicTrade 누적 → divergence 탐지 활성화 예정.
            </p>
          </div>
        </div>
      </HudPanel>

      {query.isLoading && (
        <HudPanel>
          <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="font-mono text-xs">Loading CVD modifier…</span>
          </div>
        </HudPanel>
      )}

      {query.isError && (
        <HudPanel variant="danger">
          <p className="text-xs text-neon-red font-mono">
            Error: {query.error.message}
          </p>
        </HudPanel>
      )}

      {result && (
        <HudPanel
          title="CVD Modifier"
          subtitle={`${symbol} · ${tf}`}
          headerRight={
            <StatusBadge status={result.status} errorDetail={result.errorDetail} />
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                Multiplier
              </div>
              <MultiplierChip multiplier={result.multiplier} size="lg" />
            </div>
            <div className="space-y-2">
              <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                Type
              </div>
              <span className="inline-flex items-center px-3 py-2 border rounded-sm font-display text-sm font-bold tracking-wider text-muted-foreground bg-muted/20 border-muted-foreground/30">
                {result.type.toUpperCase()}
              </span>
            </div>
            <div className="space-y-2">
              <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                Beta Stub
              </div>
              <Badge
                variant="outline"
                className="font-mono text-[10px] border-orange-400/60 text-orange-300 bg-orange-500/10"
              >
                {result.betaStub ? "TRUE — 영향 없음" : "FALSE"}
              </Badge>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-border/30">
            <p className="text-xs text-muted-foreground font-mono">
              <span className="text-neon-cyan">REASON:</span> {result.reason}
            </p>
          </div>
        </HudPanel>
      )}

      <HudPanel
        title="Future Implementation"
        subtitle="WebSocket integration roadmap"
      >
        <ol className="space-y-2 text-xs text-muted-foreground font-mono list-decimal list-inside">
          <li>
            <span className="text-neon-cyan">Bybit V5 publicTrade WebSocket</span>{" "}
            stream 구독 — `wss://stream.bybit.com/v5/public/spot`.
          </li>
          <li>
            trade tick 의{" "}
            <span className="text-neon-cyan">side (Buy/Sell)</span> 기반 누적
            delta 계산 — Spot 이 진짜 매수자/매도자에 가까움 (명세서 §3.4).
          </li>
          <li>
            1h / 4h / session 윈도우 별 CVD 시계열 산출 → 가격 swing vs CVD swing
            비교.
          </li>
          <li>
            Divergence 분류:{" "}
            <span className="text-neon-green">bullish</span> /{" "}
            <span className="text-neon-red">bearish</span> /{" "}
            <span className="text-muted-foreground">none</span>.
          </li>
          <li>Spot vs Perp CVD 분리 — 매수 강도 차이로 가짜 추세 필터링.</li>
        </ol>
      </HudPanel>

      <CharterFooter
        isBeta
        extraNote="현재 multiplier 1.0 (영향 없음) — WebSocket 구현 후 활성화. RSI/MACD 와 다른 4차원 (volume/liquidity)이라 헌장 규칙 1 통과."
      />
    </div>
  );
}
