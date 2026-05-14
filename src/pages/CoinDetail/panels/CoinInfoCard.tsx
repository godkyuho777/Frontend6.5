/**
 * CoinInfoCard — mcap / volume / supply / dominance / SSR.
 *
 * 백엔드 trpc.coin.meta 미존재 시 일부 필드는 "—" 로 표시.
 */

import { HudPanel } from "@/components/HudPanel";
import type { CoinMeta } from "../hooks/useCoinMeta";

interface CoinInfoCardProps {
  meta: CoinMeta | null;
}

function formatLargeNumber(n: number | null, prefix = ""): string {
  if (n == null) return "—";
  if (n >= 1e12) return `${prefix}${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `${prefix}${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${prefix}${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${prefix}${(n / 1e3).toFixed(2)}K`;
  return `${prefix}${n.toFixed(2)}`;
}

export function CoinInfoCard({ meta }: CoinInfoCardProps) {
  return (
    <HudPanel title="Coin Info" subtitle={meta?.symbol ?? ""}>
      <dl className="grid grid-cols-2 gap-2 text-xs font-sans">
        <div>
          <dt className="text-[10px] text-muted-foreground uppercase">Mcap</dt>
          <dd className="text-foreground">{formatLargeNumber(meta?.mcap ?? null, "$")}</dd>
        </div>
        <div>
          <dt className="text-[10px] text-muted-foreground uppercase">Vol 24h</dt>
          <dd className="text-foreground">
            {formatLargeNumber(meta?.volume24h ?? null, "$")}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] text-muted-foreground uppercase">Supply</dt>
          <dd className="text-foreground">{formatLargeNumber(meta?.supply ?? null)}</dd>
        </div>
        <div>
          <dt className="text-[10px] text-muted-foreground uppercase">Dom</dt>
          <dd className="text-foreground">
            {meta?.dominance != null ? `${(meta.dominance * 100).toFixed(2)}%` : "—"}
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="text-[10px] text-muted-foreground uppercase">
            SSR Z-Score
          </dt>
          <dd
            className={
              meta?.ssrZScore != null
                ? meta.ssrZScore < 0
                  ? "text-neon-green"
                  : meta.ssrZScore > 0
                    ? "text-neon-red"
                    : "text-foreground"
                : "text-foreground"
            }
          >
            {meta?.ssrZScore != null ? meta.ssrZScore.toFixed(3) : "—"}
            <span className="text-[10px] text-muted-foreground ml-2">
              {meta?.ssrZScore != null && meta.ssrZScore < 0
                ? "(매수 여력 풍부)"
                : meta?.ssrZScore != null && meta.ssrZScore > 0
                  ? "(매수 여력 부족)"
                  : ""}
            </span>
          </dd>
        </div>
      </dl>
      <p className="font-sans text-[9px] text-muted-foreground/70 mt-3 leading-relaxed">
        * Mcap / supply / dominance 는 백엔드 coin.meta 라우트 추가 후 표시됩니다.
      </p>
    </HudPanel>
  );
}
