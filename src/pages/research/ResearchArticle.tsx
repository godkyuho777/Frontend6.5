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
import { trpc } from "@/lib/trpc";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  RESEARCH_TYPE_LABEL,
  researchSectorMeta,
  formatResearchDate,
  type ResearchSummary,
  type ResearchDetail,
} from "@/lib/research-types";
import { SectorBadge } from "./ResearchList";
import ResearchChart from "./ResearchChart";
import { chartsForSlug } from "@/lib/research-charts";
import ResearchEvents from "./ResearchEvents";
import { eventsForSector } from "@/lib/research-events";
import ResearchSubsectors from "./ResearchSubsectors";
import { subsectorsForSector } from "@/lib/research-subsectors";

// ── PDF 내보내기 (클라이언트 인쇄) ────────────────────────────────
// 별도 창에 자체 완결형 A4 문서를 써서 인쇄(=PDF 저장)한다. 대시보드 크롬
// (사이드바/탑바)을 print CSS 로 분리하는 대신, 기사 데이터만으로 독립 문서를
// 구성 → 한글 폰트 안전 + 레이아웃 간섭 0. 본문(bodyHtml)은 백엔드 seed 의
// 신뢰된 정적 HTML.
function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildResearchPrintHtml(article: ResearchDetail): string {
  const typeLabel = RESEARCH_TYPE_LABEL[article.type];
  const sectorLabel = researchSectorMeta(article.sector).label;
  const dateStr = formatResearchDate(article.publishedAt);
  const kt =
    article.takeaways.length > 0
      ? `<section class="kt"><h2>핵심 요약</h2><ul>${article.takeaways
          .map((t) => `<li>${escHtml(t)}</li>`)
          .join("")}</ul></section>`
      : "";
  const css = `
    *{box-sizing:border-box;}
    html,body{margin:0;padding:0;}
    body{font-family:"42dot Sans","Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",sans-serif;color:#1a1a1a;line-height:1.7;}
    .page{max-width:760px;margin:0 auto;padding:28px 24px 48px;}
    .doc-head{border-bottom:2px solid #1a1a1a;padding-bottom:14px;margin-bottom:18px;}
    .brand{font-size:12px;font-weight:700;letter-spacing:.06em;color:#185adb;text-transform:uppercase;}
    .badges{font-size:12px;color:#666;margin-top:6px;}
    h1{font-size:24px;line-height:1.3;margin:8px 0 6px;letter-spacing:-.01em;}
    .dek{font-size:14px;color:#666;margin:0 0 8px;}
    .meta{font-size:12px;color:#666;}
    .kt{border:1px solid #185adb;border-radius:10px;background:rgba(24,90,219,.05);padding:14px 16px;margin:18px 0;}
    .kt h2{font-size:13px;color:#185adb;margin:0 0 8px;}
    .kt ul{margin:0;padding-left:18px;}
    .kt li{font-size:13px;margin:5px 0;}
    .print-btn{display:inline-block;margin:0 0 14px;padding:8px 14px;border:1px solid #e2e2e2;border-radius:8px;background:#fff;font:inherit;font-size:13px;cursor:pointer;}
    .doc-foot{margin-top:28px;border-top:1px solid #e2e2e2;padding-top:12px;font-size:11px;color:#666;}
    .prose-research{font-size:13.5px;line-height:1.75;}
    .prose-research h2{font-size:18px;margin:1.6em 0 .5em;line-height:1.3;}
    .prose-research h3{font-size:15px;margin:1.3em 0 .4em;}
    .prose-research p{margin:0 0 1em;}
    .prose-research a{color:#185adb;text-decoration:underline;word-break:break-all;}
    .prose-research ul,.prose-research ol{margin:0 0 1em;padding-left:1.3em;}
    .prose-research li{margin:.3em 0;}
    .prose-research blockquote{margin:1.4em 0;padding:.8em 0;border-top:1px solid #e2e2e2;border-bottom:1px solid #e2e2e2;font-style:italic;font-size:15px;}
    .prose-research blockquote p{margin:0;}
    .prose-research figure{display:none;}
    .prose-research .prose-table-wrap{border:1px solid #e2e2e2;border-radius:8px;margin:1.2em 0;}
    .prose-research table{width:100%;border-collapse:collapse;font-size:12px;}
    .prose-research th,.prose-research td{padding:6px 10px;text-align:left;border-bottom:1px solid #e2e2e2;vertical-align:top;}
    .prose-research thead th{background:#fafafa;font-weight:700;}
    .prose-research td.num,.prose-research th.num{text-align:right;font-variant-numeric:tabular-nums;}
    .prose-research .prose-callout{margin:1.3em 0;padding:10px 12px;border:1px solid #e2e2e2;border-radius:8px;background:#fafafa;}
    .prose-research .prose-callout[data-variant="warn"]{border-color:rgba(252,103,54,.4);background:rgba(252,103,54,.06);}
    .prose-research .prose-callout p{margin:0;font-size:12.5px;}
    @page{size:A4;margin:16mm;}
    @media print{.no-print{display:none !important;}.page{max-width:none;padding:0;}}
  `;
  return `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escHtml(
    article.title,
  )} · Tradelab 리서치</title><style>${css}</style></head><body><div class="page"><button class="print-btn no-print" onclick="window.print()">인쇄 / PDF로 저장</button><header class="doc-head"><div class="brand">Tradelab 리서치</div><div class="badges">${escHtml(
    sectorLabel,
  )} · ${escHtml(typeLabel)}</div><h1>${escHtml(article.title)}</h1><p class="dek">${escHtml(
    article.dek,
  )}</p><div class="meta">${escHtml(article.author)} · ${escHtml(
    dateStr,
  )} · ${article.readMinutes}분 읽기</div></header>${kt}<main class="prose-research">${
    article.bodyHtml ?? ""
  }</main><footer class="doc-foot">© Tradelab 리서치 — 본 문서는 시장 구조 분석·교육 목적이며 투자 자문이 아닙니다. 과거 성과는 미래를 보장하지 않습니다. (사이트 PDF 내보내기로 생성)</footer></div><script>window.addEventListener("load",function(){setTimeout(function(){try{window.print();}catch(e){}},350);});</script></body></html>`;
}

function handleExportResearchPdf(article: ResearchDetail): void {
  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) {
    toast("PDF 내보내기를 열 수 없어요", {
      description:
        "팝업이 차단된 것 같아요. 팝업을 허용하거나, 페이지에서 Ctrl+P 로 저장하세요.",
    });
    return;
  }
  w.document.open();
  w.document.write(buildResearchPrintHtml(article));
  w.document.close();
}

export default function ResearchArticlePage() {
  const [, params] = useRoute("/research/:slug");
  const slug = params?.slug ?? "";
  const charts = chartsForSlug(slug);

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
  const events = eventsForSector(article.sector);
  const subsectors = subsectorsForSector(article.sector);

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

        {/* 서브섹터 분해 — 섹터를 하위 서브섹터로 세분 (Messari 식) */}
        {subsectors.length > 0 && (
          <section className="flex flex-col gap-3 border-t border-border pt-5">
            <div>
              <h2 className="text-sm font-bold tracking-tight text-foreground">
                서브섹터 분해
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                이 섹터를 하위 서브섹터로 세분 — 리서치 상대강도 + 라이브 24h 집계 · 대표 토큰 · 동인
              </p>
            </div>
            <ResearchSubsectors subsectors={subsectors} />
          </section>
        )}

        {/* 주요 데이터 (차트) — slug 별 프론트 차트 데이터 (as-of·출처 캡션) */}
        {charts.length > 0 && (
          <section className="flex flex-col gap-4 border-t border-border pt-5">
            <h2 className="text-sm font-bold tracking-tight text-foreground">
              주요 데이터
            </h2>
            {charts.map((spec, i) => (
              <ResearchChart key={i} spec={spec} />
            ))}
          </section>
        )}

        {/* 주요 이벤트 (섹터별 알트코인 이벤트 캘린더) */}
        {events.length > 0 && (
          <section className="flex flex-col gap-3 border-t border-border pt-5">
            <div>
              <h2 className="text-sm font-bold tracking-tight text-foreground">
                주요 이벤트
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                이 섹터 알트코인의 하드포크·업그레이드·언락·규제 일정 (확정/목표/미확정 표기)
              </p>
            </div>
            <ResearchEvents events={events} />
          </section>
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
            onClick={() => handleExportResearchPdf(article)}
            aria-label="PDF 내보내기"
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
