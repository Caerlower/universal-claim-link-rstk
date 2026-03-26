import { useEffect, useMemo, useState } from "react";
import { useModal, useLogout } from "@getpara/react-sdk";
import { Wallet, ChevronDown, LogOut, Copy, ExternalLink } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useParaViem } from "@/hooks/useParaViem";

const WalletButton = () => {
  const { openModal } = useModal();
  const { address: stableAddress, isViemLoading } = useParaViem();
  const { logout } = useLogout();
  const [isOpening, setIsOpening] = useState(false);
  const [displayAddress, setDisplayAddress] = useState("");
  const [disconnectRequested, setDisconnectRequested] = useState(false);

  const address = stableAddress ?? "";
  // Para wallet state can briefly flicker after connect; keep last known address for a short window.
  useEffect(() => {
    if (address) {
      setDisplayAddress(address);
      setDisconnectRequested(false);
      return;
    }
    if (disconnectRequested) {
      setDisplayAddress("");
      return;
    }
    const timer = setTimeout(() => setDisplayAddress(""), 1500);
    return () => clearTimeout(timer);
  }, [address, disconnectRequested]);

  const connected = useMemo(() => !!displayAddress, [displayAddress]);
  const short =
    displayAddress.length > 10 ? `${displayAddress.slice(0, 6)}...${displayAddress.slice(-4)}` : displayAddress || "Connected";

  const explorerBase =
    import.meta.env.VITE_RSK_EXPLORER_URL?.replace(/\/$/, "") ?? "https://explorer.testnet.rootstock.io";

  const handleDisconnect = async () => {
    setDisconnectRequested(true);
    try {
      await logout();
    } catch {
      // If the SDK throws, fallback to letting the user retry.
      setDisconnectRequested(false);
    }
  };

  const handleConnect = async () => {
    if (isOpening) return;
    setIsOpening(true);
    try {
      await Promise.resolve(openModal());
    } finally {
      // Keep short guard to avoid accidental double-open.
      setTimeout(() => setIsOpening(false), 300);
    }
  };

  if (isViemLoading && !connected) {
    return (
      <button
        type="button"
        disabled
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-secondary border border-border/60 text-sm font-medium text-muted-foreground"
      >
        <Wallet className="h-4 w-4" />
        Loading…
      </button>
    );
  }

  if (connected) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-secondary border border-border/60 text-sm font-medium text-foreground transition-all duration-200 hover:border-primary/40 active:scale-[0.97]"
          >
            <div className="h-2 w-2 rounded-full bg-success animate-pulse-glow" />
            <span>{short}</span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          sideOffset={10}
          className="w-60 glass-card p-2 border border-glass-border/70 shadow-2xl"
        >
          <DropdownMenuItem
            disabled={!address}
            onSelect={(e) => {
              e.preventDefault();
              if (!displayAddress) return;
              void navigator.clipboard.writeText(displayAddress);
            }}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm"
          >
            <Copy className="h-4 w-4 text-muted-foreground" />
            Copy Address
          </DropdownMenuItem>

          <DropdownMenuItem asChild className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm">
            <a
              href={displayAddress ? `${explorerBase}/address/${displayAddress}` : explorerBase}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
              View on Explorer
            </a>
          </DropdownMenuItem>

          <DropdownMenuSeparator className="my-1 bg-border/40" />

          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              void handleDisconnect();
            }}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-destructive focus:text-destructive"
          >
            <LogOut className="h-4 w-4" />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void handleConnect()}
      disabled={isOpening}
      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold btn-primary-glow transition-all duration-200 hover:brightness-110 active:scale-[0.97]"
    >
      <Wallet className="h-4 w-4" />
      {isOpening ? "Connecting…" : "Connect"}
    </button>
  );
};

export default WalletButton;
