import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { ModeSwitchControl } from "@/components/ModeSwitchControl";
import { SignInDialog } from "@/components/SignInDialog";
import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Bell,
  BookOpen,
  LogIn,
  TrendingUp,
  Wallet,
} from "lucide-react";

const navItems = [
  { path: "/lite", label: "오늘의 추천", icon: TrendingUp },
  {
    path: "/lite/coin/BTCUSDT",
    label: "코인 살펴보기",
    icon: TrendingUp,
    partialMatch: "/lite/coin",
  },
  { path: "/lite/portfolio", label: "내 자산", icon: Wallet },
  { path: "/lite/learn", label: "용어 배우기", icon: BookOpen },
  { path: "/lite/alerts", label: "알림", icon: Bell },
];

export default function LiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // <title> 동기화 — /lite/coin/:symbol 은 심볼을, 그 외에는 활성 탭 라벨을 사용.
  const docTitle = useMemo(() => {
    const coin = location.match(/^\/lite\/coin\/([^/?#]+)/);
    if (coin) return decodeURIComponent(coin[1]).replace("USDT", "/USDT");
    return navItems.find(item => isLiteItemActive(location, item))?.label;
  }, [location]);
  useDocumentTitle(docTitle);

  return (
    <div className="min-h-screen bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-2 focus:z-[60] focus:rounded-md focus:bg-foreground focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-background"
      >
        본문으로 건너뛰기
      </a>
      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-5 border-b border-border bg-card px-4 lg:px-5">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileMenuOpen}
          onClick={() => setMobileMenuOpen(open => !open)}
          className="relative -ml-1 md:hidden"
        >
          <span
            className={cn(
              "absolute h-0.5 w-4 rounded-full bg-current transition-transform duration-200 ease-out",
              mobileMenuOpen
                ? "translate-y-0 rotate-45"
                : "-translate-y-[3px] rotate-0"
            )}
          />
          <span
            className={cn(
              "absolute h-0.5 w-4 rounded-full bg-current transition-transform duration-200 ease-out",
              mobileMenuOpen
                ? "translate-y-0 -rotate-45"
                : "translate-y-[3px] rotate-0"
            )}
          />
        </Button>

        <Link
          href="/lite"
          className="flex shrink-0 items-center gap-2.5 hover:no-underline"
        >
          <img
            src="/design-system/assets/tradelab-wordmark.svg"
            alt="tradelab"
            className="h-[18px] w-auto"
          />
        </Link>

        <nav className="hidden min-w-0 flex-1 items-center justify-center gap-1 overflow-x-auto md:flex">
          {navItems.map(item => {
            const isActive = item.partialMatch
              ? location.startsWith(item.partialMatch)
              : location === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                href={item.path}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md px-3 font-sans text-[11px] font-bold transition-all",
                  isActive
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="size-3.5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex shrink-0 items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="알림 설정"
            onClick={() => setLocation("/lite/alerts")}
          >
            <Bell className="size-5" />
          </Button>
          <ModeSwitchControl mode="lite" className="hidden md:flex" />
          {user ? (
            <Avatar className="size-8 bg-blue-950 text-white">
              <AvatarFallback className="bg-blue-950 text-xs font-bold text-white">
                {user.name?.slice(0, 2).toUpperCase() || "YN"}
              </AvatarFallback>
            </Avatar>
          ) : (
            <SignInDialog>
              <Button size="sm" variant="ghost" className="h-8">
                <LogIn className="size-3.5" />
                Sign in
              </Button>
            </SignInDialog>
          )}
        </div>
      </header>

      <LiteMobileMenuOverlay
        open={mobileMenuOpen}
        location={location}
        onClose={() => setMobileMenuOpen(false)}
        onNavigate={path => {
          setLocation(path);
          setMobileMenuOpen(false);
        }}
      />

      <main
        id="main-content"
        tabIndex={-1}
        className="max-w-5xl mx-auto px-4 pb-5 pt-[76px] outline-none"
      >
        {children}
      </main>

      <footer className="max-w-5xl mx-auto mt-8 border-t border-border px-4 pb-8 pt-4">
        <p className="flex gap-2 font-sans text-[10px] leading-relaxed text-muted-foreground/80">
          <AlertTriangle className="mt-0.5 size-3 shrink-0 text-primary" />
          <span>
            표시되는 모든 추천은 과거 데이터 기반의 참고 신호입니다. 미래 수익을
            보장하지 않으며, 투자 결정은 본인 책임입니다. 진입 시그널은 RSI /
            Bollinger Bands / ADX / 온체인 7-modifier 를 종합한 BBDX 시그널의
            결과를 일반인이 이해하기 쉬운 라벨로 번역한 것입니다.
          </span>
        </p>
      </footer>
    </div>
  );
}

function isLiteItemActive(location: string, item: (typeof navItems)[number]) {
  return item.partialMatch
    ? location.startsWith(item.partialMatch)
    : location === item.path;
}

function LiteMobileMenuOverlay({
  open,
  location,
  onClose,
  onNavigate,
}: {
  open: boolean;
  location: string;
  onClose: () => void;
  onNavigate: (path: string) => void;
}) {
  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 top-14 z-[38] transition-[visibility] duration-300 md:hidden",
        open ? "visible" : "invisible"
      )}
      aria-hidden={!open}
    >
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        className={cn(
          "absolute inset-0 bg-black/15 transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0"
        )}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="lite-mobile-menu-title"
        className={cn(
          "absolute bottom-0 left-0 top-0 flex w-[min(86vw,340px)] flex-col border-r border-border bg-card transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-5 py-4">
          <h2
            id="lite-mobile-menu-title"
            className="px-3 pb-2 pt-1 font-sans text-base font-bold text-foreground"
          >
            Menu
          </h2>
          <div className="flex flex-col gap-1">
            <div className="px-3 pb-1 pt-2 text-[10px] font-bold tracking-[0.06em] text-muted-foreground">
              Lite
            </div>
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = isLiteItemActive(location, item);
              return (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => onNavigate(item.path)}
                  className={cn(
                    "flex h-10 w-full items-center gap-3 rounded-md px-3 text-left text-sm font-medium transition-colors",
                    isActive
                      ? "bg-foreground text-background"
                      : "text-foreground hover:bg-muted"
                  )}
                >
                  <Icon className="size-[18px]" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="shrink-0 border-t border-border bg-card px-5 py-4">
          <ModeSwitchControl
            mode="lite"
            className="h-10 w-full justify-between bg-muted px-3"
          />
        </div>
      </aside>
    </div>
  );
}
