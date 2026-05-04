import { HudPanel, StatCard } from "@/components/HudPanel";
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
import { useMarketScan } from "@/hooks/useMarketData";
import { cn } from "@/lib/utils";

export default function TechTracker() {
  const [interval, setInterval] = useState<"4h" | "1d">("4h");
  const { data: scanData, isLoading, refetch, isFetching } = useMarketScan(1, 20, interval);

  const fibSignals = scanData?.coins.filter(c => c.fibSignal) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-wider text-neon-cyan glow-cyan flex items-center gap-3">
            <BarChart3 className="h-6 w-6" />
            TECH TRACKER (PRO)
          </h1>
          <p className="font-mono text-xs text-muted-foreground mt-1">
            FIBONACCI GOLDEN ZONE // TRENDLINE CONFLUENCE // PRO ANALYSIS
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="border-neon-cyan/30 text-neon-cyan hover:bg-neon-cyan/10 font-mono text-xs"
          >
            {isFetching ? <RefreshCw className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
            REFRESH
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Fibonacci Signals" value={fibSignals.length} variant="positive" />
        <StatCard label="Trendline Touches" value={scanData?.coins.filter(c => c.indicators.trendlines && c.indicators.trendlines.length > 0).length || 0} />
        <StatCard label="Scanner Status" value="ACTIVE" unit="REAL-TIME" />
      </div>

      <HudPanel 
        title="Fibonacci & Trendline Scanner" 
        subtitle="Identifying high-probability entries at Golden Ratio zones"
        headerRight={
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-neon-pink/10 text-neon-pink border-neon-pink/20">PRO FEATURE</Badge>
          </div>
        }
      >
        {isLoading ? (
          <div className="py-20 text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto text-neon-cyan opacity-50" />
            <p className="font-mono text-sm text-muted-foreground mt-4">Analyzing market structure...</p>
          </div>
        ) : fibSignals.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-2">
            {fibSignals.map(coin => (
              <div key={coin.symbol} className="bg-card/50 border border-border/20 rounded-sm p-4 hover:border-neon-cyan/50 transition-all group cursor-pointer">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-display text-lg font-bold text-foreground">{coin.symbol.replace("USDT", "")}</h3>
                    <p className="font-mono text-xs text-muted-foreground">${coin.price.toFixed(4)}</p>
                  </div>
                  <Badge className={cn(
                    "font-mono text-[10px]",
                    coin.fibSignal?.type === "buy" ? "bg-neon-green/20 text-neon-green border-neon-green/30" : "bg-neon-pink/20 text-neon-pink border-neon-pink/30"
                  )}>
                    {coin.fibSignal?.type === "buy" ? "GOLDEN BUY" : "GOLDEN SELL"}
                  </Badge>
                </div>
                
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-muted-foreground">Fib Level</span>
                    <span className="text-foreground">{coin.fibSignal?.level}</span>
                  </div>
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-muted-foreground">Zone Price</span>
                    <span className="text-foreground">${coin.fibSignal?.price.toFixed(4)}</span>
                  </div>
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-muted-foreground">RSI (14)</span>
                    <span className={cn(coin.indicators.rsi <= 35 ? "text-neon-green" : "text-foreground")}>{coin.indicators.rsi.toFixed(1)}</span>
                  </div>
                </div>

                <Button className="w-full bg-neon-cyan/10 hover:bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30 font-mono text-xs h-8">
                  VIEW CHART <Zap className="h-3 w-3 ml-2" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-20 text-center">
            <Info className="h-8 w-8 mx-auto text-muted-foreground opacity-50" />
            <p className="font-mono text-sm text-muted-foreground mt-4">No Fibonacci signals detected at this moment.</p>
          </div>
        )}
      </HudPanel>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <HudPanel title="Strategy Explanation" subtitle="How Tech Tracker works">
          <div className="prose prose-invert prose-sm max-w-none font-mono text-xs text-muted-foreground space-y-4">
            <p>
              <strong className="text-neon-cyan">Fibonacci Golden Zone:</strong> We track the 0.382 and 0.618 levels from the recent 100-candle high/low. When price enters a ±0.5% range of these levels, it triggers a signal.
            </p>
            <p>
              <strong className="text-neon-pink">Trendline Confluence:</strong> The system automatically draws support and resistance lines based on recent pivots. Touches at these lines while in a Fibonacci zone indicate high-probability reversal points.
            </p>
            <p>
              <strong className="text-neon-green">Risk Management:</strong> Always look for RSI confirmation (Oversold for Buy, Overbought for Sell) alongside these technical markers.
            </p>
          </div>
        </HudPanel>
        
        <HudPanel title="System Status" subtitle="Backend analysis engine">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-muted-foreground">Data Source</span>
              <span className="font-mono text-xs text-neon-cyan">Bybit V5 Spot API</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-muted-foreground">Analysis Frequency</span>
              <span className="font-mono text-xs text-neon-cyan">Real-time / WebSocket</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-muted-foreground">Indicator Latency</span>
              <span className="font-mono text-xs text-neon-green">&lt; 150ms</span>
            </div>
            <div className="pt-4">
              <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-full w-3/4 bg-neon-cyan animate-pulse" />
              </div>
              <p className="font-mono text-[9px] text-muted-foreground mt-2 text-center uppercase tracking-tighter">
                Processing 100+ assets with Fibonacci & Trendline algorithms
              </p>
            </div>
          </div>
        </HudPanel>
      </div>
    </div>
  );
}
