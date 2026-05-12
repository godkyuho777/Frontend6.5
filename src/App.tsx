import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Redirect, Route, Switch, useLocation } from "wouter";
import { useEffect } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import LiteLayout from "./components/lite/LiteLayout";
import Home from "./pages/Home";
import Fibonacci from "./pages/Fibonacci";
import FibonacciDetail from "./pages/FibonacciDetail";
import Vwap from "./pages/Vwap";
import CoinDetail from "./pages/CoinDetail";
import Positions from "./pages/Positions";
import SignalHistory from "./pages/SignalHistory";
import AlertSettings from "./pages/AlertSettings";
import AIInsight from "./pages/AIInsight";
import WaveSentiment from "./pages/WaveSentiment";
import WaveTrend from "./pages/WaveTrend";
import TechTracker from "./pages/TechTracker";
import Backtest from "./pages/Backtest";
import Onchain from "./pages/Onchain";
import Charter from "./pages/Charter";
import HealthCheck from "./pages/admin/HealthCheck";
// strategies/* 페이지들 모두 deprecated (2026-05-11): backend modifier 제거 +
// 통합 / FundingExtreme · MarketBreadth 는 Macro Hub redirect 만 처리.
import MacroHub from "./pages/macro/MacroHub";
import MacroSofr from "./pages/macro/MacroSofr";
import MacroYieldCurve from "./pages/macro/MacroYieldCurve";
import MacroWalcl from "./pages/macro/MacroWalcl";
import MacroDxyVix from "./pages/macro/MacroDxyVix";
import MacroRealRate from "./pages/macro/MacroRealRate";
import LiteDashboard from "./pages/lite/Dashboard";
import LiteCoinDetail from "./pages/lite/CoinDetail";
import LitePortfolio from "./pages/lite/Portfolio";
import LiteLearn from "./pages/lite/Learn";
import LiteAlerts from "./pages/lite/Alerts";

/**
 * 신규 방문자 (localStorage.tradelabMode 미설정) → /lite 강제 진입.
 * 기존 사용자 (마지막 모드가 "pro") → 그대로 유지.
 * 사용자가 한 번 Pro 또는 Lite 를 명시적으로 선택하면 그 선택을 기억.
 */
function ModeRedirector() {
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (typeof window === "undefined") return;
    // 이미 /lite 안이면 그대로 + 마지막 모드를 lite 로 기억
    if (location.startsWith("/lite")) {
      try {
        localStorage.setItem("tradelabMode", "lite");
      } catch {}
      return;
    }
    // 비-lite 경로는 Pro
    let mode: string | null = null;
    try {
      mode = localStorage.getItem("tradelabMode");
    } catch {}
    if (location === "/" && mode == null) {
      // 첫 방문자 — /lite 강제 진입
      setLocation("/lite");
      return;
    }
    // Pro 모드 진입 기록
    try {
      if (mode !== "lite") localStorage.setItem("tradelabMode", "pro");
    } catch {}
  }, [location, setLocation]);

  return null;
}

function ProShell() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path={"/"} component={Home} />
        {/* Signal Scanner sub-pages — 원위치 (IA 정정, /strategies/* 직접 마운트). */}
        <Route path={"/fibonacci"} component={Fibonacci} />
        <Route path={"/fibonacci/:symbol"} component={FibonacciDetail} />
        <Route path={"/vwap"} component={Vwap} />
        {/* /strategies/* deprecated (2026-05-11): backend modifier 통합/제거.
            FundingExtreme / MarketBreadth 는 Macro Hub 로 redirect (외부 링크 호환). */}
        <Route path={"/strategies/funding-extreme"}>
          <Redirect to="/macro/funding-extreme" />
        </Route>
        <Route path={"/strategies/market-breadth"}>
          <Redirect to="/macro/market-breadth" />
        </Route>
        {/* Macro Liquidity Tracker — 6차원 매크로 단일 hub (Overview + 7 sub-tabs).
            구체 라우트를 인덱스보다 위에 배치하여 wouter top-down 매칭 우선순위 보장. */}
        <Route path={"/macro/sofr"} component={MacroSofr} />
        <Route path={"/macro/yield-curve"} component={MacroYieldCurve} />
        <Route path={"/macro/walcl"} component={MacroWalcl} />
        <Route path={"/macro/dxy-vix"} component={MacroDxyVix} />
        <Route path={"/macro/real-rate"} component={MacroRealRate} />
        <Route path={"/macro"} component={MacroHub} />
        {/* Wave Tracker — Sentiment & Matrix, Trend Analysis (원위치). */}
        <Route path={"/wave/sentiment"} component={WaveSentiment} />
        <Route path={"/wave/trend"} component={WaveTrend} />
        {/* Legacy `/wave/macro` → 신규 Macro Hub (외부 북마크 호환). */}
        <Route path={"/wave/macro"}>
          <Redirect to="/macro" />
        </Route>
        <Route path={"/wave"}>
          <Redirect to="/wave/sentiment" />
        </Route>
        <Route path={"/tech-tracker"} component={TechTracker} />
        <Route path={"/coin/:symbol"} component={CoinDetail} />
        <Route path={"/positions"} component={Positions} />
        <Route path={"/history"} component={SignalHistory} />
        <Route path={"/alerts"} component={AlertSettings} />
        <Route path={"/ai"} component={AIInsight} />
        <Route path={"/backtest"} component={Backtest} />
        <Route path={"/onchain"} component={Onchain} />
        <Route path={"/charter"} component={Charter} />
        <Route path={"/admin/health"} component={HealthCheck} />
        <Route path={"/404"} component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

function LiteShell() {
  return (
    <LiteLayout>
      <Switch>
        <Route path={"/lite"} component={LiteDashboard} />
        <Route path={"/lite/coin/:symbol"} component={LiteCoinDetail} />
        <Route path={"/lite/portfolio"} component={LitePortfolio} />
        <Route path={"/lite/learn"} component={LiteLearn} />
        <Route path={"/lite/alerts"} component={LiteAlerts} />
        <Route component={NotFound} />
      </Switch>
    </LiteLayout>
  );
}

function Router() {
  const [location] = useLocation();
  const isLite = location.startsWith("/lite");
  return (
    <>
      <ModeRedirector />
      {isLite ? <LiteShell /> : <ProShell />}
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
