/**
 * Calibration Admin — BBDX v6.6 weight/threshold calibration 운영 페이지.
 *
 * - trpc.calibrationAdmin.history 로 가중치 변경 이력 조회
 * - trpc.calibrationAdmin.triggerManualWeights / triggerManualThreshold 로 즉시 재calibration
 *
 * 관리자 전용 (사이드바 메뉴에 노출되지만 인증은 별도 가드 X — 현 시스템 정책).
 * 헌장 R2 — 검증된 가중치/임계로의 교체를 사용자가 명시적으로 트리거.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { HudPanel } from "@/components/HudPanel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Loader2, RefreshCw, Settings2, History } from "lucide-react";

type Path = "NUM" | "PTN" | "BB";
type Side = "long" | "short";

const SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "AAVEUSDT"];
const TFS = ["1h", "4h", "1d"] as const;
const PATHS: Path[] = ["NUM", "PTN", "BB"];

export default function CalibrationAdmin() {
  const [symbol, setSymbol] = useState<string>(SYMBOLS[0]);
  const [tf, setTf] = useState<string>("4h");
  const [path, setPath] = useState<Path>("NUM");
  const [side, setSide] = useState<Side>("long");

  const historyQuery = trpc.calibrationAdmin.history.useQuery(
    { symbol, tf, path, side, limit: 20 },
    { staleTime: 60_000, retry: false }
  );

  const triggerWeightsMutation =
    trpc.calibrationAdmin.triggerManualWeights.useMutation({
      onSuccess: () => historyQuery.refetch(),
    });
  const triggerThresholdMutation =
    trpc.calibrationAdmin.triggerManualThreshold.useMutation({
      onSuccess: () => historyQuery.refetch(),
    });

  const handleTriggerWeights = () => {
    triggerWeightsMutation.mutate({ symbol, tf, path, side });
  };
  const handleTriggerThreshold = () => {
    triggerThresholdMutation.mutate({ symbol, tf, side });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold tracking-wider text-neon-pink glow-pink flex items-center gap-2">
          <Settings2 className="h-6 w-6" />
          CALIBRATION ADMIN
        </h1>
        <p className="font-mono text-xs text-muted-foreground mt-1">
          BBDX v6.6 WEIGHT / THRESHOLD CALIBRATION OPS
        </p>
      </div>

      {/* Selector */}
      <HudPanel title="Target" subtitle="(symbol, tf, path, side) 조합 선택">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider block mb-1.5">
              Symbol
            </label>
            <div className="flex flex-wrap gap-1">
              {SYMBOLS.map((s) => (
                <button
                  key={s}
                  onClick={() => setSymbol(s)}
                  className={cn(
                    "font-mono text-[10px] px-2 py-1 rounded-sm border transition-all",
                    symbol === s
                      ? "bg-neon-cyan/15 text-neon-cyan border-neon-cyan/40"
                      : "text-muted-foreground border-border/30 hover:bg-muted/30"
                  )}
                >
                  {s.replace("USDT", "")}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider block mb-1.5">
              Timeframe
            </label>
            <div className="flex gap-1">
              {TFS.map((t) => (
                <button
                  key={t}
                  onClick={() => setTf(t)}
                  className={cn(
                    "font-mono text-[10px] px-2 py-1 rounded-sm border transition-all",
                    tf === t
                      ? "bg-neon-pink/15 text-neon-pink border-neon-pink/40"
                      : "text-muted-foreground border-border/30 hover:bg-muted/30"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider block mb-1.5">
              Path
            </label>
            <div className="flex gap-1">
              {PATHS.map((p) => (
                <button
                  key={p}
                  onClick={() => setPath(p)}
                  className={cn(
                    "font-mono text-[10px] px-2 py-1 rounded-sm border transition-all",
                    path === p
                      ? "bg-neon-yellow/15 text-neon-yellow border-neon-yellow/40"
                      : "text-muted-foreground border-border/30 hover:bg-muted/30"
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider block mb-1.5">
              Side
            </label>
            <div className="flex gap-1">
              {(["long", "short"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSide(s)}
                  className={cn(
                    "font-mono text-[10px] px-2 py-1 rounded-sm border transition-all uppercase",
                    side === s
                      ? s === "long"
                        ? "bg-neon-green/15 text-neon-green border-neon-green/40"
                        : "bg-neon-red/15 text-neon-red border-neon-red/40"
                      : "text-muted-foreground border-border/30 hover:bg-muted/30"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </HudPanel>

      {/* Manual triggers */}
      <HudPanel
        title="Manual Re-calibration"
        subtitle="대상 (symbol, tf, path, side) 의 가중치/임계 즉시 재calibration"
      >
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={handleTriggerWeights}
            disabled={triggerWeightsMutation.isPending}
            className="bg-neon-cyan/15 text-neon-cyan border border-neon-cyan/40 hover:bg-neon-cyan/25 font-mono text-xs"
          >
            {triggerWeightsMutation.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
            ) : (
              <RefreshCw className="h-3 w-3 mr-1.5" />
            )}
            RE-CALIBRATE WEIGHTS
          </Button>
          <Button
            onClick={handleTriggerThreshold}
            disabled={triggerThresholdMutation.isPending}
            className="bg-neon-pink/15 text-neon-pink border border-neon-pink/40 hover:bg-neon-pink/25 font-mono text-xs"
          >
            {triggerThresholdMutation.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
            ) : (
              <RefreshCw className="h-3 w-3 mr-1.5" />
            )}
            RE-CALIBRATE THRESHOLD
          </Button>
        </div>
        {/* Result feedback */}
        {triggerWeightsMutation.data && (
          <div className="mt-3 font-mono text-[11px] text-neon-green border border-neon-green/30 bg-neon-green/5 rounded-sm px-2 py-1.5">
            ✓ Weights — status:{" "}
            {JSON.stringify(triggerWeightsMutation.data)}
          </div>
        )}
        {triggerThresholdMutation.data && (
          <div className="mt-3 font-mono text-[11px] text-neon-pink border border-neon-pink/30 bg-neon-pink/5 rounded-sm px-2 py-1.5">
            ✓ Threshold — status:{" "}
            {JSON.stringify(triggerThresholdMutation.data)}
          </div>
        )}
        {triggerWeightsMutation.error && (
          <div className="mt-3 font-mono text-[11px] text-neon-red border border-neon-red/30 bg-neon-red/5 rounded-sm px-2 py-1.5">
            ✗ Weights error: {triggerWeightsMutation.error.message}
          </div>
        )}
      </HudPanel>

      {/* History */}
      <HudPanel
        title="Calibration History"
        subtitle={`${symbol} · ${tf} · ${path} · ${side}`}
        headerRight={
          <Badge className="bg-card/60 text-muted-foreground border-border/30 font-mono text-[10px]">
            <History className="h-2.5 w-2.5 mr-0.5" />
            {historyQuery.data?.length ?? 0} rows
          </Badge>
        }
      >
        {historyQuery.isLoading && (
          <div className="flex items-center gap-2 py-3 font-mono text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading history...
          </div>
        )}
        {historyQuery.error && (
          <div className="font-mono text-xs text-neon-red py-3">
            Error: {historyQuery.error.message}
          </div>
        )}
        {historyQuery.data && historyQuery.data.length === 0 && (
          <p className="font-mono text-xs text-muted-foreground py-3">
            기록 없음 — 아직 calibration 이 발생하지 않은 (symbol, tf, path,
            side) 조합.
          </p>
        )}
        {historyQuery.data && historyQuery.data.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/30">
                  <th className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider py-2 px-2 text-left">
                    Calibrated At
                  </th>
                  <th className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider py-2 px-2">
                    Source
                  </th>
                  <th className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider py-2 px-2">
                    MOM
                  </th>
                  <th className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider py-2 px-2">
                    POS
                  </th>
                  <th className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider py-2 px-2">
                    TRD
                  </th>
                  <th className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider py-2 px-2">
                    VOL
                  </th>
                  <th className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider py-2 px-2">
                    ACT
                  </th>
                  <th className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider py-2 px-2">
                    R²
                  </th>
                  <th className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider py-2 px-2">
                    n
                  </th>
                  <th className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider py-2 px-2">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {historyQuery.data.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-border/10 hover:bg-neon-cyan/5"
                  >
                    <td className="py-2 px-2 font-mono text-[10px] text-foreground">
                      {new Date(row.calibratedAt).toLocaleString()}
                    </td>
                    <td className="py-2 px-2 text-center">
                      <Badge
                        className={cn(
                          "font-mono text-[9px]",
                          row.source === "self_backtest"
                            ? "bg-neon-green/15 text-neon-green border-neon-green/40"
                            : row.source === "external"
                              ? "bg-neon-cyan/15 text-neon-cyan border-neon-cyan/40"
                              : "bg-neon-yellow/15 text-neon-yellow border-neon-yellow/40"
                        )}
                      >
                        {row.source}
                      </Badge>
                    </td>
                    <td className="py-2 px-2 text-center font-mono text-[10px] text-foreground">
                      {(row.weightMomentum * 100).toFixed(0)}%
                    </td>
                    <td className="py-2 px-2 text-center font-mono text-[10px] text-foreground">
                      {(row.weightPosition * 100).toFixed(0)}%
                    </td>
                    <td className="py-2 px-2 text-center font-mono text-[10px] text-foreground">
                      {(row.weightTrend * 100).toFixed(0)}%
                    </td>
                    <td className="py-2 px-2 text-center font-mono text-[10px] text-foreground">
                      {(row.weightVolume * 100).toFixed(0)}%
                    </td>
                    <td className="py-2 px-2 text-center font-mono text-[10px] text-foreground">
                      {(row.weightAction * 100).toFixed(0)}%
                    </td>
                    <td className="py-2 px-2 text-center font-mono text-[10px] text-foreground">
                      {row.rSquared != null ? row.rSquared.toFixed(2) : "—"}
                    </td>
                    <td className="py-2 px-2 text-center font-mono text-[10px] text-foreground">
                      {row.sampleSize ?? "—"}
                    </td>
                    <td className="py-2 px-2 text-center font-mono text-[10px]">
                      <span
                        className={cn(
                          row.status === "production"
                            ? "text-neon-green"
                            : "text-neon-yellow"
                        )}
                      >
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </HudPanel>
    </div>
  );
}
