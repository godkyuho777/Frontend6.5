/**
 * 리서치 목록 (`/research`) — 섹터별 딥다이브 + 주간 시황 허브.
 *
 * 데이터는 백엔드 tRPC (`trpc.research.list`) 로 *전체 목록 1회* fetch 한 뒤,
 * 타입/섹터/검색 필터와 featured 분리는 모두 클라이언트에서 처리한다(필터마다
 * refetch 없이 즉시 반응 UX 보존).
 *
 * 디자인: 전역 토큰(bg-card · border · text-muted-foreground)만 사용.
 * 섹터 배지 tint 만 research-types 의 의미색을 쓴다(네온/글로우 없음).
 */

import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Newspaper, Search, Clock, Plus, AlertTriangle, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import {
  RESEARCH_TYPE_LABEL,
  researchSectorMeta,
  formatResearchDate,
  type ResearchSummary,
  type ResearchType,
  type ResearchSectorId,
} from "@/lib/research-types";

// 타입 필터 칩 (전체 + 3 타입)
const TYPE_FILTERS: { id: ResearchType | "all"; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "weekly", label: RESEARCH_TYPE_LABEL.weekly },
  { id: "deepdive", label: RESEARCH_TYPE_LABEL.deepdive },
  { id: "flash", label: RESEARCH_TYPE_LABEL.flash },
];

// 섹터 필터 칩 (전체 + 리서치에서 실제 쓰는 섹터)
const SECTOR_FILTERS: { id: ResearchSectorId | "all"; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "layer-1", label: "L1" },
  { id: "layer-2", label: "L2" },
  { id: "defi", label: "DeFi" },
  { id: "rwa", label: "RWA" },
  { id: "depin", label: "DePIN" },
  { id: "ai", label: "AI" },
  { id: "meme", label: "Meme" },
];

export default function ResearchList() {
  const [, setLocation] = useLocation();
  const [typeFilter, setTypeFilter] = useState<ResearchType | "all">("all");
  const [sectorFilter, setSectorFilter] = useState<ResearchSectorId | "all">(
    "all"
  );
  const [query, setQuery] = useState("");

  // 전체 목록 1회 fetch — 필터/검색은 아래에서 클라이언트 처리(즉시 반응).
  const {
    data,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = trpc.research.list.useQuery({}, { staleTime: 5 * 60 * 1000 });

  const articles = useMemo(() => data ?? [], [data]);

  const featured = useMemo(
    () => articles.find((a) => a.featured),
    [articles]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return articles
      .filter((a) => {
        if (typeFilter !== "all" && a.type !== typeFilter) return false;
        if (sectorFilter !== "all" && a.sector !== sectorFilter) return false;
        if (q) {
          const hay = `${a.title} ${a.dek}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  }, [articles, typeFilter, sectorFilter, query]);

  const open = (slug: string) => setLocation(`/research/${slug}`);

  // featured 는 필터/검색이 기본값일 때만 상단에 노출 (필터 중에는 그리드로만)
  const showFeatured =
    !!featured &&
    typeFilter === "all" &&
    sectorFilter === "all" &&
    query.trim() === "";

  const gridArticles = showFeatured
    ? filtered.filter((a) => a.slug !== featured!.slug)
    : filtered;

  return (
    <div className="flex flex-col gap-6">
      {/* 헤더 */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex size-9 items-center justify-center rounded-lg bg-muted text-foreground">
            <Newspaper className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              리서치
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              섹터별 심층 분석과 주간 시황 — 데이터로 검증한 관점
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          className="h-9"
          onClick={() =>
            toast("발행 기능은 곧 제공됩니다", {
              description: "리서치 작성·발행 도구를 준비 중입니다.",
            })
          }
        >
          <Plus className="size-4" />새 글 발행
        </Button>
      </div>

      {/* 필터 바 */}
      <div className="flex flex-col gap-3">
        {/* 타입 칩 */}
        <FilterChipRow
          options={TYPE_FILTERS}
          active={typeFilter}
          onSelect={(id) => setTypeFilter(id as ResearchType | "all")}
        />
        {/* 섹터 칩 */}
        <FilterChipRow
          options={SECTOR_FILTERS}
          active={sectorFilter}
          onSelect={(id) => setSectorFilter(id as ResearchSectorId | "all")}
        />
        {/* 검색 */}
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="제목·요약 검색..."
            aria-label="리서치 검색"
            className="pl-9"
          />
        </div>
      </div>

      {/* 본문 — 로딩 / 에러 / 정상 */}
      {isLoading ? (
        <ResearchListSkeleton />
      ) : isError ? (
        <ResearchListError onRetry={() => refetch()} retrying={isRefetching} />
      ) : (
        <>
          {/* Featured */}
          {showFeatured && featured && (
            <FeaturedCard article={featured} onOpen={() => open(featured.slug)} />
          )}

          {/* 최신 글 */}
          <section className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-base font-bold text-foreground">최신 글</h2>
              <span className="text-sm text-muted-foreground">
                {gridArticles.length}개
              </span>
            </div>

            {gridArticles.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card px-6 py-16 text-center">
                <p className="text-base font-bold text-foreground">
                  조건에 맞는 리서치가 없어요
                </p>
                <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                  필터를 바꾸거나 검색어를 지워보세요.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {gridArticles.map((article) => (
                  <ArticleCard
                    key={article.slug}
                    article={article}
                    onOpen={() => open(article.slug)}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* 푸터 노트 */}
      <p className="border-t border-border pt-4 text-sm text-muted-foreground">
        리서치는 시장 구조 분석과 교육 콘텐츠입니다. 개별 진입·청산 판단은 시그널
        스캐너의 RSI·BB·ADX 컨플루언스를 따르며, 본 글은 단독 매매 시그널을
        발행하지 않습니다.
      </p>
    </div>
  );
}

// ── 로딩 스켈레톤 ─────────────────────────────────────────────────
function ResearchListSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">리서치를 불러오는 중입니다</span>
      {/* featured placeholder */}
      <div className="grid grid-cols-1 overflow-hidden rounded-xl border border-border bg-card md:grid-cols-[minmax(0,260px)_1fr]">
        <div className="min-h-[140px] animate-pulse bg-muted md:min-h-full" />
        <div className="flex flex-col gap-3 p-5">
          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
          <div className="h-6 w-3/4 animate-pulse rounded bg-muted" />
          <div className="h-4 w-full animate-pulse rounded bg-muted" />
          <div className="h-4 w-40 animate-pulse rounded bg-muted" />
        </div>
      </div>
      {/* grid placeholders */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex h-full flex-col gap-3 rounded-xl border border-border bg-card p-5"
          >
            <div className="h-4 w-20 animate-pulse rounded bg-muted" />
            <div className="h-5 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-4 w-full animate-pulse rounded bg-muted" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
            <div className="mt-2 h-4 w-28 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 에러 상태 ─────────────────────────────────────────────────────
function ResearchListError({
  onRetry,
  retrying,
}: {
  onRetry: () => void;
  retrying: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card px-6 py-16 text-center">
      <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <AlertTriangle className="size-5" />
      </div>
      <p className="text-base font-bold text-foreground">
        리서치를 불러오지 못했어요
      </p>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">
        잠시 후 다시 시도해주세요. 문제가 계속되면 네트워크 연결을 확인해주세요.
      </p>
      <Button
        variant="outline"
        className="mt-5 h-9"
        onClick={onRetry}
        disabled={retrying}
      >
        <RotateCcw className={cn("size-4", retrying && "animate-spin")} />
        다시 시도
      </Button>
    </div>
  );
}

// ── 필터 칩 행 ────────────────────────────────────────────────────
function FilterChipRow({
  options,
  active,
  onSelect,
}: {
  options: { id: string; label: string }[];
  active: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {options.map((opt) => {
        const isActive = active === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            aria-pressed={isActive}
            onClick={() => onSelect(opt.id)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
              isActive
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ── 섹터 배지 ─────────────────────────────────────────────────────
export function SectorBadge({
  sector,
  className,
}: {
  sector: ResearchSectorId;
  className?: string;
}) {
  const meta = researchSectorMeta(sector);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-[13px] font-bold",
        className
      )}
      style={{ backgroundColor: meta.bg, color: meta.text }}
    >
      {meta.label}
    </span>
  );
}

// ── 타입 라벨 (작은 회색 텍스트) ──────────────────────────────────
function TypeLabel({ type }: { type: ResearchType }) {
  return (
    <span className="text-sm font-medium text-muted-foreground">
      {RESEARCH_TYPE_LABEL[type]}
    </span>
  );
}

// ── 메타 행 (저자 · 날짜 · 읽기시간) ──────────────────────────────
function MetaRow({ article }: { article: ResearchSummary }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
      <span className="font-medium text-foreground">{article.author}</span>
      <span aria-hidden>·</span>
      <time dateTime={article.publishedAt}>
        {formatResearchDate(article.publishedAt)}
      </time>
      <span aria-hidden>·</span>
      <span className="inline-flex items-center gap-1">
        <Clock className="size-3.5" />
        {article.readMinutes}분
      </span>
    </div>
  );
}

// ── Featured 카드 (가로형) ────────────────────────────────────────
function FeaturedCard({
  article,
  onOpen,
}: {
  article: ResearchSummary;
  onOpen: () => void;
}) {
  const meta = researchSectorMeta(article.sector);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group grid grid-cols-1 overflow-hidden rounded-xl border border-border bg-card text-left transition-shadow hover:shadow-md md:grid-cols-[minmax(0,260px)_1fr]"
    >
      {/* tint 썸네일 영역 */}
      <div
        className="relative flex min-h-[140px] items-end p-4 md:min-h-full"
        style={{ backgroundColor: meta.bg }}
        aria-hidden
      >
        <span
          className="text-5xl font-extrabold tracking-tight opacity-90"
          style={{ color: meta.text }}
        >
          {meta.label}
        </span>
      </div>
      {/* 본문 */}
      <div className="flex flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-md bg-primary px-2 py-0.5 text-[13px] font-bold text-primary-foreground">
            추천
          </span>
          <SectorBadge sector={article.sector} />
          <TypeLabel type={article.type} />
        </div>
        <h3 className="text-xl font-bold leading-snug tracking-tight text-foreground group-hover:text-primary">
          {article.title}
        </h3>
        <p className="line-clamp-2 text-base leading-relaxed text-muted-foreground">
          {article.dek}
        </p>
        <MetaRow article={article} />
      </div>
    </button>
  );
}

// ── 일반 카드 (세로형) ────────────────────────────────────────────
function ArticleCard({
  article,
  onOpen,
}: {
  article: ResearchSummary;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex h-full flex-col gap-3 rounded-xl border border-border bg-card p-5 text-left transition-shadow hover:shadow-md"
    >
      <div className="flex flex-wrap items-center gap-2">
        <SectorBadge sector={article.sector} />
        <TypeLabel type={article.type} />
      </div>
      <h3 className="text-lg font-bold leading-snug tracking-tight text-foreground group-hover:text-primary">
        {article.title}
      </h3>
      <p className="line-clamp-2 flex-1 text-sm leading-relaxed text-muted-foreground">
        {article.dek}
      </p>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <time dateTime={article.publishedAt}>
          {formatResearchDate(article.publishedAt)}
        </time>
        <span aria-hidden>·</span>
        <span className="inline-flex items-center gap-1">
          <Clock className="size-3.5" />
          {article.readMinutes}분
        </span>
      </div>
    </button>
  );
}
