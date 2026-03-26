import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import WalletButton from "@/components/WalletButton";
import ThemeToggle from "@/components/ThemeToggle";

const AppNav = () => {
  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed top-0 left-0 right-0 z-50 px-6 py-4"
    >
      <div className="max-w-4xl mx-auto glass-strong rounded-2xl px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="relative w-9 h-9 rounded-2xl overflow-hidden border border-glass-border/70 shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/50 via-primary/20 to-background/0" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.35),transparent_55%)]" />
              <div className="relative w-full h-full flex items-center justify-center">
                <img src="/download.svg" alt="RootClaim" className="w-5 h-5 opacity-95" />
              </div>
            </div>
            <span className="font-semibold text-base md:text-lg text-foreground hidden sm:inline">RootClaim</span>
          </Link>
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-lg bg-primary/10 border border-primary/20">
            <div className="w-1.5 h-1.5 rounded-full bg-primary" />
            <span className="text-[10px] font-semibold text-primary uppercase tracking-wider">Rootstock</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <WalletButton />
        </div>
      </div>
    </motion.nav>
  );
};

export default AppNav;
