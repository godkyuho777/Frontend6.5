/**
 * 리서치 이벤트 — 섹터별 알트코인 이벤트 캘린더 렌더 (2026-06-15).
 *
 * ResearchArticle 의 "주요 이벤트" 섹션에서 eventsForSector(article.sector) 결과를
 * 렌더. 각 이벤트는 날짜·상태(확정/목표/미확정)·코인·유형·임팩트·출처.
 * 헌장: 디스커버리/교육용. 단독 매매 시그널 아님.
 */

import type { ResearchEvent, ResearchEventStatus } from "@/lib/research-events";

const STATUS: Record<
  ResearchEventStatus,
  { label: string; bg: string; text: string }
> = {
  confirmed: { label: "확정", bg: "#EAF3DE", text: "#27500A" },
  target: { label: "목표", bg: "#FAEEDA", text: "#633806" },
  unconfirmed: { label: "미확정", bg: "#ECECEC", text: "#555555" },
};

export default function ResearchEvents({ events }: { events: ResearchEvent[] }) {
  if (!events.length) return null;
  return (
    <ol className="flex flex-col gap-2.5">
      {events.map((e, i) => {
        const s = STATUS[e.status];
        return (
          <li
            key={i}
            className="flex gap-3 rounded-lg border border-border bg-card p-3"
          >
            <div className="flex w-[5.5rem] shrink-0 flex-col gap-1.5">
              <time className="font-mono text-xs leading-tight text-muted-foreground">
                {e.date}
              </time>
              <span
                className="inline-flex w-fit items-center rounded px-1.5 py-0.5 text-[11px] font-bold"
                style={{ backgroundColor: s.bg, color: s.text }}
              >
                {s.label}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-bold text-foreground">
                  {e.coin}
                </span>
                <span className="text-xs text-muted-foreground">{e.type}</span>
              </div>
              <p className="mt-1 text-sm font-medium leading-snug text-foreground">
                {e.title}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                {e.impact}
                {e.source && (
                  <>
                    {" · "}
                    <a
                      href={e.source}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline"
                    >
                      출처
                    </a>
                  </>
                )}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
