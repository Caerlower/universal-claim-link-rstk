import { Loader2, CheckCircle2, XCircle, Info } from "lucide-react";

type Status = "idle" | "loading" | "success" | "error";

interface StatusIndicatorProps {
  status: Status;
  message?: string;
  txHash?: string;
  /** Explorer origin without trailing slash, e.g. https://explorer.testnet.rootstock.io */
  explorerBase?: string;
}

const StatusIndicator = ({ status, message, txHash, explorerBase }: StatusIndicatorProps) => {
  const explorer =
    explorerBase?.replace(/\/$/, "") ??
    import.meta.env.VITE_RSK_EXPLORER_URL?.replace(/\/$/, "") ??
    "https://explorer.testnet.rootstock.io";
  if (status === "idle") return null;

  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-xl border animate-fade-up ${
        status === "loading"
          ? "bg-primary/5 border-primary/20"
          : status === "success"
          ? "bg-success/5 border-success/20 glow-success"
          : "bg-destructive/5 border-destructive/20"
      }`}
    >
      {status === "loading" && <Loader2 className="h-5 w-5 text-primary animate-spin-slow mt-0.5 shrink-0" />}
      {status === "success" && (
        <svg className="h-5 w-5 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" className="stroke-success" strokeWidth="2" />
          <path d="M8 12.5l2.5 2.5 5-5" className="stroke-success" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="100" strokeDashoffset="100" style={{ animation: "check-draw 0.5s ease-out 0.2s forwards" }} />
        </svg>
      )}
      {status === "error" && <XCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />}

      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium ${
          status === "loading" ? "text-primary" : status === "success" ? "text-success" : "text-destructive"
        }`}>
          {message || (status === "loading" ? "Processing..." : status === "success" ? "Success!" : "Something went wrong")}
        </p>
        {txHash && (
          <a
            href={`${explorer}/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors font-mono"
          >
            {txHash.slice(0, 10)}...{txHash.slice(-8)}
            <Info className="h-3 w-3" />
          </a>
        )}
      </div>
    </div>
  );
};

export default StatusIndicator;
