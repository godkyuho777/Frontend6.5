import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import Home from "./pages/Home";
import CoinDetail from "./pages/CoinDetail";
import Positions from "./pages/Positions";
import SignalHistory from "./pages/SignalHistory";
import AlertSettings from "./pages/AlertSettings";
import AIInsight from "./pages/AIInsight";
import WaveTracker from "./pages/WaveTracker";
import TechTracker from "./pages/TechTracker";

function Router() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path={"/"} component={Home} />
        <Route path={"/wave"} component={WaveTracker} />
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
