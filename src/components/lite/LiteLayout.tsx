/**
 * LiteLayout — Lite 모드 전용 단순 레이아웃
 *
 * Pro 의 DashboardLayout 과 분리. cyberpunk 톤은 유지하되 채도/대비 ↓ 30%,
 * 큰 폰트(16-18px), 라운딩 12px, 사이드바 X (상단 nav 만).
 */

import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  TrendingUp,
  Wallet,
  BookOpen,
  Bell,
  Zap,
} from "lucide-react";

const navItems = [
  { path: "/lite", label: "오늘의 추천", icon: Sparkles },
  { path: "/lite/coin/BTCUSDT", label: "코인 살펴보기", icon: TrendingUp, partialMatch: "/lite/coin" },
  { path: "/lite/portfolio", label: "내 자산", icon: Wallet },
  { path: "/lite/learn", label: "용어 배우기", icon: BookOpen },
  { path: "/lite/alerts", label: "알림", icon: Bell },
];

export default function LiteLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();

  const handleSwitchToPro = () => {
    try {
      localStorage.setItem("tradelabMode", "pro");
    } catch {}
    setLocation("/");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top nav */}
      <header className="sticky top-0 z-30 border-b border-border/40 bg-card/80 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between flex-wrap gap-3">
          <Link href="/lite">
            <a className="flex items-center gap-2 cursor-pointer">
              <div className="h-8 w-8 rounded-lg bg-neon-pink/20 border border-neon-pink/40 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-neon-pink" />
              </div>
              <div>
                <div className="font-display text-sm font-bold tracking-wider text-neon-pink">
                  TRADELAB <span className="text-neon-cyan">LITE</span>
                </div>
                <div className="font-mono text-[9px] text-muted-foreground">
                  쉽게 보는 신호 · 일반인용
                </div>
              </div>
            </a>
          </Link>

          <Button
            size="sm"
            variant="outline"
            onClick={handleSwitchToPro}
            className="h-8 px-3 font-mono text-[11px] border-neon-cyan/40 text-neon-cyan hover:bg-neon-cyan/10"
          >
            <Zap className="h-3 w-3 mr-1" />
            Pro 모드로
          </Button>
        </div>

        {/* Sub-nav */}
        <nav className="max-w-5xl mx-auto px-4 pb-2 flex items-center gap-1 overflow-x-auto">
          {navItems.map((item) => {
            const isActive = item.partialMatch
              ? location.startsWith(item.partialMatch)
              : location === item.path;
            const Icon = item.icon;
            return (
              <Link key={item.path} href={item.path}>
                <a
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-[11px] transition-all whitespace-nowrap cursor-pointer",
                    isActive
                      ? "bg-neon-pink/15 text-neon-pink border border-neon-pink/40"
                      : "text-muted-foreground border border-transparent hover:text-foreground hover:bg-muted/30"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </a>
              </Link>
            );
          })}
        </nav>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-4 py-5 space-y-5">{children}</main>

      {/* Disclaimer */}
      <footer className="max-w-5xl mx-auto px-4 pb-8 pt-4 border-t border-border/30 mt-8">
        <p className="font-mono text-[10px] text-muted-foreground/80 leading-relaxed">
          ⚠️ 표시되는 모든 추천은 과거 데이터 기반의 *참고 신호*입니다. 미래 수익을
          보장하지 않으며, 투자 결정은 본인 책임입니다. 진입 시그널은 RSI / Bollinger
          Bands / ADX / 온체인 7-modifier 를 종합한 BBDX 시그널의 결과를 일반인이
          이해하기 쉬운 라벨로 번역한 것입니다.
        </p>
      </footer>
    </div>
  );
}
