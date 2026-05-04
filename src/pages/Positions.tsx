import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { HudPanel, StatCard } from "@/components/HudPanel";
import { SignInDialog } from "@/components/SignInDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, X, TrendingUp, TrendingDown } from "lucide-react";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function Positions() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<"open" | "closed" | undefined>(undefined);
  const [openDialog, setOpenDialog] = useState(false);

  const { data: positions, isLoading, refetch } = trpc.positions.list.useQuery(
    { status: filter },
    { enabled: !!user, refetchInterval: 30000 }
  );

  const createMutation = trpc.positions.create.useMutation({
    onSuccess: () => {
      toast.success("Position created");
      setOpenDialog(false);
      refetch();
    },
    onError: () => toast.error("Failed to create position"),
  });

  const closeMutation = trpc.positions.close.useMutation({
    onSuccess: () => {
      toast.success("Position closed");
      refetch();
    },
    onError: () => toast.error("Failed to close position"),
  });

  const openPositions = useMemo(
    () => positions?.filter((p) => p.status === "open") ?? [],
    [positions]
  );

  const totalPnl = useMemo(
    () => openPositions.reduce((sum, p) => sum + (p.pnlAmount ?? 0), 0),
    [openPositions]
  );

  const totalPnlPercent = useMemo(() => {
    if (openPositions.length === 0) return 0;
    return openPositions.reduce((sum, p) => sum + (p.pnlPercent ?? 0), 0) / openPositions.length;
  }, [openPositions]);

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="font-mono text-muted-foreground">Sign in to track positions</p>
        <SignInDialog>
          <Button className="bg-neon-pink/20 border border-neon-pink text-neon-pink hover:bg-neon-pink/30">
            CONNECT
          </Button>
        </SignInDialog>
      </div>
    );
  }

  const formatPrice = (p: number | null) => {
    if (p === null) return "—";
    return p < 1 ? `$${p.toFixed(6)}` : p < 100 ? `$${p.toFixed(4)}` : `$${p.toFixed(2)}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-wider text-neon-pink glow-pink">
            POSITIONS
          </h1>
          <p className="font-mono text-xs text-muted-foreground mt-1">
            PORTFOLIO TRACKING // REAL-TIME PNL
          </p>
        </div>
        <Dialog open={openDialog} onOpenChange={setOpenDialog}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="border-neon-green/30 text-neon-green hover:bg-neon-green/10 font-mono text-xs"
            >
              <Plus className="h-3 w-3 mr-1" />
              NEW POSITION
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border/50">
            <DialogHeader>
              <DialogTitle className="font-display tracking-wider text-neon-cyan">
                Open Position
              </DialogTitle>
            </DialogHeader>
            <NewPositionForm
              onSubmit={(data) => createMutation.mutate(data)}
              isPending={createMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Open Positions" value={openPositions.length} />
        <StatCard
          label="Total PnL"
          value={`$${totalPnl.toFixed(2)}`}
          variant={totalPnl >= 0 ? "positive" : "negative"}
        />
        <StatCard
          label="Avg PnL %"
          value={`${totalPnlPercent.toFixed(2)}%`}
          variant={totalPnlPercent >= 0 ? "positive" : "negative"}
        />
        <StatCard label="Total" value={positions?.length ?? 0} unit="positions" />
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {[
          { label: "All", value: undefined },
          { label: "Open", value: "open" as const },
          { label: "Closed", value: "closed" as const },
        ].map((f) => (
          <Button
            key={f.label}
            variant="outline"
            size="sm"
            onClick={() => setFilter(f.value)}
            className={cn(
              "font-mono text-xs",
              filter === f.value
                ? "border-neon-pink text-neon-pink bg-neon-pink/10"
                : "border-border/30 text-muted-foreground hover:text-foreground"
            )}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {/* Positions List */}
      <HudPanel title="Position List">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-neon-pink" />
          </div>
        ) : !positions?.length ? (
          <div className="text-center py-8">
            <p className="font-mono text-sm text-muted-foreground">No positions found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {positions.map((pos) => (
              <div
                key={pos.id}
                className={cn(
                  "flex items-center justify-between p-3 rounded-sm border",
                  pos.status === "open"
                    ? "border-neon-cyan/20 bg-neon-cyan/5"
                    : "border-border/20 bg-card/50"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    pos.status === "open" ? "bg-neon-green signal-pulse" : "bg-muted-foreground/30"
                  )} />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-display text-sm font-bold text-foreground">
                        {pos.symbol.replace("USDT", "")}
                      </span>
                      <Badge className="font-mono text-[10px] bg-neon-cyan/20 text-neon-cyan border-neon-cyan/30">
                        {pos.leverage}x
                      </Badge>
                    </div>
                    <div className="font-mono text-[10px] text-muted-foreground mt-0.5">
                      Entry: {formatPrice(pos.entryPrice)} | Target: {formatPrice(pos.targetPrice)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="font-mono text-xs text-muted-foreground">Current</div>
                    <div className="font-mono text-sm text-foreground">{formatPrice(pos.currentPrice)}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-xs text-muted-foreground">PnL</div>
                    <div className={cn(
                      "font-mono text-sm font-bold flex items-center gap-1",
                      (pos.pnlPercent ?? 0) >= 0 ? "text-neon-green" : "text-neon-red"
                    )}>
                      {(pos.pnlPercent ?? 0) >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {(pos.pnlPercent ?? 0).toFixed(2)}%
                    </div>
                  </div>
                  {pos.status === "open" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (pos.currentPrice) {
                          closeMutation.mutate({ id: pos.id, closePrice: pos.currentPrice });
                        }
                      }}
                      disabled={closeMutation.isPending}
                      className="border-neon-red/30 text-neon-red hover:bg-neon-red/10 font-mono text-[10px]"
                    >
                      <X className="h-3 w-3 mr-0.5" />
                      CLOSE
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </HudPanel>
    </div>
  );
}

function NewPositionForm({
  onSubmit,
  isPending,
}: {
  onSubmit: (data: {
    symbol: string;
    entryPrice: number;
    targetPrice?: number;
    quantity: number;
    leverage?: number;
  }) => void;
  isPending: boolean;
}) {
  const [symbol, setSymbol] = useState("");
  const [entryPrice, setEntryPrice] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [leverage, setLeverage] = useState("1");

  return (
    <div className="space-y-4">
      <div>
        <Label className="font-mono text-xs text-muted-foreground">Symbol</Label>
        <Input
          placeholder="BTCUSDT"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          className="font-mono bg-background/50 border-border/30"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="font-mono text-xs text-muted-foreground">Entry Price</Label>
          <Input
            type="number"
            step="any"
            placeholder="0.00"
            value={entryPrice}
            onChange={(e) => setEntryPrice(e.target.value)}
            className="font-mono bg-background/50 border-border/30"
          />
        </div>
        <div>
          <Label className="font-mono text-xs text-muted-foreground">Target Price</Label>
          <Input
            type="number"
            step="any"
            placeholder="0.00"
            value={targetPrice}
            onChange={(e) => setTargetPrice(e.target.value)}
            className="font-mono bg-background/50 border-border/30"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="font-mono text-xs text-muted-foreground">Quantity</Label>
          <Input
            type="number"
            step="any"
            placeholder="0"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="font-mono bg-background/50 border-border/30"
          />
        </div>
        <div>
          <Label className="font-mono text-xs text-muted-foreground">Leverage</Label>
          <Input
            type="number"
            min="1"
            max="125"
            value={leverage}
            onChange={(e) => setLeverage(e.target.value)}
            className="font-mono bg-background/50 border-border/30"
          />
        </div>
      </div>
      <Button
        onClick={() => {
          if (!symbol || !entryPrice || !quantity) {
            toast.error("Fill in required fields");
            return;
          }
          onSubmit({
            symbol,
            entryPrice: parseFloat(entryPrice),
            targetPrice: targetPrice ? parseFloat(targetPrice) : undefined,
            quantity: parseFloat(quantity),
            leverage: parseInt(leverage) || 1,
          });
        }}
        disabled={isPending}
        className="w-full bg-neon-green/20 border border-neon-green text-neon-green hover:bg-neon-green/30 font-mono"
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <TrendingUp className="h-4 w-4 mr-2" />}
        OPEN LONG POSITION
      </Button>
    </div>
  );
}
