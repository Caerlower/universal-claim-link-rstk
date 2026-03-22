import { useState } from "react";
import { useModal, useAccount, useWallet, useLogout } from "@getpara/react-sdk";
import { Wallet, ChevronDown, LogOut, Copy, ExternalLink } from "lucide-react";

const WalletButton = () => {
  const { openModal } = useModal();
  const { isConnected, isLoading } = useAccount();
  const { data: wallet } = useWallet();
  const { logout } = useLogout();
  const [showDropdown, setShowDropdown] = useState(false);

  const address = wallet?.address ?? "";
  const short =
    address.length > 10 ? `${address.slice(0, 6)}...${address.slice(-4)}` : address || "Connected";

  const explorerBase =
    import.meta.env.VITE_RSK_EXPLORER_URL?.replace(/\/$/, "") ?? "https://explorer.testnet.rootstock.io";

  const handleDisconnect = () => {
    logout();
    setShowDropdown(false);
  };

  if (isLoading) {
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

  if (isConnected) {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-secondary border border-border/60 text-sm font-medium text-foreground transition-all duration-200 hover:border-primary/40 active:scale-[0.97]"
        >
          <div className="h-2 w-2 rounded-full bg-success animate-pulse-glow" />
          <span>{short}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>

        {showDropdown && (
          <div className="absolute right-0 top-full mt-2 w-56 glass-card p-2 animate-scale-in z-50">
            <button
              type="button"
              disabled={!address}
              onClick={() => address && void navigator.clipboard.writeText(address)}
              className="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-foreground hover:bg-secondary/60 transition-colors disabled:opacity-50"
            >
              <Copy className="h-4 w-4 text-muted-foreground" />
              Copy Address
            </button>
            <a
              href={address ? `${explorerBase}/address/${address}` : explorerBase}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-foreground hover:bg-secondary/60 transition-colors"
            >
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
              View on Explorer
            </a>
            <div className="my-1 border-t border-border/40" />
            <button
              type="button"
              onClick={handleDisconnect}
              className="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Log out
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => openModal()}
      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold btn-primary-glow transition-all duration-200 hover:brightness-110 active:scale-[0.97]"
    >
      <Wallet className="h-4 w-4" />
      Connect with Para
    </button>
  );
};

export default WalletButton;
