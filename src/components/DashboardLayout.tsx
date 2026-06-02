import { useAuth } from "@/_core/hooks/useAuth";
import { SignInDialog } from "@/components/SignInDialog";
import { SearchField } from "@/components/SearchField";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  Activity,
  ArrowUp,
  BarChart2,
  BarChart3,
  Bell,
  Coins,
  Copy,
  Database,
  FlaskConical,
  HeartPulse,
  History,
  LogIn,
  Loader2,
  Megaphone,
  Minus,
  Plus,
  Radar,
  Ruler,
  Settings2,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  Wallet,
  Waves,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Streamdown } from "streamdown";
import { useLocation } from "wouter";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { BackendBranchIndicator } from "./BackendBranchIndicator";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { ModeSwitchControl } from "./ModeSwitchControl";

type MenuChild = { icon: LucideIcon; label: string; path: string };
type MenuItem = {
  icon: LucideIcon;
  label: string;
  path: string;
  children?: MenuChild[];
};

type NotificationItem = {
  id: string;
  icon: LucideIcon;
  header: string;
  content: string;
  date: string;
};

type AiExchange = {
  id: string;
  query: string;
  response?: string;
  loading?: boolean;
};

const workspaceItems: MenuItem[] = [
  {
    icon: Activity,
    label: "시그널 스캐너",
    path: "/",
    children: [
      { icon: BarChart3, label: "RSI · BB · ADX", path: "/" },
      { icon: Ruler, label: "피보나치 · 추세선", path: "/fibonacci" },
      { icon: TrendingUp, label: "VWAP 전략", path: "/vwap" },
      {
        icon: TrendingUp,
        label: "EMA · ADX 정배열",
        path: "/trackers/ema-adx-trend",
      },
      {
        icon: Megaphone,
        label: "전인구 시그널 (베타)",
        path: "/trackers/jeon-in-gu",
      },
    ],
  },
  {
    icon: Waves,
    label: "웨이브 트래커",
    path: "/wave",
    children: [
      { icon: Waves, label: "투자심리 · 매트릭스", path: "/wave/sentiment" },
      { icon: TrendingUp, label: "추세 분석", path: "/wave/trend" },
    ],
  },
  {
    icon: BarChart2,
    label: "매크로 유동성",
    path: "/macro",
    children: [
      { icon: Activity, label: "개요", path: "/macro" },
      { icon: TrendingUp, label: "SOFR-IORB 스프레드", path: "/macro/sofr" },
      { icon: TrendingUp, label: "수익률 곡선", path: "/macro/yield-curve" },
      { icon: Database, label: "Fed 대차대조표", path: "/macro/walcl" },
      { icon: BarChart3, label: "DXY · VIX", path: "/macro/dxy-vix" },
      { icon: TrendingUp, label: "실질 금리", path: "/macro/real-rate" },
    ],
  },
  { icon: BarChart3, label: "테크니컬 트래커 (Pro)", path: "/tech-tracker" },
  { icon: FlaskConical, label: "백테스팅", path: "/backtest" },
  {
    icon: Wallet,
    label: "모의 투자",
    path: "/simulator",
    children: [
      { icon: Wallet, label: "거래", path: "/simulator" },
      { icon: Trophy, label: "리더보드", path: "/simulator/leaderboard" },
    ],
  },
  { icon: Database, label: "온체인 데이터", path: "/onchain" },
  { icon: Radar, label: "섹터 동향", path: "/sectors" },
];

const accountItems: MenuItem[] = [
  { icon: Target, label: "내 포지션", path: "/positions" },
  { icon: History, label: "시그널 기록", path: "/history" },
  { icon: Bell, label: "알림 설정", path: "/alerts" },
  { icon: Sparkles, label: "헌장 · 비전", path: "/charter" },
  { icon: HeartPulse, label: "시스템 상태", path: "/admin/health" },
  {
    icon: Settings2,
    label: "캘리브레이션",
    path: "/admin/calibration",
  },
];

const menuSections = [
  { title: "워크스페이스", items: workspaceItems },
  { title: "계정", items: accountItems },
];

const menuItems: MenuItem[] = menuSections.flatMap(section => section.items);

const aiSuggestedQuestions = [
  "현재 BTC 시장 상황을 분석해주세요",
  "ADX가 낮을 때 볼린저밴드 전략의 효과는?",
  "관심 종목의 RSI·볼린저밴드 시그널을 비교해주세요",
  "지금 시장에서 가장 큰 리스크를 요약해주세요",
];

// 알림은 실시간 시그널 백엔드가 붙기 전까지 비워 둔다. 과거에는 고정 타임스탬프
// ("Today, 09:42") 가 박힌 가짜 시장 알림 3개가 항상 노출돼, 실제 시장 이벤트가
// 발생한 것처럼 사용자를 오인시켰다 (정보 정확성 위반). 빈 상태 UI 가 이미 있으므로
// 가짜 데이터를 제거하고 정직한 "No notifications" 상태를 보여준다.
const initialNotifications: NotificationItem[] = [];

function isItemActive(location: string, item: MenuItem) {
  if (item.children?.some(child => location === child.path)) return true;
  if (item.path === "/") return location === "/";
  if (location === item.path) return true;
  return false;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { loading } = useAuth();

  if (loading) {
    return <DashboardLayoutSkeleton />;
  }

  return <DashboardShell>{children}</DashboardShell>;
}

function DashboardShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState(initialNotifications);

  const activeLabel = useMemo(() => {
    const child = menuItems
      .flatMap(item => item.children ?? [])
      .find(item => item.path === location);
    if (child) return child.label;
    return (
      menuItems.find(item => isItemActive(location, item))?.label ?? "마켓"
    );
  }, [location]);

  // <title> 동기화 — 동적 상세 라우트(/coin/:symbol 등)는 심볼을 우선 노출하고,
  // 그 외에는 활성 메뉴 라벨을 사용한다. 레이아웃 한 곳에서만 계산해 race 방지.
  const docTitle = useMemo(() => {
    const detail = location.match(
      /^\/(?:coin|fibonacci|vwap|trackers\/ema-adx-trend)\/([^/?#]+)/
    );
    if (detail) {
      return decodeURIComponent(detail[1]).replace("USDT", "/USDT");
    }
    return activeLabel;
  }, [location, activeLabel]);
  useDocumentTitle(docTitle);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-2 focus:z-[60] focus:rounded-md focus:bg-foreground focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-background"
      >
        본문으로 건너뛰기
      </a>
      <TopBar
        user={user}
        mobileMenuOpen={mobileMenuOpen}
        onMobileMenuToggle={() => setMobileMenuOpen(open => !open)}
        onNotificationsOpen={() => setNotificationsOpen(true)}
        notificationCount={notifications.length}
      />
      <aside className="fixed bottom-0 left-0 top-14 z-30 hidden w-[220px] flex-col border-r border-border bg-card lg:flex">
        <nav className="relative z-0 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
          <SidebarMenuList
            sections={menuSections}
            location={location}
            onNavigate={setLocation}
          />
        </nav>
        <div className="relative z-10 shrink-0 border-t border-border bg-card px-6 py-4 shadow-[0_-8px_20px_rgb(255_255_255_/_90%)]">
          <div className="font-mono text-[10px] text-muted-foreground/70">
            v6.5 · build {__BUILD_DATE__}
          </div>
        </div>
      </aside>

      <main
        id="main-content"
        tabIndex={-1}
        className="fixed inset-x-0 bottom-0 top-14 overflow-y-auto bg-muted p-4 pb-28 outline-none md:p-6 md:pb-28 lg:left-[220px]"
      >
        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4">
          <div className="flex items-center justify-between gap-3 lg:hidden">
            <div>
              <div className="text-[10px] font-bold tracking-[0.06em] text-muted-foreground">
                워크스페이스
              </div>
              <h1 className="text-xl font-bold tracking-tight">
                {activeLabel}
              </h1>
            </div>
          </div>
          {children}
        </div>
      </main>
      <MobileMenuOverlay
        open={mobileMenuOpen}
        location={location}
        onClose={() => setMobileMenuOpen(false)}
        onNavigate={path => {
          setLocation(path);
          setMobileMenuOpen(false);
        }}
      />
      <NotificationOverlay
        open={notificationsOpen}
        notifications={notifications}
        onClose={() => setNotificationsOpen(false)}
        onClearAll={() => setNotifications([])}
      />
      <AiInsightOverlay hidden={mobileMenuOpen} />
    </div>
  );
}

function TopBar({
  user,
  mobileMenuOpen,
  onMobileMenuToggle,
  onNotificationsOpen,
  notificationCount,
}: {
  user: ReturnType<typeof useAuth>["user"];
  mobileMenuOpen: boolean;
  onMobileMenuToggle: () => void;
  onNotificationsOpen: () => void;
  notificationCount: number;
}) {
  return (
    <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-5 border-b border-border bg-card px-4 lg:px-5">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
        aria-expanded={mobileMenuOpen}
        onClick={onMobileMenuToggle}
        className="relative -ml-1 lg:hidden"
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
      <a
        href="/"
        className="flex shrink-0 items-center gap-2.5 hover:no-underline"
      >
        <img
          src="/design-system/assets/tradelab-wordmark.svg"
          alt="tradelab"
          className="h-[18px] w-auto"
        />
      </a>

      <SearchField
        wrapperClassName="hidden max-w-[480px] flex-1 md:flex"
        shortcut="⌘K"
        aria-label="마켓, 전략, 주소 검색"
        placeholder="마켓 · 전략 · 주소 검색..."
      />

      <div className="ml-auto flex items-center gap-2">
        <BackendBranchIndicator variant="topbar" />
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Notifications"
          onClick={onNotificationsOpen}
          className="relative"
        >
          <Bell className="size-5" />
          {notificationCount > 0 && (
            <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-primary" />
          )}
        </Button>
        <ModeSwitchControl mode="pro" className="hidden md:flex" />
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
              로그인
            </Button>
          </SignInDialog>
        )}
      </div>
    </header>
  );
}

function NotificationOverlay({
  open,
  notifications,
  onClose,
  onClearAll,
}: {
  open: boolean;
  notifications: NotificationItem[];
  onClose: () => void;
  onClearAll: () => void;
}) {
  return (
    <div
      className={cn(
        "fixed inset-0 z-50 transition-[visibility] duration-300",
        open ? "visible" : "invisible"
      )}
      aria-hidden={!open}
    >
      <button
        type="button"
        aria-label="알림 닫기"
        onClick={onClose}
        className={cn(
          "absolute inset-0 bg-black/20 transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0"
        )}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="notification-panel-title"
        className={cn(
          "absolute right-0 top-0 flex h-full w-full flex-col bg-card transition-transform duration-300 ease-out md:max-w-[420px]",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex h-14 shrink-0 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="알림 닫기"
              onClick={onClose}
            >
              <X className="size-4" />
            </Button>
            <h2
              id="notification-panel-title"
              className="font-sans text-base font-bold text-foreground"
            >
              알림
            </h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearAll}
            disabled={notifications.length === 0}
            className="h-8 px-3"
          >
            모두 지우기
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-muted px-4 py-4">
          {notifications.length > 0 ? (
            <div className="flex flex-col gap-3">
              {notifications.map(notification => (
                <NotificationCard
                  key={notification.id}
                  notification={notification}
                />
              ))}
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="mb-4 flex size-10 items-center justify-center rounded-full bg-card text-muted-foreground">
                <Bell className="size-5" />
              </div>
              <p className="font-sans text-base font-bold text-foreground">
                새 알림이 없습니다
              </p>
              <p className="mt-1 max-w-[260px] font-sans text-sm text-muted-foreground">
                새로운 시그널·시스템·시장 소식이 도착하면 여기에 표시됩니다.
              </p>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function NotificationCard({
  notification,
}: {
  notification: NotificationItem;
}) {
  const Icon = notification.icon;
  return (
    <article className="flex gap-3 rounded-lg bg-card p-4">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-sans text-base font-bold leading-tight text-foreground">
            {notification.header}
          </h3>
          <time className="shrink-0 font-mono text-[10px] text-muted-foreground">
            {notification.date}
          </time>
        </div>
        <p className="mt-2 font-sans text-sm leading-5 text-muted-foreground">
          {notification.content}
        </p>
      </div>
    </article>
  );
}

function AiInsightOverlay({ hidden = false }: { hidden?: boolean }) {
  const [location] = useLocation();
  const [input, setInput] = useState("");
  const [inputFocused, setInputFocused] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [panelHeight, setPanelHeight] = useState(360);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const [exchanges, setExchanges] = useState<AiExchange[]>([]);
  const overlayRef = useRef<HTMLDivElement>(null);
  const previousLocationRef = useRef(location);
  const resizeStartRef = useRef<{ y: number; height: number } | null>(null);

  const analyzeMutation = trpc.ai.analyze.useMutation({
    onSuccess: (data, variables) => {
      const lastQuery =
        variables.messages[variables.messages.length - 1]?.content ?? "";
      setExchanges(prev =>
        prev.map(exchange =>
          exchange.loading && exchange.query === lastQuery
            ? { ...exchange, response: data.response, loading: false }
            : exchange
        )
      );
    },
    onError: (_error, variables) => {
      const lastQuery =
        variables.messages[variables.messages.length - 1]?.content ?? "";
      setExchanges(prev =>
        prev.map(exchange =>
          exchange.loading && exchange.query === lastQuery
            ? {
                ...exchange,
                response:
                  "AI 인사이트를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.",
                loading: false,
              }
            : exchange
        )
      );
    },
  });

  const submitQuery = (query: string) => {
    const trimmed = query.trim();
    if (!trimmed || analyzeMutation.isPending) return;

    const nextExchange: AiExchange = {
      id: `${Date.now()}`,
      query: trimmed,
      loading: true,
    };
    const nextExchanges = [...exchanges, nextExchange];
    setExchanges(nextExchanges);
    setInput("");
    setSuggestionsOpen(false);
    setChatOpen(true);
    setMinimized(false);

    analyzeMutation.mutate({
      messages: nextExchanges.flatMap(exchange => [
        { role: "user" as const, content: exchange.query },
        ...(exchange.response
          ? [{ role: "assistant" as const, content: exchange.response }]
          : []),
      ]),
      context:
        "TradeLab AI insight overlay. Analyze cryptocurrency market conditions using RSI, Bollinger Bands, ADX, VWAP, open interest, sentiment, and watchlist context when relevant.",
    });
  };

  const hasInput = input.trim().length > 0;
  const showSuggestions = suggestionsOpen && !chatOpen;
  const aiActive = chatOpen || suggestionsOpen || inputFocused;
  const chatTitle = exchanges[0]?.query ?? "";
  const visibleChatTitle =
    chatTitle.length > 64
      ? `${chatTitle.slice(0, 64).trimEnd()}...`
      : chatTitle;

  useEffect(() => {
    if (previousLocationRef.current !== location) {
      previousLocationRef.current = location;
      if (chatOpen) {
        setMinimized(true);
        setSuggestionsOpen(false);
      }
    }
  }, [chatOpen, location]);

  useEffect(() => {
    const minimizeOnOutsideScroll = (event: Event) => {
      if (!chatOpen || minimized) return;
      const target = event.target;
      if (target instanceof Node && overlayRef.current?.contains(target))
        return;
      setMinimized(true);
      setSuggestionsOpen(false);
    };

    document.addEventListener("scroll", minimizeOnOutsideScroll, true);
    return () => {
      document.removeEventListener("scroll", minimizeOnOutsideScroll, true);
    };
  }, [chatOpen, minimized]);

  useEffect(() => {
    if (!inputFocused) {
      setKeyboardOffset(0);
      return;
    }

    const viewport = window.visualViewport;
    if (!viewport) return;

    const updateKeyboardOffset = () => {
      const bottomInset = Math.max(
        0,
        window.innerHeight - viewport.height - viewport.offsetTop
      );
      setKeyboardOffset(bottomInset);
    };

    updateKeyboardOffset();
    viewport.addEventListener("resize", updateKeyboardOffset);
    viewport.addEventListener("scroll", updateKeyboardOffset);

    return () => {
      viewport.removeEventListener("resize", updateKeyboardOffset);
      viewport.removeEventListener("scroll", updateKeyboardOffset);
    };
  }, [inputFocused]);

  const startResize = (event: React.PointerEvent<HTMLDivElement>) => {
    if (minimized) return;
    resizeStartRef.current = { y: event.clientY, height: panelHeight };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const resizePanel = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!resizeStartRef.current) return;
    const maxHeight = Math.min(window.innerHeight - 116, 720);
    const nextHeight =
      resizeStartRef.current.height + resizeStartRef.current.y - event.clientY;
    setPanelHeight(Math.max(220, Math.min(maxHeight, nextHeight)));
  };

  const stopResize = () => {
    resizeStartRef.current = null;
  };

  return (
    <>
      <div
        className={cn(
          "pointer-events-none fixed inset-x-0 bottom-0 top-14 z-[34] bg-black/10 transition-opacity duration-300",
          !hidden && aiActive ? "opacity-100" : "opacity-0"
        )}
        aria-hidden="true"
      />
      <div
        ref={overlayRef}
        className={cn(
          "pointer-events-none fixed inset-x-0 z-40 flex justify-center px-4 transition-[bottom,opacity,visibility] duration-200 ease-out lg:left-[220px]",
          hidden ? "invisible opacity-0" : "visible opacity-100"
        )}
        style={{ bottom: `calc(1rem + ${keyboardOffset}px)` }}
        aria-hidden={hidden}
      >
        <div className="pointer-events-auto flex w-full max-w-[680px] flex-col items-center">
          <div
            className={cn(
              "grid w-full origin-bottom transition-[grid-template-rows,opacity,transform,margin] duration-300 ease-out",
              chatOpen
                ? "mb-2 grid-rows-[1fr] translate-y-0 opacity-100"
                : "mb-0 grid-rows-[0fr] translate-y-4 opacity-0 pointer-events-none"
            )}
          >
            <div
              className="min-h-0 overflow-hidden"
              style={{ filter: "drop-shadow(0 14px 28px rgb(16 44 87 / 12%))" }}
            >
              <div
                className="relative flex w-full flex-col overflow-hidden rounded-lg bg-card transition-[height] duration-300"
                style={{
                  height: minimized ? 48 : panelHeight,
                }}
              >
                {chatOpen && !minimized && (
                  <div
                    role="separator"
                    aria-orientation="horizontal"
                    aria-label="AI 대화창 크기 조절"
                    className="absolute left-0 top-0 z-20 h-3 w-full cursor-ns-resize touch-none"
                    onPointerDown={startResize}
                    onPointerMove={resizePanel}
                    onPointerUp={stopResize}
                    onPointerCancel={stopResize}
                  >
                    <div className="mx-auto mt-1 h-1 w-10 rounded-full bg-muted-foreground/20" />
                  </div>
                )}
                <div className="sticky top-0 z-10 flex h-12 shrink-0 items-center justify-between gap-3 bg-card px-3 pt-1">
                  <div
                    className="min-w-0 max-w-[calc(100%-88px)] truncate px-1 font-sans text-base font-bold text-foreground"
                    title={chatTitle}
                  >
                    {visibleChatTitle}
                  </div>
                  <div className="flex shrink-0 items-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={
                        minimized ? "AI 대화 펼치기" : "AI 대화 접기"
                      }
                      onClick={() => setMinimized(current => !current)}
                    >
                      {minimized ? (
                        <Plus className="size-4" />
                      ) : (
                        <Minus className="size-4" />
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="AI 대화 닫기"
                      onClick={() => {
                        setChatOpen(false);
                        setMinimized(false);
                        setExchanges([]);
                      }}
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                </div>

                {!minimized && (
                  <div
                    className="min-h-0 flex-1 overflow-y-auto bg-card px-4 pb-4 pt-2"
                    role="log"
                    aria-live="polite"
                    aria-busy={analyzeMutation.isPending}
                    aria-label="AI 인사이트 대화"
                  >
                    <div className="flex flex-col gap-6">
                      {exchanges.map(exchange => (
                        <div key={exchange.id} className="flex flex-col gap-5">
                          <div className="flex justify-end">
                            <div className="max-w-[82%] rounded-lg bg-foreground px-4 py-3 font-sans text-base leading-6 text-background">
                              {exchange.query}
                            </div>
                          </div>
                          <div className="px-2">
                            {exchange.loading ? (
                              <div className="flex items-center gap-2 font-sans text-sm text-muted-foreground">
                                <Loader2 className="size-4 animate-spin text-primary" />
                                분석 중...
                              </div>
                            ) : (
                              <>
                                <div className="prose prose-sm max-w-none font-sans text-foreground">
                                  <Streamdown>
                                    {exchange.response ?? ""}
                                  </Streamdown>
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="mt-3 h-8 px-2"
                                  onClick={() => {
                                    void navigator.clipboard?.writeText(
                                      exchange.response ?? ""
                                    );
                                  }}
                                >
                                  <Copy className="size-4" />
                                  복사
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div
            className={cn(
              "grid w-full origin-bottom transition-[grid-template-rows,opacity,transform,margin] duration-300 ease-out",
              showSuggestions
                ? "mb-2 grid-rows-[1fr] translate-y-0 opacity-100"
                : "mb-0 grid-rows-[0fr] translate-y-4 opacity-0 pointer-events-none"
            )}
          >
            <div
              className="min-h-0 overflow-hidden rounded-lg bg-card"
              style={{ filter: "drop-shadow(0 12px 24px rgb(16 44 87 / 10%))" }}
            >
              <div className="flex flex-col gap-2 p-3">
                {aiSuggestedQuestions.map(question => (
                  <button
                    key={question}
                    type="button"
                    onPointerDown={event => event.preventDefault()}
                    onClick={() => submitQuery(question)}
                    className="rounded-md bg-muted px-3 py-2 text-left font-sans text-sm text-foreground transition-colors hover:bg-foreground hover:text-background"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <form
            className={cn(
              "flex h-12 w-full items-center gap-2 rounded-lg bg-card p-1.5 transition-all duration-300",
              minimized && chatOpen ? "max-w-full" : "max-w-[680px]"
            )}
            style={{ filter: "drop-shadow(0 10px 20px rgb(16 44 87 / 10%))" }}
            onSubmit={event => {
              event.preventDefault();
              submitQuery(input);
            }}
          >
            <input
              value={input}
              onChange={event => setInput(event.target.value)}
              onFocus={() => {
                setInputFocused(true);
                setSuggestionsOpen(true);
              }}
              onClick={() => setSuggestionsOpen(true)}
              onBlur={() => {
                setInputFocused(false);
                setSuggestionsOpen(false);
              }}
              placeholder="AI에게 시장을 물어보세요..."
              className="h-full min-w-0 flex-1 rounded-md bg-transparent px-3 font-sans text-base text-foreground outline-none placeholder:text-muted-foreground"
            />
            <Button
              type="submit"
              size="icon-sm"
              disabled={!hasInput || analyzeMutation.isPending}
              aria-label="AI 인사이트 전송"
              className={cn(
                "rounded-md",
                hasInput && !analyzeMutation.isPending
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {analyzeMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ArrowUp className="size-4" />
              )}
            </Button>
          </form>
        </div>
      </div>
    </>
  );
}

function SidebarMenuList({
  sections,
  location,
  onNavigate,
}: {
  sections: typeof menuSections;
  location: string;
  onNavigate: (path: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      {sections.map((section, sectionIndex) => (
        <div key={section.title} className="contents">
          <div
            className={cn(
              "px-3 pb-1 pt-2 text-[10px] font-bold tracking-[0.06em] text-muted-foreground",
              sectionIndex > 0 && "mt-5"
            )}
          >
            {section.title}
          </div>
          {section.items.map(item => (
            <div key={item.path}>
              <button
                type="button"
                onClick={() => onNavigate(item.path)}
                aria-current={isItemActive(location, item) ? "page" : undefined}
                className={cn(
                  "flex h-10 w-full items-center gap-3 rounded-md px-3 text-left text-sm font-medium transition-colors",
                  isItemActive(location, item)
                    ? "bg-foreground text-background"
                    : "text-foreground hover:bg-muted"
                )}
              >
                <item.icon className="size-[18px]" />
                <span className="truncate">{item.label}</span>
              </button>
              {item.children?.length ? (
                <div
                  className={cn(
                    "grid overflow-hidden transition-[grid-template-rows,opacity,margin] duration-200 ease-out lg:ml-4 lg:border-l-2 lg:border-muted-foreground/30 lg:pl-3",
                    isItemActive(location, item)
                      ? "mt-1.5 grid-rows-[1fr] opacity-100"
                      : "mt-0 grid-rows-[0fr] opacity-0"
                  )}
                >
                  <div className="flex min-h-0 flex-col gap-1">
                    {item.children.map(child => (
                      <button
                        key={child.path}
                        type="button"
                        onClick={() => onNavigate(child.path)}
                        aria-current={location === child.path ? "page" : undefined}
                        className={cn(
                          "flex h-9 items-center gap-3 rounded-md px-3 text-left text-xs transition-colors",
                          location === child.path
                            ? "bg-muted text-foreground"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        <child.icon className="size-3.5" />
                        <span className="truncate">{child.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function MobileMenuOverlay({
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
        "fixed inset-x-0 bottom-0 top-14 z-[38] transition-[visibility] duration-300 lg:hidden",
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
        aria-labelledby="mobile-menu-title"
        className={cn(
          "absolute bottom-0 left-0 top-0 flex w-[min(86vw,340px)] flex-col border-r border-border bg-card transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-5 py-4">
          <h2
            id="mobile-menu-title"
            className="px-3 pb-2 pt-1 font-sans text-base font-bold text-foreground"
          >
            Menu
          </h2>
          <SidebarMenuList
            sections={menuSections}
            location={location}
            onNavigate={onNavigate}
          />
        </div>
        <div className="shrink-0 border-t border-border bg-card px-5 py-4">
          <ModeSwitchControl
            mode="pro"
            className="h-10 w-full justify-between bg-muted px-3"
          />
        </div>
      </aside>
    </div>
  );
}
