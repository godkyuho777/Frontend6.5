import { HudPanel } from "@/components/HudPanel";
import { Badge } from "@/components/ui/badge";
import { TrackerHub } from "@/components/trackers/TrackerHub";
import { useLocation } from "wouter";
import { ArrowRight, Database } from "lucide-react";

/**
 * Layer 3 — Macro Tracker Hub.
 *
 * 수개월~수년 거시 컨텍스트. 6차원 매크로 — 시장 폭, 펀딩 극단치, (향후) 금리·DXY·VIX.
 * 7차원 온체인은 별도 Onchain Tracker (`/onchain`) 로 분리.
 */
export default function MacroTrackerHub() {
  const [, setLocation] = useLocation();

  const onchainLink = (
    <div className="space-y-2">
      <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        7차원 — 별도 Hub
      </div>
      <button
        type="button"
        onClick={() => setLocation("/onchain")}
        className="text-left w-full"
      >
        <HudPanel
          variant="highlight"
          className="hover:border-neon-pink/60 hover:shadow-[0_0_24px_rgba(255,46,160,0.15)] transition-all cursor-pointer"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-neon-cyan" />
                <h3 className="font-display text-sm font-bold tracking-wider uppercase text-neon-pink glow-pink">
                  Onchain Tracker
                </h3>
              </div>
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                <Badge
                  variant="outline"
                  className="font-mono text-[9px] border-neon-cyan/40 text-neon-cyan"
                >
                  7차원 온체인
                </Badge>
                <Badge
                  variant="outline"
                  className="font-mono text-[9px] border-neon-cyan/40 text-neon-cyan"
                >
                  CHARTER LAYER
                </Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                Coinbase Premium · SSR · 7차원 modifier 합산. 매크로와 분리된 별도 Hub.
              </p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground/60 shrink-0 mt-1" />
          </div>
        </HudPanel>
      </button>
    </div>
  );

  return (
    <TrackerHub
      layer="macro"
      title="Macro Tracker"
      subtitle="Layer 3 — 수개월~수년 거시 컨텍스트"
      dimensionBadge="6 차원"
      explanation={
        "6차원 매크로 — 시장 폭, 펀딩 극단치, (향후) 금리·DXY·VIX. " +
        "7차원 온체인은 별도 Onchain Tracker (/onchain) 로 분리."
      }
      extraSlot={onchainLink}
    />
  );
}
