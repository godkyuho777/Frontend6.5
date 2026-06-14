/**
 * 리서치 읽기 (`/research/:slug`) — 단일 기사 뷰.
 *
 * 데이터는 백엔드 tRPC: `trpc.research.detail.useQuery({ slug })` (본문 포함) +
 * `trpc.research.related.useQuery({ slug, limit: 2 })` (관련 기사 요약).
 * detail === null → not-found 안내. 로딩 중에는 스켈레톤, 에러 시 안내+재시도.
 *
 * <title> 처리: DashboardLayout 은 /research/:slug 를 더 이상 해석하지 않고
 * 일반값("리서치")으로 폴백한다(과거엔 mock getArticleBySlug 를 *동기* 호출했으나
 * 데이터가 비동기 tRPC 로 바뀌어 불가). 여기서 detail 이 도착하면(이후 커밋)
 * useDocumentTitle 로 기사 제목을 설정한다 — 부모의 초기 "리서치" 타이틀은
 * 동기 커밋에서 한 번 잡히고, 비동기 응답 이후 자식이 덮어쓴다(race 없음).
 *
 * 디자인: 좁은 리딩 칼럼(~42rem) + .prose-research 본문 스타일(index.css).
 * 전역 토큰만 사용, 섹터 배지 tint 만 의미색.
 */

import { Link, useRoute } from "wouter";
import {
  ArrowLeft,
  ChevronLeft,
  Clock,
  FileDown,
  ExternalLink,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { trpc } from "@/lib/trpc";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { cn } from "@/lib/utils";
import {
  RESEARCH_TYPE_LABEL,
  researchSectorMeta,
  formatResearchDate,
  type ResearchSummary,
} from "@/lib/research-types";
import { SectorBadge } from "./ResearchList";

export default function ResearchArticlePage() {
  const [, params] = useRoute("/research/:slug");
  const slug = params?.slug ?? "";

  const detailQuery = trpc.research.detail.useQuery(
    { slug },
    { enabled: slug.length > 0, staleTime: 5 * 60 * 1000 }
  );
  const relatedQuery = trpc.research.related.useQuery(
    { slug, limit: 2 },
    { enabled: slug.length > 0, staleTime: 5 * 60 * 1000 }
  );

  const article = detailQuery.data;

  // detail 도착 이후(별도 커밋) 자식이 타이틀을 잡는다 → 부모 "리서치"를 덮어씀.
  // 로딩/없음 시에는 undefined 를 넘겨 부모 폴백("리서치")이 유지되게 둔다.
  useDocumentTitle(article?.title);

  // 로딩 (첫 fetch)
  if (detailQuery.isLoading) {
    return <ArticleSkeleton />;
  }

  // 에러 (네트워크/서버) — null(미존재)과 구분
  if (detailQuery.isError) {
    return <ArticleError onRetry={() => detailQuery.refetch()} retrying={detailQuery.isRefetching} />;
  }

  // 미존재 slug → 백엔드가 null 반환
  if (!article) {
    return <ArticleNotFound />;
  }

  const related = relatedQuery.data ?? [];
  const initials = article.author.slice(0, 2);

  return (
    <article className="flex flex-col gap-6">
      {/* breadcrumb */}
      <nav aria-label="경로">
        <Link
          href="/research"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          리서치
        </Link>
      </nav>

      {/* 타이틀 블록 (좁은 칼럼) */}
      <header className="mx-auto w-full max-w-[42rem] border-b border-border pb-6">
        <div className="flex flex-wrap items-center gap-2">
          <SectorBadge sector={article.sector} />
          <span className="text-sm font-medium text-muted-foreground">
            {RESEARCH_TYPE_LABEL[article.type]}
          </span>
        </div>
        <h1 className="mt-3 text-3xl font-extrabold leading-tight tracking-tight text-foreground">
          {article.title}
        </h1>
        <p className="mt-3 text-lg leading-relaxed text-muted-foreground">
          {article.dek}
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Avatar className="size-9">
            <AvatarFallback className="bg-foreground text-xs font-bold text-background">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              {article.author}
            </span>
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
        </div>
      </header>

      {/* 본문 칼럼 */}
      <div className="mx-auto flex w-full max-w-[42rem] flex-col gap-6">
        {/* 핵심 요약 박스 (연한 블루 tint, 전체 보더+rounded) */}
        {article.takeaways.length > 0 && (
          <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
            <h2 className="text-sm font-bold tracking-tight text-primary">
              핵심 요약
            </h2>
            <ul className="mt-3 flex flex-col gap-2">
              {article.takeaways.map((t, i) => (
                <li
                  key={i}
                  className="flex gap-2.5 text-[0.95rem] leading-relaxed text-foreground"
                >
                  <span
                    aria-hidden
                    className="mt-2 size-1.5 shrink-0 rounded-full bg-primary"
                  />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* 목차 박스 (hairline) */}
        {article.toc.length > 0 && (
          <nav
            aria-label="목차"
            className="rounded-xl border border-border bg-card p-5"
          >
            <h2 className="text-sm font-bold tracking-tight text-foreground">
              목차
            </h2>
            <ol className="mt-3 flex flex-col gap-2">
              {article.toc.map((item) => (
                <li key={item.no} className="flex gap-3 text-[0.95rem]">
                  <span className="font-mono text-sm text-muted-foreground">
                    {item.no}
                  </span>
                  <span className="text-foreground">{item.title}</span>
                </li>
              ))}
            </ol>
          </nav>
        )}

        {/* 본문 */}
        {article.bodyHtml ? (
          <div
            className="prose-research"
            // 백엔드 seed 본문 — 신뢰된 정적 콘텐츠. 추후 사용자 발행 본문은
            // 서버에서 sanitize 한 HTML 또는 마크다운 렌더 결과로 교체한다.
            dangerouslySetInnerHTML={{ __html: article.bodyHtml }}
          />
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-card px-5 py-10 text-center">
            <p className="text-base font-bold text-foreground">
              본문 준비 중입니다
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              이 리서치의 전문은 곧 공개됩니다. 위 핵심 요약과 목차를 먼저
              확인해보세요.
            </p>
          </div>
        )}

        {/* 출처 */}
        <section className="border-t border-border pt-5">
          <h2 className="text-sm font-bold tracking-tight text-foreground">
            출처
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            온체인 데이터 및 시장 지표는 발행 시점 기준이며, Tradelab 리서치팀이
            정리했습니다. 수치는 거래소·온체인 데이터 제공처를 종합해 산출했습니다.
          </p>
        </section>

        {/* 액션 */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            className="h-9"
            disabled
            aria-label="PDF 내보내기 (준비 중)"
          >
            <FileDown className="size-4" />
            PDF 내보내기
          </Button>
          {article.naverUrl && (
            <Button asChild variant="ghost" className="h-9">
              <a
                href={article.naverUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="size-4" />
                네이버 원문
              </a>
            </Button>
          )}
        </div>
      </div>

      {/* 관련 리서치 */}
      {related.length > 0 && (
        <section className="mx-auto w-full max-w-[42rem] border-t border-border pt-6">
          <h2 className="text-base font-bold text-foreground">관련 리서치</h2>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {related.map((r) => (
              <RelatedCard key={r.slug} article={r} />
            ))}
          </div>
        </section>
      )}

      {/* 하단 뒤로가기 */}
      <div className="mx-auto w-full max-w-[42rem]">
        <Link
          href="/research"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          리서치 목록으로
        </Link>
      </div>
    </article>
  );
}

// ── 관련 리서치 카드 ──────────────────────────────────────────────
function RelatedCard({ article }: { article: ResearchSummary }) {
  const meta = researchSectorMeta(article.sector);
  return (
    <Link
      href={`/research/${article.slug}`}
      className="group flex flex-col gap-2 rounded-xl border border-border bg-card p-4 no-underline transition-shadow hover:shadow-md"
    >
      <div className="flex items-center gap-2">
        <span
          className="inline-flex items-center rounded-md px-2 py-0.5 text-[13px] font-bold"
          style={{ backgroundColor: meta.bg, color: meta.text }}
        >
          {meta.label}
        </span>
        <span className="text-sm text-muted-foreground">
          {RESEARCH_TYPE_LABEL[article.type]}
        </span>
      </div>
      <h3 className="text-base font-bold leading-snug tracking-tight text-foreground group-hover:text-primary">
        {article.title}
      </h3>
      <div className="mt-auto flex items-center gap-2 text-sm text-muted-foreground">
        <time dateTime={article.publishedAt}>
          {formatResearchDate(article.publishedAt)}
        </time>
        <span aria-hidden>·</span>
        <span>{article.readMinutes}분</span>
      </div>
    </Link>
  );
}

// ── 로딩 스켈레톤 ─────────────────────────────────────────────────
function ArticleSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">리서치를 불러오는 중입니다</span>
      {/* breadcrumb placeholder */}
      <div className="h-4 w-16 animate-pulse rounded bg-muted" />
      {/* 타이틀 블록 */}
      <header className="mx-auto w-full max-w-[42rem] border-b border-border pb-6">
        <div className="flex items-center gap-2">
          <div className="h-5 w-16 animate-pulse rounded bg-muted" />
          <div className="h-4 w-20 animate-pulse rounded bg-muted" />
        </div>
        <div className="mt-3 h-8 w-full animate-pulse rounded bg-muted" />
        <div className="mt-2 h-8 w-2/3 animate-pulse rounded bg-muted" />
        <div className="mt-4 h-5 w-full animate-pulse rounded bg-muted" />
        <div className="mt-5 flex items-center gap-3">
          <div className="size-9 animate-pulse rounded-full bg-muted" />
          <div className="h-4 w-48 animate-pulse rounded bg-muted" />
        </div>
      </header>
      {/* 본문 placeholder */}
      <div className="mx-auto flex w-full max-w-[42rem] flex-col gap-4">
        <div className="h-28 w-full animate-pulse rounded-xl bg-muted" />
        <div className="h-24 w-full animate-pulse rounded-xl bg-muted" />
        <div className="h-4 w-full animate-pulse rounded bg-muted" />
        <div className="h-4 w-11/12 animate-pulse rounded bg-muted" />
        <div className="h-4 w-10/12 animate-pulse rounded bg-muted" />
        <div className="h-4 w-full animate-pulse rounded bg-muted" />
        <div className="h-4 w-9/12 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}

// ── 에러 상태 (네트워크/서버) ─────────────────────────────────────
function ArticleError({
  onRetry,
  retrying,
}: {
  onRetry: () => void;
  retrying: boolean;
}) {
  return (
    <div className="mx-auto flex min-h-[50vh] w-full max-w-[42rem] flex-col items-center justify-center text-center">
      <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <AlertTriangle className="size-5" />
      </div>
      <h1 className="text-2xl font-bold text-foreground">
        리서치를 불러오지 못했어요
      </h1>
      <p className="mt-2 max-w-sm text-base text-muted-foreground">
        잠시 후 다시 시도해주세요. 문제가 계속되면 네트워크 연결을 확인해주세요.
      </p>
      <div className="mt-6 flex items-center gap-2">
        <Button variant="outline" onClick={onRetry} disabled={retrying}>
          <RotateCcw className={cn("size-4", retrying && "animate-spin")} />
          다시 시도
        </Button>
        <Button asChild variant="ghost">
          <Link href="/research">
            <ChevronLeft className="size-4" />
            리서치 목록으로
          </Link>
        </Button>
      </div>
    </div>
  );
}

// ── not-found ─────────────────────────────────────────────────────
function ArticleNotFound() {
  return (
    <div className="mx-auto flex min-h-[50vh] w-full max-w-[42rem] flex-col items-center justify-center text-center">
      <h1 className="text-2xl font-bold text-foreground">
        리서치를 찾을 수 없어요
      </h1>
      <p className="mt-2 text-base text-muted-foreground">
        요청하신 글이 존재하지 않거나 이동되었을 수 있어요.
      </p>
      <Button asChild className="mt-6">
        <Link href="/research">
          <ChevronLeft className="size-4" />
          리서치 목록으로
        </Link>
      </Button>
    </div>
  );
}
