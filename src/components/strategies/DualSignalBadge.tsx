/**
 * DualSignalBadge — Home.tsx 코인 행의 LONG/SHORT 듀얼 시그널 배지.
 *
 * v6.6 활성 시 trpc.bbdxV66.current 로 (symbol, tf) 별 LONG/SHORT 양방향 평가 결과를
 * fetch. 충돌 시 회색 CONFLICT chip 으로 양쪽 차단 표시.
 *
 * v6.6 비활성 / SHORT flag off → 아무것도 렌더하지 않음 (기존 LONG-only badges 가
 * Home 의 renderSignalBadges 에서 별도로 표시).
 *
 * Feature flag 는 부모가 useBbdxV66Flags 로 조회 + isV66 props 전달.
 */

import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { TrendingDown, TrendingUp, AlertOctagon } from "lucide-react";
import { cn } from "@/lib/utils";

interface DualSignalBadgeProps {
  symbol: string;
  tf: string;
  /** v6.6 활성 여부 (부모가 useBbdxV66Flags 로 조회) */
  enabled: boolean;
}

const ALLOWED_TF = ["1h", "4h", "1d"] as const;
type AllowedTf = (typeof ALLOWED_TF)[number];

function isAllowedTf(tf: string): tf is AllowedTf {
  return (ALLOWED_TF as readonly string[]).includes(tf);
}

export function DualSignalBadge({ symbol, tf, enabled }: DualSignalBadgeProps) {
  const tfAllowed = isAllowedTf(tf);
  const { data } = trpc.bbdxV66.current.useQuery(
    {
      symbol,
      tf: (tfAllowed ? tf : "4h") as AllowedTf,
    },
    {
      enabled: enabled && tfAllowed && !!symbol,
      staleTime: 30_000,
      retry: false,
    }
  );

  if (!enabled || !data) return null;

  const longTriggered = !!data.long?.triggered;
  const shortTriggered = !!data.short?.triggered;
  const longScore = data.long?.finalScore ?? 0;
  const shortScore = data.short?.finalScore ?? 0;

  // meta 가 union 타입 — note 가 있으면 v6.5 fallback (실제 평가 없음)
  if (data.meta && "note" in data.meta) return null;

  // 충돌 판정 — bothTriggered === true 또는 |Δ| < 10
  const bothTriggered =
    "bothTriggered" in data.meta && data.meta.bothTriggered === true;
  const scoreDiff = Math.abs(longScore - shortScore);
  const isConflict =
    longTriggered && shortTriggered && (bothTriggered || scoreDiff < 10);

  if (isConflict) {
    return (
      <Badge
        className="bg-muted/40 text-muted-foreground border-border/50 font-mono text-[10px]"
        title={`v6.6 — LONG ${longScore.toFixed(1)} vs SHORT ${shortScore.toFixed(1)} (Δ${scoreDiff.toFixed(1)} < 10) — 양쪽 차단`}
      >
        <AlertOctagon className="h-2.5 w-2.5 mr-0.5" />
        CONFLICT
      </Badge>
    );
  }

  if (!longTriggered && !shortTriggered) return null;

  return (
    <>
      {longTriggered && (
        <Badge
          className={cn(
            "bg-neon-green/20 text-neon-green border-neon-green/40 font-mono text-[10px]"
          )}
          title={`v6.6 LONG · path=${data.long?.path ?? "?"} · score=${longScore.toFixed(1)}/${data.long?.thresholdUsed.toFixed(1)} · w-src=${data.long?.weightsSource}`}
        >
          <TrendingUp className="h-2.5 w-2.5 mr-0.5" />
          LONG {longScore.toFixed(0)}
        </Badge>
      )}
      {shortTriggered && (
        <Badge
          className={cn(
            "bg-neon-red/20 text-neon-red border-neon-red/40 font-mono text-[10px]"
          )}
          title={`v6.6 SHORT · path=${data.short?.path ?? "?"} · score=${shortScore.toFixed(1)}/${data.short?.thresholdUsed.toFixed(1)} · w-src=${data.short?.weightsSource}`}
        >
          <TrendingDown className="h-2.5 w-2.5 mr-0.5" />
          SHORT {shortScore.toFixed(0)}
        </Badge>
      )}
    </>
  );
}
