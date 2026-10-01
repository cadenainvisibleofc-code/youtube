import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import DashboardLayout from "./components/DashboardLayout";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import ReadingPage from "@/pages/ReadingPage";
import Chat from "@/pages/Chat";

function PrivateRoutes() {
  return <DashboardLayout><Switch><Route path="/" component={Home} /><Route path="/chat" component={Chat} /><Route path="/fila" component={Home} /><Route path="/metricas" component={Home} /><Route path="/regras" component={Home} /><Route path="/404" component={NotFound} /><Route component={NotFound} /></Switch></DashboardLayout>;
}

function Router() {
  return <Switch><Route path="/leitura" component={ReadingPage} /><Route component={PrivateRoutes} /></Switch>;
}

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="light"><TooltipProvider><Toaster /><Router /></TooltipProvider></ThemeProvider></ErrorBoundary>;
}
