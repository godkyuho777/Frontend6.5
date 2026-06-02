/**
 * DimensionBreakdown — 7차원 multiplier breakdown.
 *
 * v6.5 머지 후 useCoinSignal.dimensions 가 채워지면 BarChart 표시.
 * 현재는 placeholder + VWAP detail (4번 거래량/유동성 + 5번 시장 구조 카드).
 *
 * VWAP detail 은 `trpc.vwap.detail` 에서 옴 (백엔드 v6.5).
 *  - 4번 거래량/유동성 → Volume Profile (POC, HVN, LVN) 강화
 *  - 5번 시장 구조    → Pullback v2 + Multi-TF Alignment 강화
 *
 * 헌장 규칙 3 — VWAP 정보는 BBDX 의 보조 차원으로만 표시.
 */

import type { CoinSignal } from "../hooks/useCoinSignal";
import type { VwapDetailLite } from "../hooks/useVwapDetail";
import { cn } from "@/lib/utils";

interface DimensionBreakdownProps {
  signal: CoinSignal | null;
  /** v6.5 — `trpc.vwap.detail` 응답. 4번/5번 차원 카드 강화 데이터 */
  vwapDetail?: VwapDetailLite;
}

export function DimensionBreakdown({ signal, vwapDetail }: DimensionBreakdownProps) {
  return (
    <div className="space-y-4">
      {/* === 7-dimension multiplier breakdown ===================== */}
      {signal?.dimensions ? (
        <div className="space-y-3">
          <p className="font-mono text-xs text-muted-foreground">
            7차원 세부 분석 · v6.5 dimensions
          </p>
          {Object.entries(signal.dimensions).map(([key, value]) => (
            <div key={key} className="flex items-center gap-3">
              <span className="font-mono text-[11px] text-muted-foreground uppercase tracking-wider w-20">
                {key}
              </span>
              <div className="flex-1 h-2 bg-muted/30 rounded-sm overflow-hidden">
                <div
                  className="h-full bg-neon-cyan"
                  style={{ width: `${Math.min(100, (value as number) * 100)}%` }}
                />
              </div>
              <span className="font-mono text-xs text-foreground w-10 text-right">
                {(value as number).toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-8 gap-2 border border-border/20 rounded-sm bg-card/30">
          <p className="font-mono text-xs text-muted-foreground">
            7차원 세부 분석
          </p>
          <p className="font-mono text-[10px] text-muted-foreground/70 max-w-md text-center leading-relaxed">
            현재 시그널 엔진은 BBDX-PATTERN v6.1 (5차원). v6.5 머지 후 onchain ·
            macro 차원이 추가되면 차원별 가중치 막대그래프가 자동 표시됩니다.
          </p>
        </div>
      )}

      {/* === Dim 4 — 거래량 / 유동성 (Volume Profile) =============== */}
      {/* === Dim 5 — 시장 구조 (Pullback v2 + Multi-TF) ============ */}
      {vwapDetail && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <DimVolumeProfileCard detail={vwapDetail} />
          <DimMarketStructureCard detail={vwapDetail} />
        </div>
      )}
      {!vwapDetail && (
        <p className="font-mono text-[10px] text-muted-foreground/60 text-center py-2">
          VWAP detail (4번/5번 차원 강화 데이터) 로딩 중 또는 백엔드 미배포
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub cards — Dim 4 / Dim 5 강화
// ---------------------------------------------------------------------------

function DimVolumeProfileCard({ detail }: { detail: VwapDetailLite }) {
  const vp = detail.volumeProfile;
  return (
    <div className="rounded-sm border border-neon-cyan/20 bg-card/40 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] text-neon-cyan uppercase tracking-wider">
          Dim 4 · 거래량 / 유동성
        </span>
        <span className="font-mono text-[9px] text-muted-foreground">VP</span>
      </div>
      <div className="space-y-1 font-mono text-[11px]">
        <div className="flex justify-between">
          <span className="text-muted-foreground">POC</span>
          <span className="text-foreground">
            ${vp.poc < 1 ? vp.poc.toFixed(5) : vp.poc.toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">HVN</span>
          <span className="text-neon-cyan">{vp.hvnList.length}개</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">LVN</span>
          <span className="text-muted-foreground">{vp.lvnList.length}개</span>
        </div>
        <div className="flex justify-between pt-1 border-t border-border/20">
          <span className="text-muted-foreground">Value Area</span>
          <span className="text-foreground/80">
            {(vp.valueArea.pct * 100).toFixed(0)}%
          </span>
        </div>
      </div>
    </div>
  );
}

const ALIGNMENT_LABEL: Record<
  VwapDetailLite["multiTfAlignment"]["alignmentLevel"],
  { label: string; cls: string }
> = {
  aligned: { label: "ALIGNED", cls: "text-neon-green" },
  partial: { label: "PARTIAL", cls: "text-neon-yellow" },
  mixed: { label: "MIXED", cls: "text-neon-pink" },
  neutral: { label: "NEUTRAL", cls: "text-muted-foreground" },
};

function DimMarketStructureCard({ detail }: { detail: VwapDetailLite }) {
  const pb = detail.pullbackV2;
  const mt = detail.multiTfAlignment;
  const align = ALIGNMENT_LABEL[mt.alignmentLevel];
  const pbStatus = pb.bounceConfirmed
    ? { label: "✓ 반등 확인", cls: "text-neon-green" }
    : pb.detected
      ? { label: "⚠ 터치만", cls: "text-neon-yellow" }
      : { label: "✗ 미감지", cls: "text-muted-foreground" };
  return (
    <div className="rounded-sm border border-neon-pink/20 bg-card/40 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] text-neon-pink uppercase tracking-wider">
          Dim 5 · 시장 구조
        </span>
        <span className="font-mono text-[9px] text-muted-foreground">
          PB · MTF
        </span>
      </div>
      <div className="space-y-1 font-mono text-[11px]">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Pullback</span>
          <span className={cn(pbStatus.cls)}>{pbStatus.label}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">터치 라인</span>
          <span className="text-foreground">
            {pb.touchedLine ? pb.touchedLine.toUpperCase() : "—"}
          </span>
        </div>
        <div className="flex justify-between pt-1 border-t border-border/20">
          <span className="text-muted-foreground">Multi-TF</span>
          <span className={cn(align.cls)}>{align.label}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">가중치</span>
          <span className="text-neon-cyan">×{mt.multiplier.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
