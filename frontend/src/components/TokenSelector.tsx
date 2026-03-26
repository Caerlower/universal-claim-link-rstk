import { useState } from "react";
import { ChevronDown } from "lucide-react";

interface Token {
  symbol: string;
  name: string;
  logoUrl: string;
}

const TOKENS: Token[] = [
  {
    symbol: "RBTC",
    name: "Rootstock BTC",
    logoUrl:
      "https://raw.githubusercontent.com/rsksmart/rsk-contract-metadata/refs/heads/master/images/rootstock-orange.png",
  },
  {
    symbol: "RIF",
    name: "RIF Token",
    logoUrl: "https://raw.githubusercontent.com/rsksmart/rsk-contract-metadata/refs/heads/master/images/rif.png",
  },
  { symbol: "USDRIF", name: "USD on RIF", logoUrl: "/usdrif.svg" },
];

interface TokenSelectorProps {
  value: string;
  onChange: (symbol: string) => void;
  label?: string;
  /** If set, only these symbols are listed (must match `TOKENS.symbol`). */
  symbols?: string[];
}

const TokenSelector = ({ value, onChange, label, symbols }: TokenSelectorProps) => {
  const [open, setOpen] = useState(false);
  const list = symbols?.length ? TOKENS.filter((t) => symbols.includes(t.symbol)) : TOKENS;
  const selected = list.find((t) => t.symbol === value) || list[0] || TOKENS[0];

  return (
    <div className="relative">
      {label && <label className="block text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">{label}</label>}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 rounded-xl bg-secondary/60 border border-border/50 text-foreground transition-all duration-200 hover:border-primary/30 focus:outline-none focus:ring-2 focus:ring-ring/30 active:scale-[0.98]"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted/40 border border-border/60 overflow-hidden">
            <img src={selected.logoUrl} alt={selected.symbol} className="h-6 w-6 object-contain" />
          </span>
          <div className="text-left">
            <div className="text-sm font-semibold">{selected.symbol}</div>
            <div className="text-xs text-muted-foreground">{selected.name}</div>
          </div>
        </div>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-50 left-0 right-0 top-full mt-2 glass-card p-1.5 animate-scale-in">
          {list.map((token) => (
            <button
              key={token.symbol}
              type="button"
              onClick={() => { onChange(token.symbol); setOpen(false); }}
              className={`flex w-full items-center gap-3 px-3 py-2.5 rounded-lg transition-colors duration-150 ${
                token.symbol === value
                  ? "bg-primary/10 text-primary"
                  : "text-foreground hover:bg-secondary/60"
              }`}
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-muted/40 border border-border/60 overflow-hidden">
                <img src={token.logoUrl} alt={token.symbol} className="h-5 w-5 object-contain" />
              </span>
              <div className="text-left">
                <div className="text-sm font-medium">{token.symbol}</div>
                <div className="text-xs text-muted-foreground">{token.name}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default TokenSelector;
