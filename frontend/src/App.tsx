import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ParaAppProvider } from "@/providers/ParaAppProvider";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index";
import AppPage from "./pages/AppPage";
import ClaimFunds from "./pages/ClaimFunds";
import NotFound from "./pages/NotFound";

const App = () => (
  <ThemeProvider>
    <ParaAppProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/app" element={<AppPage />} />
            <Route path="/claim/:id" element={<ClaimFunds />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ParaAppProvider>
  </ThemeProvider>
);

export default App;
