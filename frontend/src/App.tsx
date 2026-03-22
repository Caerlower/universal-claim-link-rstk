import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ParaAppProvider } from "@/providers/ParaAppProvider";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Header from "@/components/Header";
import Index from "./pages/Index";
import ClaimFunds from "./pages/ClaimFunds";
import NotFound from "./pages/NotFound";

const App = () => (
  <ParaAppProvider>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Header />
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/claim/:id" element={<ClaimFunds />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </ParaAppProvider>
);

export default App;
