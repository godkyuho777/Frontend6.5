/**
 * 리서치 서브섹터 분해 — 섹터별 하위 서브섹터 렌더 (2026-06-15, +라이브 연동).
 *
 * ResearchArticle 의 "서브섹터 분해" 섹션에서 subsectorsForSector(article.sector)
 * 결과를 렌더. 각 서브섹터: 이름 · **리서치 상대강도(주도/중립/후행)** + **라이브
 * 24h 집계**(서브섹터 대표 토큰들의 Bybit 24h 평균, 클라이언트 사이드) · 정의 ·
 * 대표 토큰 · 현재 동인 · 출처.
 *
 * 라이브 데이터는 브라우저 직접 Bybit 호출(SectorPulse 와 동일 경로). 호출 실패·
 * 토큰 미상장 시 라이브 배지는 graceful 하게 숨고 정적 리서치 라벨만 남는다.
 * 헌장: 디스커버리/교육용, 단독 시그널 아님.
 */

import { useEffect, useState } from "react";
import { fetchAll24hTickers } from "@/lib/bybit-client";
import type { SubSector, SubSectorStrength } from "@/lib/research-subsectors";

type Tickers = Map<
  string,
  { price: number; change24h: number; volume24h: number }
>;

const STRENGTH: Record<
  SubSectorStrength,
  { label: string; bg: string; text: string }
> = {
  leading: { label: "주도", bg: "#EAF3DE", text: "#27500A" },
  neutral: { label: "중립", bg: "#ECECEC", text: "#555555" },
  lagging: { label: "후행", bg: "#FAEEDA", text: "#633806" },
};

/** 서브섹터 대표 토큰들의 라이브 24h 평균 (가용 토큰만). */
function liveAvg(
  tokens: string[],
  tickers: Tickers,
): { avg: number; n: number; total: number } | null {
  const vals: number[] = [];
  for (const t of tokens) {
    const tk = tickers.get(`${t}USDT`);
    if (tk && Number.isFinite(tk.change24h)) vals.push(tk.change24h);
  }
  if (!vals.length) return null;
  return {
    avg: vals.reduce((a, b) => a + b, 0) / vals.length,
    n: vals.length,
    total: tokens.length,
  };
}

export default function ResearchSubsectors({
  subsectors,
}: {
  subsectors: SubSector[];
}) {
  const [tickers, setTickers] = useState<Tickers | null>(null);

  useEffect(() => {
    let alive = true;
    fetchAll24hTickers()
      .then((m) => {
        if (alive) setTickers(m);
      })
      .catch(() => {
        /* 라이브 실패 시 정적 라벨만 — graceful */
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!subsectors.length) return null;

  return (
    <ol className="flex flex-col gap-2.5">
      {subsectors.map((s, i) => {
        const st = STRENGTH[s.strength];
        const live = tickers ? liveAvg(s.tokens, tickers) : null;
        const up = live ? live.avg >= 0 : false;
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
              {live && (
                <span
                  className="inline-flex items-center rounded px-1.5 py-0.5 font-mono text-[11px] font-bold"
                  style={{
                    backgroundColor: up ? "#EAF3DE" : "#FCEAF1",
                    color: up ? "#27500A" : "#7A1D45",
                  }}
                  title={`서브섹터 토큰 ${live.n}/${live.total}개 Bybit 24h 평균 (라이브)`}
                >
                  24h {up ? "+" : ""}
                  {live.avg.toFixed(1)}%
                </span>
              )}
              <span className="text-xs text-muted-foreground">{s.what}</span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              {s.tokens.map((t) => (
                <span
                  key={t}
                  className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] font-bold text-foreground"
                >
                  {t}
                </span>
              ))}
              {live && (
                <span className="text-[10px] text-muted-foreground">
                  · 라이브 {live.n}/{live.total}
                </span>
              )}
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
