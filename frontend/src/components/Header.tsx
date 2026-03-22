import { Link, useLocation } from "react-router-dom";
import rootstockLogo from "@/assets/rootstock-logo.png";
import WalletButton from "./WalletButton";

const Header = () => {
  const location = useLocation();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/40" style={{ backdropFilter: "blur(16px)", background: "hsl(220 15% 5% / 0.8)" }}>
      <div className="container flex h-16 items-center justify-between px-4 md:px-8">
        <Link to="/" className="flex items-center gap-3 group">
          <img src={rootstockLogo} alt="Rootstock" className="h-8 w-8 transition-transform duration-300 group-hover:scale-110" />
          <div className="flex flex-col">
            <span className="text-sm font-bold tracking-tight text-foreground">Claim Links</span>
            <span className="text-[10px] font-medium text-muted-foreground tracking-widest uppercase">Rootstock</span>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {[{ to: "/", label: "Create" }].map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                location.pathname === item.to
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <WalletButton />
      </div>
    </header>
  );
};

export default Header;
