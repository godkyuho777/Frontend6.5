/**
 * CompareV65V66Tab — Backtest 의 "v6.5 vs v6.6" 비교 탭.
 *
 * 현재 placeholder UI. CLI 결과 (`reports/v65-vs-v66-*.json`) 를 fetch 하는
 * tRPC 라우트가 신설되면 자동 연결. 본 컴포넌트는 향후 라우트가 추가될 때
 * 최소 수정으로 활성될 수 있도록 결과 표시 영역을 미리 갖춰둔다.
 *
 * 사용자 시나리오:
 *   1. 백엔드 `pnpm backtest:compare` 실행 → reports/ 디렉토리에 JSON 생성
 *   2. 향후 tRPC 라우트 (`trpc.backtest.compareResults` 가정) 가 디렉토리 인덱싱
 *   3. 본 탭에서 코인/TF 선택 → 결과 표시
 */

import { useState } from "react";
import { HudPanel } from "@/components/HudPanel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AlertCircle, FlaskConical, GitCompare, Info } from "lucide-react";

type CompareTf = "1h" | "4h" | "1d";

const SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "AAVEUSDT"];
const TFS: CompareTf[] = ["1h", "4h", "1d"];

export default function CompareV65V66Tab() {
  const [symbol, setSymbol] = useState<string>(SYMBOLS[0]);
  const [tf, setTf] = useState<CompareTf>("4h");

  // 향후 tRPC 라우트 추가 시 fetch — 현재는 placeholder
  // const { data: report } = trpc.backtest.compareV65V66.useQuery({ symbol, tf });
  const report: null = null;

  return (
    <div className="space-y-4">
      {/* 안내 카드 */}
      <HudPanel
        title="v6.5 vs v6.6 Compare"
        subtitle="BBDX 버전 비교 — CLI 결과 기반"
        variant="default"
      >
        <div className="space-y-3">
          <div className="flex items-start gap-2 p-3 bg-neon-yellow/5 border border-neon-yellow/30 rounded-sm">
            <Info className="h-4 w-4 text-neon-yellow shrink-0 mt-0.5" />
            <div className="space-y-1.5">
              <p className="font-mono text-xs text-foreground/90">
                이 비교는 백엔드 CLI{" "}
                <code className="px-1 py-0.5 bg-card/60 rounded-sm text-neon-cyan text-[11px]">
                  pnpm backtest:compare
                </code>{" "}
                실행 결과 (
                <code className="px-1 py-0.5 bg-card/60 rounded-sm text-neon-pink text-[11px]">
                  reports/v65-vs-v66-*.json
                </code>
                ) 기반.
              </p>
              <p className="font-mono text-[11px] text-muted-foreground">
                현재는 placeholder — 향후 tRPC 라우트
                (예: <code className="text-neon-cyan">backtest.compareV65V66</code>) 가
                추가되면 본 탭이 자동으로 결과 표시.
              </p>
            </div>
          </div>

          {/* 셀렉터 */}
          <div className="grid grid-cols-2 gap-3">
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
          </div>
        </div>
      </HudPanel>

      {/* 결과 영역 */}
      {report ? (
        // 향후 활성: 실제 비교 결과 표시
        <HudPanel
          title="Comparison Results"
          subtitle={`${symbol} · ${tf}`}
          variant="highlight"
        >
          <p className="font-mono text-xs text-muted-foreground py-4">
            결과 렌더링 영역 (라우트 추가 후 구현)
          </p>
        </HudPanel>
      ) : (
        <HudPanel
          title="No CLI Results"
          subtitle="CLI 미실행 — 백엔드에서 실행 필요"
        >
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <AlertCircle className="h-8 w-8 text-neon-yellow" />
            <p className="font-mono text-sm text-foreground/90">
              {symbol} · {tf} 의 비교 결과를 찾을 수 없습니다.
            </p>
            <div className="font-mono text-[11px] text-muted-foreground text-center max-w-md space-y-1">
              <p>
                백엔드 디렉토리 (<code className="text-neon-cyan">tradelab-backend/</code>) 에서
              </p>
              <code className="block px-2 py-1 bg-card/60 rounded-sm text-neon-pink">
                pnpm backtest:compare --symbol={symbol} --tf={tf}
              </code>
              <p className="mt-2">
                실행 후 결과가{" "}
                <code className="text-neon-cyan">
                  reports/v65-vs-v66-{symbol.toLowerCase()}-{tf}.json
                </code>{" "}
                에 저장됩니다.
              </p>
              <p className="text-muted-foreground/70 mt-2">
                (향후 본 탭이 라우트 추가 후 자동 노출 — 현재는 UI placeholder)
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled
              className="border-border/30 font-mono text-xs mt-2"
              title="향후 라우트 추가 시 활성"
            >
              <GitCompare className="h-3 w-3 mr-1.5" />
              REFRESH RESULTS (disabled)
            </Button>
          </div>
        </HudPanel>
      )}

      {/* 비교 메트릭 가이드 (placeholder layout) */}
      <HudPanel
        title="Expected Metrics"
        subtitle="CLI 출력에서 표시할 비교 메트릭"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {[
            { label: "Win Rate Δ", desc: "v6.6 - v6.5 (pp)" },
            { label: "Sharpe Δ", desc: "v6.6 - v6.5" },
            { label: "Max DD Δ", desc: "v6.6 - v6.5 (%)" },
            { label: "Total Trades", desc: "양 버전 진입 수" },
            { label: "Conflict Count", desc: "LONG+SHORT 동시 차단 횟수" },
            { label: "Calibrated Weights", desc: "v6.6 weight source 분포" },
          ].map((m) => (
            <div
              key={m.label}
              className="p-2 bg-card/40 border border-border/30 rounded-sm"
            >
              <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                {m.label}
              </div>
              <div className="font-mono text-[11px] text-foreground/70 mt-0.5">
                {m.desc}
              </div>
              <Badge className="mt-1.5 bg-muted/30 text-muted-foreground border-border/30 font-mono text-[9px]">
                <FlaskConical className="h-2 w-2 mr-0.5" />
                pending
              </Badge>
            </div>
          ))}
        </div>
      </HudPanel>
    </div>
  );
}
