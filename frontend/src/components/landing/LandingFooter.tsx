import { Github, BookOpen } from "lucide-react";

const LandingFooter = () => {
  return (
    <footer className="border-t border-border/50 py-12 px-6">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <div className="relative w-7 h-7 rounded-xl overflow-hidden border border-glass-border/70">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/50 via-primary/20 to-background/0" />
            <div className="relative w-full h-full flex items-center justify-center">
              <img src="/download.svg" alt="RootClaim" className="w-4 h-4 opacity-95" />
            </div>
          </div>
          <span className="text-sm font-semibold text-foreground">RootClaim</span>
        </div>

        <div className="flex items-center gap-6">
          <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
            <Github className="w-4 h-4" />
          </a>
          <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
            <BookOpen className="w-4 h-4" />
          </a>
        </div>

        <p className="text-xs text-muted-foreground">
          Built on <span className="text-primary font-medium">Rootstock</span>
        </p>
      </div>
    </footer>
  );
};

export default LandingFooter;
