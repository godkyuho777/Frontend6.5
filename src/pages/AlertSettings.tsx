import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { HudPanel } from "@/components/HudPanel";
import { SignInDialog } from "@/components/SignInDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Plus, Trash2, Bell, Save } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function AlertSettings() {
  const { user } = useAuth();

  const { data: alerts, isLoading, refetch } = trpc.alerts.get.useQuery(
    undefined,
    { enabled: !!user, staleTime: 5 * 60 * 1000 }
  );

  const upsertMutation = trpc.alerts.upsert.useMutation({
    onSuccess: () => {
      toast.success("Alert setting saved");
      refetch();
    },
    onError: () => toast.error("Failed to save alert setting"),
  });

  const deleteMutation = trpc.alerts.delete.useMutation({
    onSuccess: () => {
      toast.success("Alert setting deleted");
      refetch();
    },
    onError: () => toast.error("Failed to delete"),
  });

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Bell className="h-10 w-10 text-muted-foreground/30" />
        <p className="font-mono text-muted-foreground">Sign in to configure alerts</p>
        <SignInDialog>
          <Button className="bg-neon-pink/20 border border-neon-pink text-neon-pink hover:bg-neon-pink/30">
            CONNECT
          </Button>
        </SignInDialog>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-wider text-neon-pink glow-pink">
            ALERT CONFIG
          </h1>
          <p className="font-mono text-xs text-muted-foreground mt-1">
            CUSTOM THRESHOLDS // NOTIFICATION RULES
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            upsertMutation.mutate({
              rsiLow: 30,
              rsiHigh: 35,
              adxThreshold: 30,
              targetRsi: 70,
              targetAdx: 30,
              targetPlusDi: 30,
              useBbLower: true,
              useBbMiddleTarget: true,
              enabled: true,
            });
          }}
          disabled={upsertMutation.isPending}
          className="border-neon-green/30 text-neon-green hover:bg-neon-green/10 font-mono text-xs"
        >
          <Plus className="h-3 w-3 mr-1" />
          NEW RULE
        </Button>
      </div>

      {/* Default Strategy Info */}
      <HudPanel title="Strategy Parameters" subtitle="Default entry & exit conditions">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-display text-xs font-bold tracking-wider text-neon-green mb-3 uppercase">
              Entry Conditions (Long)
            </h4>
            <div className="space-y-2 font-mono text-xs">
              <div className="flex justify-between p-2 bg-neon-green/5 rounded-sm border border-neon-green/10">
                <span className="text-muted-foreground">RSI Range</span>
                <span className="text-neon-green">30 ~ 35</span>
              </div>
              <div className="flex justify-between p-2 bg-neon-green/5 rounded-sm border border-neon-green/10">
                <span className="text-muted-foreground">BB Position</span>
                <span className="text-neon-green">Near Lower Band</span>
              </div>
              <div className="flex justify-between p-2 bg-neon-green/5 rounded-sm border border-neon-green/10">
                <span className="text-muted-foreground">ADX Threshold</span>
                <span className="text-neon-green">&le; 30</span>
              </div>
            </div>
          </div>
          <div>
            <h4 className="font-display text-xs font-bold tracking-wider text-neon-cyan mb-3 uppercase">
              Exit Conditions (Target)
            </h4>
            <div className="space-y-2 font-mono text-xs">
              <div className="flex justify-between p-2 bg-neon-cyan/5 rounded-sm border border-neon-cyan/10">
                <span className="text-muted-foreground">BB Middle Line</span>
                <span className="text-neon-cyan">Price &ge; BB Mid</span>
              </div>
              <div className="flex justify-between p-2 bg-neon-cyan/5 rounded-sm border border-neon-cyan/10">
                <span className="text-muted-foreground">RSI Target</span>
                <span className="text-neon-cyan">&ge; 70</span>
              </div>
              <div className="flex justify-between p-2 bg-neon-cyan/5 rounded-sm border border-neon-cyan/10">
                <span className="text-muted-foreground">ADX / +DI</span>
                <span className="text-neon-cyan">&ge; 30</span>
              </div>
            </div>
          </div>
        </div>
      </HudPanel>

      {/* Custom Alert Rules */}
      <HudPanel title="Custom Rules" subtitle={`${alerts?.length ?? 0} rules configured`}>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-neon-pink" />
          </div>
        ) : !alerts?.length ? (
          <div className="text-center py-8">
            <Bell className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
            <p className="font-mono text-sm text-muted-foreground">No custom rules yet</p>
            <p className="font-mono text-xs text-muted-foreground/60 mt-1">
              Create a rule to customize signal detection thresholds
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <AlertRuleCard
                key={alert.id}
                alert={alert}
                onSave={(data) => upsertMutation.mutate({ id: alert.id, ...data })}
                onDelete={() => deleteMutation.mutate({ id: alert.id })}
                isSaving={upsertMutation.isPending}
                isDeleting={deleteMutation.isPending}
              />
            ))}
          </div>
        )}
      </HudPanel>
    </div>
  );
}

function AlertRuleCard({
  alert,
  onSave,
  onDelete,
  isSaving,
  isDeleting,
}: {
  alert: any;
  onSave: (data: any) => void;
  onDelete: () => void;
  isSaving: boolean;
  isDeleting: boolean;
}) {
  const [rsiLow, setRsiLow] = useState(String(alert.rsiLow ?? 30));
  const [rsiHigh, setRsiHigh] = useState(String(alert.rsiHigh ?? 35));
  const [adxThreshold, setAdxThreshold] = useState(String(alert.adxThreshold ?? 30));
  const [targetRsi, setTargetRsi] = useState(String(alert.targetRsi ?? 70));
  const [targetAdx, setTargetAdx] = useState(String(alert.targetAdx ?? 30));
  const [targetPlusDi, setTargetPlusDi] = useState(String(alert.targetPlusDi ?? 30));
  const [enabled, setEnabled] = useState(alert.enabled ?? true);
  const [symbol, setSymbol] = useState(alert.symbol ?? "");

  return (
    <div className="p-4 rounded-sm border border-border/30 bg-card/50 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Switch checked={enabled} onCheckedChange={setEnabled} />
          <Input
            placeholder="All coins (leave empty)"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            className="w-40 h-7 font-mono text-xs bg-background/50 border-border/30"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              onSave({
                symbol: symbol || undefined,
                rsiLow: parseFloat(rsiLow),
                rsiHigh: parseFloat(rsiHigh),
                adxThreshold: parseFloat(adxThreshold),
                targetRsi: parseFloat(targetRsi),
                targetAdx: parseFloat(targetAdx),
                targetPlusDi: parseFloat(targetPlusDi),
                enabled,
              })
            }
            disabled={isSaving}
            className="border-neon-cyan/30 text-neon-cyan hover:bg-neon-cyan/10 font-mono text-[10px]"
          >
            <Save className="h-3 w-3 mr-1" />
            SAVE
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onDelete}
            disabled={isDeleting}
            className="border-neon-red/30 text-neon-red hover:bg-neon-red/10 font-mono text-[10px]"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div>
          <Label className="font-mono text-[10px] text-muted-foreground">RSI Low</Label>
          <Input
            type="number"
            value={rsiLow}
            onChange={(e) => setRsiLow(e.target.value)}
            className="h-7 font-mono text-xs bg-background/50 border-border/30"
          />
        </div>
        <div>
          <Label className="font-mono text-[10px] text-muted-foreground">RSI High</Label>
          <Input
            type="number"
            value={rsiHigh}
            onChange={(e) => setRsiHigh(e.target.value)}
            className="h-7 font-mono text-xs bg-background/50 border-border/30"
          />
        </div>
        <div>
          <Label className="font-mono text-[10px] text-muted-foreground">ADX Threshold</Label>
          <Input
            type="number"
            value={adxThreshold}
            onChange={(e) => setAdxThreshold(e.target.value)}
            className="h-7 font-mono text-xs bg-background/50 border-border/30"
          />
        </div>
        <div>
          <Label className="font-mono text-[10px] text-muted-foreground">Target RSI</Label>
          <Input
            type="number"
            value={targetRsi}
            onChange={(e) => setTargetRsi(e.target.value)}
            className="h-7 font-mono text-xs bg-background/50 border-border/30"
          />
        </div>
        <div>
          <Label className="font-mono text-[10px] text-muted-foreground">Target ADX</Label>
          <Input
            type="number"
            value={targetAdx}
            onChange={(e) => setTargetAdx(e.target.value)}
            className="h-7 font-mono text-xs bg-background/50 border-border/30"
          />
        </div>
        <div>
          <Label className="font-mono text-[10px] text-muted-foreground">Target +DI</Label>
          <Input
            type="number"
            value={targetPlusDi}
            onChange={(e) => setTargetPlusDi(e.target.value)}
            className="h-7 font-mono text-xs bg-background/50 border-border/30"
          />
        </div>
      </div>
    </div>
  );
}
