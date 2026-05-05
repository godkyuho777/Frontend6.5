import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Redirect, Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
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

function Router() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path={"/"} component={Home} />
        {/* Signal Scanner sub-pages — distinct strategies per the v6.1 doc. */}
        <Route path={"/fibonacci"} component={Fibonacci} />
        <Route path={"/fibonacci/:symbol"} component={FibonacciDetail} />
        <Route path={"/vwap"} component={Vwap} />
        {/* Wave Tracker — split into Sentiment & Matrix and Trend Analysis. */}
        <Route path={"/wave/sentiment"} component={WaveSentiment} />
        <Route path={"/wave/trend"} component={WaveTrend} />
        <Route path={"/wave"}>
          <Redirect to="/wave/sentiment" />
        </Route>
        <Route path={"/tech-tracker"} component={TechTracker} />
        <Route path={"/coin/:symbol"} component={CoinDetail} />
        <Route path={"/positions"} component={Positions} />
        <Route path={"/history"} component={SignalHistory} />
        <Route path={"/alerts"} component={AlertSettings} />
        <Route path={"/ai"} component={AIInsight} />
        <Route path={"/404"} component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
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
