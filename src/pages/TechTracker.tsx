import { HudPanel, StatCard } from "@/components/HudPanel";
import { RefreshIconButton } from "@/components/RefreshIconButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  RefreshCw, 
  Zap,
  Info
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { useMarketScan } from "@/hooks/useMarketData";
import { cn } from "@/lib/utils";

export default function TechTracker() {
  const [, setLocation] = useLocation();
  const [interval, setInterval] = useState<"4h" | "1d">("4h");
  const { data: scanData, isLoading, refetch, isFetching } = useMarketScan(1, 20, interval);

  const fibSignals = scanData?.coins.filter(c => c.fibSignal) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
            테크니컬 트래커 (Pro)
          </h1>
          <p className="font-mono text-xs text-muted-foreground mt-1">
            피보나치 골든존과 추세선 컨플루언스로 고확률 진입 구간을 찾습니다
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RefreshIconButton
            onClick={() => refetch()}
            label="테크니컬 트래커 새로고침"
            isLoading={isFetching}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="피보나치 시그널" value={fibSignals.length} variant="positive" />
        <StatCard label="추세선 터치" value={scanData?.coins.filter(c => c.indicators.trendlines && c.indicators.trendlines.length > 0).length || 0} />
        <StatCard label="스캐너 상태" value="작동 중" unit="실시간" />
      </div>

      <HudPanel
        title="피보나치 · 추세선 스캐너"
        subtitle="황금 비율 구간에서 고확률 진입 지점을 찾아냅니다"
        headerRight={
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-neon-pink/10 text-neon-pink border-neon-pink/20">Pro 전용</Badge>
          </div>
        }
      >
        {isLoading ? (
          <div className="py-20 text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto text-neon-cyan opacity-50" />
            <p className="font-sans text-sm text-muted-foreground mt-4">시장 구조를 분석하는 중...</p>
          </div>
        ) : fibSignals.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-2">
            {fibSignals.map(coin => (
              <div key={coin.symbol} className="bg-card/50 border border-border/20 rounded-sm p-4 hover:border-neon-cyan/50 transition-all group cursor-pointer">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-display text-lg font-bold text-foreground">{coin.symbol.replace("USDT", "")}</h3>
                    <p className="font-sans text-xs text-muted-foreground">${coin.price.toFixed(4)}</p>
                  </div>
                  <Badge className={cn(
                    "font-sans text-[10px]",
                    coin.fibSignal?.type === "buy" ? "bg-neon-green/20 text-neon-green border-neon-green/30" : "bg-neon-pink/20 text-neon-pink border-neon-pink/30"
                  )}>
                    {coin.fibSignal?.type === "buy" ? "골든존 매수" : "골든존 매도"}
                  </Badge>
                </div>
                
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-[10px] font-sans">
                    <span className="text-muted-foreground">피보 레벨</span>
                    <span className="text-foreground">{coin.fibSignal?.level}</span>
                  </div>
                  <div className="flex justify-between text-[10px] font-sans">
                    <span className="text-muted-foreground">존 가격</span>
                    <span className="text-foreground">${coin.fibSignal?.price.toFixed(4)}</span>
                  </div>
                  <div className="flex justify-between text-[10px] font-sans">
                    <span className="text-muted-foreground">RSI (14)</span>
                    <span className={cn(coin.indicators.rsi <= 35 ? "text-neon-green" : "text-foreground")}>{coin.indicators.rsi.toFixed(1)}</span>
                  </div>
                </div>

                <Button
                  onClick={() =>
                    setLocation(
                      `/coin/${coin.symbol}?tracker=fibonacci&tab=chart`
                    )
                  }
                  className="w-full bg-neon-cyan/10 hover:bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30 font-sans text-xs h-8"
                >
                  차트 보기 <Zap className="h-3 w-3 ml-2" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-20 text-center">
            <Info className="h-8 w-8 mx-auto text-muted-foreground opacity-50" />
            <p className="font-sans text-sm text-muted-foreground mt-4">현재 감지된 피보나치 시그널이 없습니다</p>
          </div>
        )}
      </HudPanel>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <HudPanel title="전략 설명" subtitle="테크니컬 트래커의 작동 방식">
          <div className="prose prose-invert prose-sm max-w-none font-sans text-xs text-muted-foreground space-y-4">
            <p>
              <strong className="text-neon-cyan">피보나치 골든존:</strong> 최근 100개 캔들의 고점·저점을 기준으로 0.382, 0.618 레벨을 추적합니다. 가격이 이 레벨의 ±0.5% 범위에 진입하면 시그널이 발생합니다.
            </p>
            <p>
              <strong className="text-neon-pink">추세선 컨플루언스:</strong> 최근 피벗을 기반으로 지지선과 저항선을 자동으로 그립니다. 피보나치 존 안에서 이 선에 닿는 지점은 반전 확률이 높은 구간을 의미합니다.
            </p>
            <p>
              <strong className="text-neon-green">리스크 관리:</strong> 이러한 기술적 지표와 함께 RSI 확인(매수는 과매도, 매도는 과매수)을 반드시 확인하세요.
            </p>
          </div>
        </HudPanel>
        
        <HudPanel title="시스템 상태" subtitle="백엔드 분석 엔진">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-sans text-xs text-muted-foreground">데이터 소스</span>
              <span className="font-sans text-xs text-neon-cyan">Bybit V5 Spot API</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-sans text-xs text-muted-foreground">분석 주기</span>
              <span className="font-sans text-xs text-neon-cyan">실시간 / WebSocket</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-sans text-xs text-muted-foreground">지표 지연 시간</span>
              <span className="font-sans text-xs text-neon-green">&lt; 150ms</span>
            </div>
            <div className="pt-4">
              <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-full w-3/4 bg-neon-cyan animate-pulse" />
              </div>
              <p className="font-sans text-[9px] text-muted-foreground mt-2 text-center tracking-tighter">
                피보나치 · 추세선 알고리즘으로 100개 이상 종목 분석 중
              </p>
            </div>
          </div>
        </HudPanel>
      </div>
    </div>
  );
}
