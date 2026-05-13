/**
 * CoinInfoTab — CoinMarketCap-style 코인 정보 페이지.
 *
 * 백엔드 `trpc.coin.info` 라우트가 추가되면 자동으로 real 데이터 표시.
 * 미존재/stub/error 시 graceful fallback (기존 useCoinMeta 의 시총/24h 거래량
 * 데이터로 부분 채움 + "정보 미커버" 안내).
 *
 * 헌장: TRACKER_TAB_STANDARD §1 (TrackerTabs 안에 들어가는 6 번째 탭).
 * 데이터 소스: CoinGecko Free API (백엔드 캐시 경유, 한국어 큐레이션 포함).
 *
 * Sections:
 *   1. Header — name + rank + 현재가 + 24h 변동
 *   2. 개요 (한국어 설명 + 카테고리 + 용도 chip)
 *   3. 마켓 데이터 grid (Mcap · FDV · Volume24h · Circ/Total/Max Supply)
 *   4. 가격 정보 (현재가 · ATH · ATL · ATH 대비)
 *   5. 프로젝트 정보 (런칭 · 합의 알고리즘)
 *   6. 공식 링크 (homepage · whitepaper · github · twitter · reddit)
 *   7. 출처 + 신선도 footer
 */

import { HudPanel, StatCard } from "@/components/HudPanel";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { useCoinMeta } from "../../hooks/useCoinMeta";
import { useCoinDetail } from "@/hooks/useMarketData";
import { ExternalLink, AlertCircle, FileText, Github, Globe, Loader2, MessageSquare, Twitter } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Inline type mirror — 백엔드 `coin.info` 라우트 미존재 시 forward-compat 타입.
// 백엔드 push 후 `import type { CoinInfo } from "@tradelab/backend/router"` 로
// 교체 가능. 미러 형태는 작업 단위 명세서 따름.
// ---------------------------------------------------------------------------

interface CoinInfo {
  symbol: string;
  baseSymbol: string;
  name: string;
  coingeckoId: string | null;
  description: string;
  category: string[];
  useCase: string;
  launchDate: string | null;
  consensus: string | null;
  rank: number | null;
  marketCapUsd: number | null;
  fdvUsd: number | null;
  volume24hUsd: number | null;
  circulatingSupply: number | null;
  totalSupply: number | null;
  maxSupply: number | null;
  currentPrice: number | null;
  ath: number | null;
  athDate: string | null;
  athChangePct: number | null;
  atl: number | null;
  homepage: string | null;
  whitepaper: string | null;
  github: string | null;
  twitter: string | null;
  reddit: string | null;
  status: "real" | "stub" | "error";
  cachedAt: number;
  errorDetail?: string;
}

// ---------------------------------------------------------------------------
// Helpers — 숫자/날짜/링크 포맷 (TIP: 가격은 < 1 USD 시 6 자리, else 2).
// ---------------------------------------------------------------------------

function formatUsd(n: number | null | undefined, prefix = "$"): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n >= 1e12) return `${prefix}${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `${prefix}${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${prefix}${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${prefix}${(n / 1e3).toFixed(2)}K`;
  if (n >= 1) return `${prefix}${n.toFixed(2)}`;
  return `${prefix}${n.toFixed(6)}`;
}

function formatNum(n: number | null | undefined, suffix = ""): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n >= 1e12) return `${(n / 1e12).toFixed(2)}T${suffix}`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B${suffix}`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M${suffix}`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(2)}K${suffix}`;
  return `${n.toLocaleString("ko-KR")}${suffix}`;
}

function formatPct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

function formatRelativeTime(ts: number | null | undefined): string {
  if (!ts) return "—";
  const diff = Date.now() - ts;
  if (diff < 60_000) return "방금 전";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}분 전`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}시간 전`;
  return `${Math.floor(diff / 86_400_000)}일 전`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface CoinInfoTabProps {
  symbol: string;
}

export function CoinInfoTab({ symbol }: CoinInfoTabProps) {
  // 백엔드 `coin.info` 라우트는 아직 push 되지 않을 수 있음. 그 동안은
  // useCoinMeta (시총·24h 거래량) + useCoinDetail (현재가) fallback 으로 채움.
  // tRPC client 가 router 에 procedure 가 없으면 build-time error 발생하므로
  // 한 단계 wrapping — `as any` 우회.
  const trpcAny = trpc as any;
  const infoQuery = trpcAny.coin?.info?.useQuery?.(
    { symbol },
    { staleTime: 5 * 60_000, retry: 0 }
  ) ?? { data: undefined, isLoading: false, isError: true, error: { message: "coin.info 라우트 미존재" } };

  const info: CoinInfo | undefined = infoQuery.data;
  const isInfoReady = !!info;

  // Fallback — 기존 meta 라우트 (시총/거래량) + 현재가.
  const { meta } = useCoinMeta(symbol);
  const { data: detail } = useCoinDetail(symbol, "4h", 1);
  const fallbackPrice = detail?.candles?.[detail.candles.length - 1]?.close ?? null;

  const baseSymbol = info?.baseSymbol ?? symbol.replace(/USDT$/, "");
  const displayName = info?.name ?? baseSymbol;
  const displayPrice = info?.currentPrice ?? fallbackPrice;

  if (infoQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-12 gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-neon-cyan" />
        <span className="font-mono text-xs text-muted-foreground">
          코인 정보 로딩 중...
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 1. Header — name + rank + price */}
      <HudPanel
        title={`${displayName}`}
        subtitle={info?.coingeckoId ? `CoinGecko: ${info.coingeckoId}` : symbol}
        variant="highlight"
        headerRight={
          info?.rank ? (
            <Badge
              variant="outline"
              className="border-neon-cyan/40 text-neon-cyan font-mono text-xs"
            >
              Rank #{info.rank}
            </Badge>
          ) : null
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatCard
            label="현재가"
            value={formatUsd(displayPrice)}
            variant="default"
          />
          <StatCard
            label="시가총액"
            value={formatUsd(info?.marketCapUsd ?? meta?.mcap ?? null)}
            variant="default"
          />
          <StatCard
            label="24h 거래량"
            value={formatUsd(info?.volume24hUsd ?? meta?.volume24h ?? null)}
            variant="default"
          />
        </div>
        {info?.category && info.category.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {info.category.slice(0, 8).map((c) => (
              <Badge
                key={c}
                variant="outline"
                className="border-neon-cyan/30 text-neon-cyan/80 font-mono text-[10px]"
              >
                {c}
              </Badge>
            ))}
          </div>
        )}
      </HudPanel>

      {/* 2. 한국어 개요 */}
      {info?.description && (
        <HudPanel title="개요" subtitle="OVERVIEW">
          <p className="font-mono text-sm text-foreground/90 leading-relaxed whitespace-pre-line">
            {info.description}
          </p>
          {info.useCase && (
            <div className="mt-3 flex items-start gap-2">
              <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                용도:
              </span>
              <Badge
                variant="outline"
                className="border-neon-pink/40 text-neon-pink font-mono text-[11px]"
              >
                {info.useCase}
              </Badge>
            </div>
          )}
        </HudPanel>
      )}

      {/* 3. 마켓 데이터 grid */}
      <HudPanel title="시장 데이터" subtitle="MARKET DATA">
        <dl className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm font-mono">
          <DataRow label="시가총액" value={formatUsd(info?.marketCapUsd ?? meta?.mcap ?? null)} />
          <DataRow label="FDV" value={formatUsd(info?.fdvUsd ?? null)} />
          <DataRow label="24h 거래량" value={formatUsd(info?.volume24hUsd ?? meta?.volume24h ?? null)} />
          <DataRow
            label="순환 공급량"
            value={formatNum(info?.circulatingSupply ?? meta?.supply ?? null, ` ${baseSymbol}`)}
          />
          <DataRow
            label="총 공급량"
            value={formatNum(info?.totalSupply ?? null, ` ${baseSymbol}`)}
          />
          <DataRow
            label="최대 공급량"
            value={
              info?.maxSupply == null
                ? info?.maxSupply === null
                  ? "무제한"
                  : "—"
                : formatNum(info.maxSupply, ` ${baseSymbol}`)
            }
          />
        </dl>
      </HudPanel>

      {/* 4. 가격 정보 */}
      <HudPanel title="가격 정보" subtitle="PRICE HISTORY">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm font-mono">
          <DataRow label="현재가" value={formatUsd(displayPrice)} />
          <DataRow
            label="ATH 대비"
            value={formatPct(info?.athChangePct ?? null)}
            valueClassName={
              info?.athChangePct != null && info.athChangePct < 0
                ? "text-neon-red"
                : "text-neon-green"
            }
          />
          <DataRow
            label="ATH (역대 최고)"
            value={formatUsd(info?.ath ?? null)}
            sublabel={info?.athDate ? new Date(info.athDate).toLocaleDateString("ko-KR") : undefined}
          />
          <DataRow label="ATL (역대 최저)" value={formatUsd(info?.atl ?? null)} />
        </dl>
      </HudPanel>

      {/* 5. 프로젝트 정보 */}
      {(info?.launchDate || info?.consensus) && (
        <HudPanel title="프로젝트 정보" subtitle="PROJECT METADATA">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm font-mono">
            <DataRow
              label="런칭"
              value={
                info?.launchDate
                  ? new Date(info.launchDate).toLocaleDateString("ko-KR")
                  : "—"
              }
            />
            <DataRow label="합의 알고리즘" value={info?.consensus ?? "—"} />
          </dl>
        </HudPanel>
      )}

      {/* 6. 공식 링크 */}
      {info && (info.homepage || info.whitepaper || info.github || info.twitter || info.reddit) && (
        <HudPanel title="공식 링크" subtitle="OFFICIAL LINKS">
          <div className="flex flex-wrap gap-2">
            {info.homepage && <ExternalLinkButton href={info.homepage} icon={Globe} label="홈페이지" />}
            {info.whitepaper && <ExternalLinkButton href={info.whitepaper} icon={FileText} label="백서" />}
            {info.github && <ExternalLinkButton href={info.github} icon={Github} label="GitHub" />}
            {info.twitter && (
              <ExternalLinkButton
                href={info.twitter.startsWith("http") ? info.twitter : `https://twitter.com/${info.twitter}`}
                icon={Twitter}
                label="X (Twitter)"
              />
            )}
            {info.reddit && <ExternalLinkButton href={info.reddit} icon={MessageSquare} label="Reddit" />}
          </div>
        </HudPanel>
      )}

      {/* 7. 출처 + 신선도 footer */}
      <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-sm border border-border/20 bg-card/30 flex-wrap">
        <p className="font-mono text-[10px] text-muted-foreground">
          출처: CoinGecko Free API
          {info?.cachedAt && (
            <span className="ml-2">
              · 캐시: <span className="text-foreground/70">{formatRelativeTime(info.cachedAt)}</span>
            </span>
          )}
        </p>
        {!isInfoReady && (
          <div className="flex items-center gap-1.5 font-mono text-[10px] text-yellow-400">
            <AlertCircle className="h-3 w-3 shrink-0" />
            <span>
              백엔드 `coin.info` 라우트 미배포 — 시총·거래량은 `coin.meta` 로 부분 표시
            </span>
          </div>
        )}
        {info?.status === "stub" && (
          <div className="flex items-center gap-1.5 font-mono text-[10px] text-yellow-400">
            <AlertCircle className="h-3 w-3 shrink-0" />
            <span>이 코인은 Tradelab 큐레이션 화이트리스트 외 — 일부 데이터 stub</span>
          </div>
        )}
        {info?.status === "error" && info.errorDetail && (
          <div className="flex items-center gap-1.5 font-mono text-[10px] text-neon-red">
            <AlertCircle className="h-3 w-3 shrink-0" />
            <span>오류: {info.errorDetail}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub components
// ---------------------------------------------------------------------------

function DataRow({
  label,
  value,
  sublabel,
  valueClassName,
}: {
  label: string;
  value: string;
  sublabel?: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[10px] text-muted-foreground uppercase tracking-wider">
        {label}
      </dt>
      <dd className={cn("text-foreground tabular-nums", valueClassName)}>
        {value}
        {sublabel && (
          <span className="ml-2 text-[10px] text-muted-foreground">{sublabel}</span>
        )}
      </dd>
    </div>
  );
}

function ExternalLinkButton({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: typeof Globe;
  label: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm",
        "border border-neon-cyan/30 text-neon-cyan bg-neon-cyan/5",
        "font-mono text-xs hover:bg-neon-cyan/15 hover:border-neon-cyan/50 transition-colors"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
      <ExternalLink className="h-3 w-3 opacity-60" />
    </a>
  );
}
