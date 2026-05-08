import { useAuth } from "@/_core/hooks/useAuth";
import { SignInDialog } from "@/components/SignInDialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/useMobile";
import {
  Activity,
  BarChart3,
  Bell,
  Bot,
  Database,
  FlaskConical,
  HeartPulse,
  History,
  LogIn,
  LogOut,
  PanelLeft,
  Ruler,
  Sparkles,
  Target,
  TrendingUp,
  Waves,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { BackendBranchIndicator } from "./BackendBranchIndicator";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";

type MenuChild = { icon: LucideIcon; label: string; path: string };
type MenuItem = {
  icon: LucideIcon;
  label: string;
  path: string;
  children?: MenuChild[];
};

const menuItems: MenuItem[] = [
  {
    icon: Activity,
    label: "Signal Scanner",
    path: "/",
    children: [
      { icon: BarChart3, label: "RSI / BB / ADX", path: "/" },
      { icon: Ruler, label: "Fibonacci & Trendline", path: "/fibonacci" },
      { icon: TrendingUp, label: "VWAP Strategy", path: "/vwap" },
    ],
  },
  {
    icon: Waves,
    label: "Wave Tracker",
    path: "/wave",
    children: [
      { icon: Waves, label: "Sentiment & Matrix", path: "/wave/sentiment" },
      { icon: TrendingUp, label: "Trend Analysis", path: "/wave/trend" },
    ],
  },
  { icon: BarChart3, label: "Tech Tracker (Pro)", path: "/tech-tracker" },
  { icon: FlaskConical, label: "Backtesting", path: "/backtest" },
  { icon: Database, label: "Onchain Data", path: "/onchain" },
  { icon: Sparkles, label: "Lite Mode (일반인용)", path: "/lite" },
  { icon: Target, label: "Positions", path: "/positions" },
  { icon: History, label: "Signal History", path: "/history" },
  { icon: Bell, label: "Alert Settings", path: "/alerts" },
  { icon: Bot, label: "AI Insight", path: "/ai" },
  { icon: HeartPulse, label: "Admin / Health", path: "/admin/health" },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />;
  }

  // No login required - render dashboard directly for all users
  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const search = useSearch();
  const currentSearch = search ? `?${search}` : "";
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const activeMenuItem = menuItems.find((item) => item.path === location);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const sidebarLeft =
        sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r border-border/50"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-16 justify-center border-b border-border/30">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-neon-pink/10 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-neon-cyan" />
              </button>
              {!isCollapsed ? (
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-display text-sm font-bold tracking-wider text-neon-pink glow-pink truncate">
                    SIGNAL BOT
                  </span>
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0 pt-2">
            <SidebarMenu className="px-2 py-1">
              {menuItems.map((item) => {
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className={`h-10 transition-all font-medium ${
                        isActive
                          ? "bg-neon-pink/10 text-neon-pink border-l-2 border-neon-pink"
                          : "text-muted-foreground hover:text-neon-cyan hover:bg-neon-cyan/5"
                      }`}
                    >
                      <item.icon
                        className={`h-4 w-4 ${
                          isActive ? "text-neon-pink" : ""
                        }`}
                      />
                      <span className="text-sm">{item.label}</span>
                    </SidebarMenuButton>
                    {item.children && item.children.length > 0 && (
                      <SidebarMenuSub>
                        {item.children.map((child) => {
                          const childIsActive =
                            location + currentSearch === child.path;
                          return (
                            <SidebarMenuSubItem key={child.path}>
                              <SidebarMenuSubButton
                                asChild
                                isActive={childIsActive}
                                className={`h-9 transition-all ${
                                  childIsActive
                                    ? "bg-neon-cyan/10 text-neon-cyan"
                                    : "text-muted-foreground hover:text-neon-cyan hover:bg-neon-cyan/5"
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => setLocation(child.path)}
                                  className="w-full text-left flex items-center gap-2"
                                >
                                  <child.icon className="h-3.5 w-3.5 shrink-0" />
                                  <span className="text-sm">{child.label}</span>
                                </button>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          );
                        })}
                      </SidebarMenuSub>
                    )}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-3 border-t border-border/30">
            <BackendBranchIndicator />
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-neon-cyan/5 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <Avatar className="h-9 w-9 border border-neon-cyan/30 shrink-0">
                      <AvatarFallback className="text-xs font-mono font-medium bg-neon-cyan/10 text-neon-cyan">
                        {user.name?.charAt(0).toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                      <p className="text-sm font-medium truncate leading-none text-foreground">
                        {user.name || "-"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate mt-1.5 font-mono">
                        {user.email || "-"}
                      </p>
                    </div>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem
                    onClick={logout}
                    className="cursor-pointer text-destructive focus:text-destructive"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Disconnect</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <SignInDialog>
                <button className="flex items-center gap-3 rounded-lg px-1 py-2 hover:bg-neon-cyan/5 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <div className="h-9 w-9 flex items-center justify-center border border-neon-cyan/30 rounded-full shrink-0 bg-neon-cyan/10">
                    <LogIn className="h-4 w-4 text-neon-cyan" />
                  </div>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium text-neon-cyan">
                      Sign In
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 font-mono">
                      For positions & alerts
                    </p>
                  </div>
                </button>
              </SignInDialog>
            )}
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-neon-pink/20 transition-colors ${
            isCollapsed ? "hidden" : ""
          }`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {isMobile && (
          <div className="flex border-b border-border/30 h-14 items-center justify-between bg-background/95 px-2 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />
              <div className="flex items-center gap-3">
                <span className="font-display text-sm font-bold tracking-wider text-neon-pink">
                  {activeMenuItem?.label ?? "Menu"}
                </span>
              </div>
            </div>
          </div>
        )}
        <main className="flex-1 p-4 overflow-auto">{children}</main>
      </SidebarInset>
    </>
  );
}
