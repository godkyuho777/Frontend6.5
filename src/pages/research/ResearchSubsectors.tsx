/**
 * 리서치 서브섹터 분해 — 섹터별 하위 서브섹터 렌더 (2026-06-15).
 *
 * ResearchArticle 의 "서브섹터 분해" 섹션에서 subsectorsForSector(article.sector)
 * 결과를 렌더. 각 서브섹터: 이름 · 상대강도(주도/중립/후행) · 정의 · 대표 토큰 ·
 * 현재 동인 · 출처. 헌장: 디스커버리/교육용, 단독 시그널 아님.
 */

import type { SubSector, SubSectorStrength } from "@/lib/research-subsectors";

const STRENGTH: Record<
  SubSectorStrength,
  { label: string; bg: string; text: string }
> = {
  leading: { label: "주도", bg: "#EAF3DE", text: "#27500A" },
  neutral: { label: "중립", bg: "#ECECEC", text: "#555555" },
  lagging: { label: "후행", bg: "#FAEEDA", text: "#633806" },
};

export default function ResearchSubsectors({
  subsectors,
}: {
  subsectors: SubSector[];
}) {
  if (!subsectors.length) return null;
  return (
    <ol className="flex flex-col gap-2.5">
      {subsectors.map((s, i) => {
        const st = STRENGTH[s.strength];
        return (
          <li
            key={i}
            className="rounded-lg border border-border bg-card p-3.5"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold tracking-tight text-foreground">
                {s.name}
              </span>
              <span
                className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-bold"
                style={{ backgroundColor: st.bg, color: st.text }}
              >
                {st.label}
              </span>
              <span className="text-xs text-muted-foreground">{s.what}</span>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {s.tokens.map((t) => (
                <span
                  key={t}
                  className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] font-bold text-foreground"
                >
                  {t}
                </span>
              ))}
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              {s.note}
              {s.source && (
                <>
                  {" · "}
                  <a
                    href={s.source}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    출처
                  </a>
                </>
              )}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
