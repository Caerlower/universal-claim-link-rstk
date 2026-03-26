import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Search, Wallet, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { formatUnits } from "viem";
import ClaimFundsPage from "@/pages/ClaimFunds";
import { useParaViem } from "@/hooks/useParaViem";
import { fetchClaimsForAddress } from "@/lib/supabase/claims";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { getAppChain, getPublicClient } from "@/lib/viem/appChain";

type ClaimFundsProps = {
  initialClaimId?: string | null;
};

const ClaimFunds = ({ initialClaimId = null }: ClaimFundsProps) => {
  const { address } = useParaViem();
  const [claimId, setClaimId] = useState(initialClaimId ?? "");
  const [activeClaimId, setActiveClaimId] = useState<string | null>(initialClaimId);
  const [searchedClaimId, setSearchedClaimId] = useState<string | null>(initialClaimId);

  useEffect(() => {
    if (!initialClaimId) return;
    setClaimId(initialClaimId);
    setSearchedClaimId(initialClaimId);
  }, [initialClaimId]);

  const handleOpenClaim = () => {
    const raw = claimId.trim();
    const fromUrl = raw.match(/\/claim\/(\d+)/)?.[1];
    const id = (fromUrl ?? raw).replace(/[^\d]/g, "");
    if (!id) return;
    setActiveClaimId(null);
    setSearchedClaimId(id);
  };

  const { data = [], isLoading } = useQuery({
    queryKey: ["claim-tab-received", address?.toLowerCase()],
    enabled: !!address && isSupabaseConfigured,
    queryFn: async () => fetchClaimsForAddress(address!, getAppChain().id),
  });

  // Use chain time for expiry badge so we don't depend on the user's device clock.
  const { data: chainNowTs } = useQuery({
    queryKey: ["chainNow", getAppChain().id],
    enabled: isSupabaseConfigured && !!address,
    queryFn: async () => {
      const pc = getPublicClient();
      const block = await pc.getBlock({ blockTag: "latest" });
      return block.timestamp;
    },
    staleTime: 10_000,
    refetchInterval: 5_000,
    refetchIntervalInBackground: true,
  });

  const receivedClaims = useMemo(() => {
    if (!address) return [];
    const me = address.toLowerCase();
    return data
      .filter((r) => r.receiver === me)
      .sort((a, b) => Number(b.claim_id) - Number(a.claim_id));
  }, [address, data]);

  const hasSearchText = claimId.trim().length > 0;

  useEffect(() => {
    if (hasSearchText) return;
    setSearchedClaimId(null);
    if (activeClaimId && !receivedClaims.some((c) => c.claim_id === activeClaimId)) {
      setActiveClaimId(null);
    }
  }, [hasSearchText, activeClaimId, receivedClaims]);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="glass rounded-2xl p-5 md:p-6 mb-5 border border-border/50 shadow-card">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-xl font-semibold text-foreground">Claims Available to You</h3>
            <p className="text-sm text-muted-foreground">Only links where your connected wallet is the receiver appear here.</p>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-lg bg-primary/10 border border-primary/20">
            <Wallet className="h-3.5 w-3.5 text-primary" />
            <span className="text-[10px] font-semibold text-primary uppercase tracking-wider">Receiver View</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              inputMode="text"
              placeholder="Search claim id or URL"
              value={claimId}
              onChange={(e) => setClaimId(e.target.value)}
              className="w-full bg-muted/50 border border-border rounded-xl pl-9 pr-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
            />
          </div>
          <button
            type="button"
            onClick={handleOpenClaim}
            disabled={!claimId.trim()}
            className="px-3.5 py-2.5 rounded-xl bg-primary text-primary-foreground disabled:opacity-50"
            aria-label="Load claim"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="space-y-3 mb-6">
        {!address && (
          <div className="glass rounded-2xl p-5 text-sm text-muted-foreground border border-border/40">
            Connect wallet to see claims available to you.
          </div>
        )}
        {address && !isSupabaseConfigured && (
          <div className="glass rounded-2xl p-5 text-sm text-muted-foreground border border-border/40">
            Supabase is not configured. Search by claim id still works.
          </div>
        )}
        {address && isSupabaseConfigured && isLoading && (
          <div className="glass rounded-2xl p-5 text-sm text-muted-foreground border border-border/40">Loading your claims…</div>
        )}
        {address && isSupabaseConfigured && !isLoading && receivedClaims.length === 0 && (
          <div className="glass rounded-2xl p-5 text-sm text-muted-foreground border border-border/40">
            No claim links available for your wallet.
          </div>
        )}
        {searchedClaimId && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className={`glass rounded-2xl p-4 flex items-center justify-between gap-3 border ${
              activeClaimId === searchedClaimId ? "border-primary/35" : "border-border/40"
            }`}
          >
            <div className="w-full">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-foreground">Search Result · Claim #{searchedClaimId}</div>
                  <div className="text-xs text-muted-foreground mt-1">Manual lookup from search input.</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveClaimId(searchedClaimId)}
                    className="px-3 py-2 rounded-lg border border-border/60 text-sm text-foreground hover:border-primary/30"
                  >
                    View Details
                  </button>
                  <button
                    type="button"
                    onClick={() => setSearchedClaimId(null)}
                    className="p-1.5 rounded-md hover:bg-muted/40 text-muted-foreground"
                    aria-label="Remove search result"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {activeClaimId === searchedClaimId && (
                <div className="mt-4 glass rounded-2xl p-4 border border-border/40">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="text-sm font-semibold text-foreground">Claim Details · #{activeClaimId}</h4>
                    <button
                      type="button"
                      onClick={() => setActiveClaimId(null)}
                      className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-muted/40"
                    >
                      Close
                    </button>
                  </div>
                  <ClaimFundsPage claimIdOverride={activeClaimId} embedded />
                </div>
              )}
            </div>
          </motion.div>
        )}
        {address &&
          receivedClaims.map((c) => (
            <motion.div
              key={`${c.chain_id}-${c.claim_id}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`glass rounded-2xl p-5 border shadow-card ${
                activeClaimId === c.claim_id ? "border-primary/35" : "border-border/40"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-base font-semibold text-foreground">Claim #{c.claim_id}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {formatUnits(BigInt(c.amount_in_wei), 18)} {c.token_in_symbol}
                  </div>
                </div>
                <span
                  className={`text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full font-semibold ${
                    c.status === "executed"
                      ? "bg-success/15 text-success"
                      : chainNowTs != null && chainNowTs >= BigInt(c.expiry_ts)
                        ? "bg-destructive/15 text-destructive/90"
                        : c.status === "open"
                          ? "bg-amber-500/15 text-amber-300"
                          : "bg-muted text-muted-foreground"
                  }`}
                >
                  {c.status === "executed"
                    ? c.status
                    : chainNowTs != null && chainNowTs >= BigInt(c.expiry_ts)
                      ? "expired"
                      : c.status}
                </span>
              </div>
              <div className="grid sm:grid-cols-3 gap-3 mt-4 text-xs">
                <div>
                  <span className="text-muted-foreground block mb-1">From</span>
                  <span className="font-mono text-foreground/80">{c.sender.slice(0, 8)}…{c.sender.slice(-6)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-1">Expires</span>
                  <span className="text-foreground/85">{new Date(Number(c.expiry_ts) * 1000).toLocaleString()}</span>
                </div>
                <div className="sm:text-right">
                  <button
                    type="button"
                    onClick={() => setActiveClaimId(c.claim_id)}
                    className="px-3 py-2 rounded-lg border border-border/60 text-sm text-foreground hover:border-primary/30"
                  >
                    View Details
                  </button>
                </div>
              </div>

              {activeClaimId === c.claim_id && (
                <div className="mt-4 glass rounded-2xl p-4 border border-border/40">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="text-sm font-semibold text-foreground">Claim Details · #{activeClaimId}</h4>
                    <button
                      type="button"
                      onClick={() => setActiveClaimId(null)}
                      className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-muted/40"
                    >
                      Close
                    </button>
                  </div>
                  <ClaimFundsPage claimIdOverride={activeClaimId} embedded />
                </div>
              )}
            </motion.div>
          ))}
      </div>
    </div>
  );
};

export default ClaimFunds;
