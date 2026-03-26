import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

const HeroMockup = () => (
  <div className="relative mt-16 mx-auto max-w-2xl">
    <div className="absolute inset-0 bg-gradient-to-b from-primary/20 to-transparent rounded-2xl blur-3xl -z-10" />
    <motion.div
      initial={{ y: 30, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.4, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="glass-strong rounded-2xl shadow-premium overflow-hidden"
    >
      {/* Mock window chrome */}
      <div className="flex items-center gap-2 px-5 py-3 border-b border-border/50">
        <div className="w-3 h-3 rounded-full bg-destructive/60" />
        <div className="w-3 h-3 rounded-full bg-primary/40" />
        <div className="w-3 h-3 rounded-full bg-green-500/40" />
        <div className="flex-1 mx-8">
          <div className="bg-muted/50 rounded-lg py-1.5 px-4 text-center text-xs text-muted-foreground">
            claim.rootstock.io/create
          </div>
        </div>
      </div>
      {/* Mock app content */}
      <div className="p-8 space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <span className="text-sm font-medium text-foreground/80">New Claim Link</span>
        </div>
        <div className="space-y-4">
          <div className="bg-muted/30 rounded-xl p-4 border border-border/30">
            <div className="tracking-label mb-2">Receiver</div>
            <div className="text-sm text-foreground/70 font-mono">0x1a2b...3c4d</div>
          </div>
          <div className="flex gap-3">
            <div className="flex-1 bg-muted/30 rounded-xl p-4 border border-border/30">
              <div className="tracking-label mb-2">Token</div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-muted/40 border border-border/60 flex items-center justify-center overflow-hidden">
                  <img
                    src="https://raw.githubusercontent.com/rsksmart/rsk-contract-metadata/refs/heads/master/images/rootstock-orange.png"
                    alt="RBTC"
                    className="w-4 h-4 object-contain"
                  />
                </div>
                <span className="text-sm font-medium">RBTC</span>
              </div>
            </div>
            <div className="flex-1 bg-muted/30 rounded-xl p-4 border border-border/30">
              <div className="tracking-label mb-2">Amount</div>
              <div className="text-sm font-medium">0.05</div>
            </div>
          </div>
          <div className="bg-gradient-to-r from-primary to-primary/80 rounded-xl py-3 text-center text-sm font-semibold text-primary-foreground">
            Create Claim Link
          </div>
        </div>
      </div>
    </motion.div>
  </div>
);

const LandingHero = () => {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-24 pb-16 overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-primary/8 rounded-full blur-[120px] -z-10" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="text-center max-w-3xl mx-auto"
      >
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-8">
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          <span className="text-xs font-medium text-primary">Built on Rootstock</span>
        </div>

        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
          <span className="text-gradient">Send Any Token.</span>
          <br />
          <span className="text-gradient-orange">Let Them Claim Their Way.</span>
        </h1>

        <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-10 leading-relaxed">
          Deposit tokens into escrow and share a claim link. Recipients choose
          what token they want to receive — frictionless, on-chain.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link to="/app">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-shadow"
            >
              Create a Claim Link
              <ArrowRight className="w-4 h-4" />
            </motion.button>
          </Link>
          <a href="#how-it-works">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-secondary text-secondary-foreground font-medium text-sm border border-border hover:bg-secondary/80 transition-colors"
            >
              See How It Works
            </motion.button>
          </a>
        </div>
      </motion.div>

      <HeroMockup />
    </section>
  );
};

export default LandingHero;
