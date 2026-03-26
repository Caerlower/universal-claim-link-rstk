import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Copy } from "lucide-react";
import { formatUnits } from "viem";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useParaViem } from "@/hooks/useParaViem";
import { fetchClaimsForAddress } from "@/lib/supabase/claims";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { getAppChain } from "@/lib/viem/appChain";

type ReceiptTab = "sent" | "received";

const statusColors: Record<string, string> = {
  executed: "bg-primary/15 text-primary",
  open: "bg-amber-500/15 text-amber-300",
  cancelled: "bg-muted text-muted-foreground",
};

const short = (v: string) => (v.length > 14 ? `${v.slice(0, 8)}…${v.slice(-6)}` : v);

const Receipts = () => {
  const { address } = useParaViem();
  const [tab, setTab] = useState<ReceiptTab>("sent");
  const explorerBase = import.meta.env.VITE_RSK_EXPLORER_URL?.replace(/\/$/, "") ?? "https://explorer.testnet.rootstock.io";

  const { data = [], isLoading, error } = useQuery({
    queryKey: ["receipts", address?.toLowerCase()],
    enabled: !!address && isSupabaseConfigured,
    queryFn: async () => fetchClaimsForAddress(address!, getAppChain().id),
  });

  const filtered = useMemo(() => {
    if (!address) return [];
    const addr = address.toLowerCase();
    return data.filter((r) => (tab === "sent" ? r.sender === addr : r.receiver === addr));
  }, [address, data, tab]);

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="glass rounded-2xl p-5 md:p-6 mb-5 border border-border/50 shadow-card">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-1">Claim History</h2>
            <p className="text-sm text-muted-foreground">Track sent links and received claims.</p>
          </div>
          <div className="w-44">
            <Select value={tab} onValueChange={(v) => setTab(v as ReceiptTab)}>
              <SelectTrigger className="bg-muted/50 border-border/60 rounded-xl h-10 text-sm">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent className="glass-card border border-border/60">
                <SelectItem value="sent">Sent Links</SelectItem>
                <SelectItem value="received">Received Links</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {!address && (
        <div className="glass rounded-2xl p-6 text-sm text-muted-foreground">Connect wallet to view your claim history.</div>
      )}
      {address && !isSupabaseConfigured && (
        <div className="glass rounded-2xl p-6 text-sm text-muted-foreground">
          Supabase is not configured. Set <code className="text-primary">VITE_SUPABASE_URL</code> and{" "}
          <code className="text-primary">VITE_SUPABASE_ANON_KEY</code>.
        </div>
      )}
      {address && isSupabaseConfigured && isLoading && (
        <div className="glass rounded-2xl p-6 text-sm text-muted-foreground">Loading receipts…</div>
      )}
      {address && isSupabaseConfigured && error && (
        <div className="glass rounded-2xl p-6 text-sm text-destructive">Failed to load receipts from Supabase.</div>
      )}

      {address && isSupabaseConfigured && !isLoading && !error && filtered.length === 0 && (
        <div className="glass rounded-2xl p-6 text-sm text-muted-foreground">No {tab} claim records yet.</div>
      )}

      {filtered.map((r, i) => (
        <motion.div
          key={`${r.chain_id}-${r.claim_id}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          className="glass rounded-2xl p-5 md:p-6 border border-border/50 hover:border-primary/20 shadow-card transition-all"
        >
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <div className="text-base font-semibold text-foreground">Claim #{r.claim_id}</div>
              <div className="text-sm text-muted-foreground mt-1">
                {r.token_in_symbol}
                {r.token_out_symbol ? ` → ${r.token_out_symbol}` : ""}
              </div>
            </div>
            <span className={`text-xs font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full ${statusColors[r.status] ?? statusColors.open}`}>
              {r.status}
            </span>
          </div>

          <div className="grid sm:grid-cols-3 gap-4 text-sm mb-5">
            <div>
              <span className="text-muted-foreground block mb-1">Sender</span>
              <span className="font-mono text-foreground/80">{short(r.sender)}</span>
            </div>
            <div>
              <span className="text-muted-foreground block mb-1">Receiver</span>
              <span className="font-mono text-foreground/80">{short(r.receiver)}</span>
            </div>
            <div>
              <span className="text-muted-foreground block mb-1">Amount In</span>
              <span className="text-foreground font-medium">{formatUnits(BigInt(r.amount_in_wei), 18)} {r.token_in_symbol}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <a
              href={r.claim_link}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border border-border/60 hover:border-primary/25 text-foreground"
            >
              Open Link
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <button
              type="button"
              onClick={() => void navigator.clipboard.writeText(r.claim_link)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border border-border/60 hover:border-primary/25 text-foreground"
            >
              Copy Link
              <Copy className="w-3.5 h-3.5" />
            </button>
            {r.executed_tx_hash && (
              <a
                href={`${explorerBase}/tx/${r.executed_tx_hash}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border border-border/60 hover:border-primary/25 text-foreground"
              >
                Claim Tx
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  );
};

export default Receipts;
