import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowRight, Wallet, RefreshCw } from "lucide-react";
import { useAccount } from "@getpara/react-sdk";
import { readContract, writeContract, waitForTransactionReceipt } from "viem/actions";
import { formatUnits } from "viem";
import { toast } from "sonner";
import TokenSelector from "@/components/TokenSelector";
import StatusIndicator from "@/components/StatusIndicator";
import universalClaimLinksAbi from "@/lib/contracts/universalClaimLinksAbi.json";
import {
  getClaimLinksEnv,
  symbolForTokenAddress,
  tokenAddressForSymbol,
  type SupportedSymbol,
} from "@/lib/contracts/contractConfig";
import { estimateAmountOut } from "@/lib/contracts/rates";
import { getAppChain, getPublicClient } from "@/lib/viem/appChain";
import { formatWriteContractError } from "@/lib/viem/txErrors";
import { useParaViem } from "@/hooks/useParaViem";

type ViemWriteClient = Parameters<typeof writeContract>[0];

type ClaimState = "details" | "loading" | "success" | "error";

const STATUS_OPEN = 0;

const ClaimFunds = () => {
  const { id } = useParams<{ id: string }>();
  const env = getClaimLinksEnv();
  const queryClient = useQueryClient();
  const { isConnected } = useAccount();
  const { address, viemClient, ready, isExternalEvm, hasInjectedProvider } = useParaViem();

  const [state, setState] = useState<ClaimState>("details");
  const [tokenOut, setTokenOut] = useState<SupportedSymbol>("RBTC");
  const [lastTxHash, setLastTxHash] = useState<string | undefined>();

  const claimId = useMemo(() => {
    if (!id || id === "demo") return null;
    try {
      const n = BigInt(id);
      if (n < 0n) return null;
      return n;
    } catch {
      return null;
    }
  }, [id]);

  const { data: claim, refetch } = useQuery({
    queryKey: ["claim", env?.claimLinks, claimId?.toString()],
    enabled: !!env && claimId != null,
    queryFn: async () => {
      const pc = getPublicClient();
      return readContract(pc, {
        address: env!.claimLinks,
        abi: universalClaimLinksAbi,
        functionName: "getClaim",
        args: [claimId!],
      });
    },
  });

  const explorerBase =
    import.meta.env.VITE_RSK_EXPLORER_URL?.replace(/\/$/, "") ?? "https://explorer.testnet.rootstock.io";

  const tokenInSymbol = env && claim?.tokenIn ? symbolForTokenAddress(env, claim.tokenIn) : "RBTC";
  const amountInFmt = claim?.amountIn != null ? formatUnits(claim.amountIn, 18) : "0";
  const tokenOutAddr = env ? tokenAddressForSymbol(env, tokenOut) : undefined;
  const estOut =
    env && claim?.tokenIn && tokenOutAddr
      ? estimateAmountOut(claim.amountIn, claim.tokenIn, tokenOutAddr, env.wrbtc, env.rif, env.usdrif)
      : 0n;
  const estOutFmt = formatUnits(estOut, 18);

  const isReceiver =
    !!address && !!claim?.receiver && address.toLowerCase() === claim.receiver.toLowerCase();
  const claimStatus = claim != null ? Number(claim.status) : -1;
  const canClaim =
    claim != null &&
    claimStatus === STATUS_OPEN &&
    claimId != null &&
    isReceiver &&
    env &&
    !!viemClient &&
    ready &&
    BigInt(Math.floor(Date.now() / 1000)) < BigInt(claim.expiry);

  const handleClaim = async () => {
    if (!env || claimId == null || !claim || !viemClient) return;
    if (!isConnected || !address) {
      toast.error("Connect with Para");
      return;
    }
    if (!isReceiver) {
      toast.error("Only the designated receiver can claim.");
      return;
    }
    if (Number(claim.status) !== STATUS_OPEN) {
      toast.error("This claim is not open.");
      return;
    }
    if (BigInt(Math.floor(Date.now() / 1000)) >= BigInt(claim.expiry)) {
      toast.error("This claim has expired.");
      return;
    }

    const out = tokenAddressForSymbol(env, tokenOut);
    setState("loading");
    setLastTxHash(undefined);

    try {
      const writeClient = viemClient as unknown as ViemWriteClient;

      const hash = await writeContract(writeClient, {
        chain: getAppChain(),
        address: env.claimLinks,
        abi: universalClaimLinksAbi,
        functionName: "executeClaim",
        args: [claimId, out],
      });
      setLastTxHash(hash);
      const receipt = await waitForTransactionReceipt(writeClient, { hash });
      if (receipt.status !== "success") throw new Error("Claim failed");
      await queryClient.invalidateQueries({ queryKey: ["claim", env.claimLinks, claimId.toString()] });
      await refetch();
      setState("success");
      toast.success("Claim completed");
    } catch (e: unknown) {
      console.error(e);
      const raw = e instanceof Error ? e.message : "Transaction failed";
      toast.error(formatWriteContractError(raw));
      setState("error");
    }
  };

  if (!env) {
    return (
      <div className="min-h-screen pt-24 pb-16 px-4 text-center text-sm text-muted-foreground">
        Configure <code className="text-primary">VITE_UNIVERSAL_CLAIM_LINKS_ADDRESS</code> and token env vars.
      </div>
    );
  }

  if (claimId == null) {
    return (
      <div className="min-h-screen pt-24 pb-16 px-4 text-center text-sm text-muted-foreground max-w-md mx-auto">
        Invalid claim link. Use a URL like <code className="text-primary">/claim/1</code> with the numeric claim id from the creator.
      </div>
    );
  }

  if (claim === undefined) {
    return (
      <div className="min-h-screen pt-24 pb-16 px-4 text-center text-sm text-muted-foreground">
        Loading claim…
      </div>
    );
  }

  if (!claim.sender || claim.sender === "0x0000000000000000000000000000000000000000") {
    return (
      <div className="min-h-screen pt-24 pb-16 px-4 text-center text-sm text-muted-foreground">
        No claim found for id <span className="text-foreground font-mono">{id}</span>.
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-16 px-4">
      <div className="fixed inset-0 bg-grid-pattern opacity-30 pointer-events-none" />
      <div
        className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(ellipse, hsl(32 94% 53% / 0.06), transparent 70%)" }}
      />

      <div className="relative max-w-lg mx-auto">
        <div className="text-center mb-8 animate-fade-up">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground text-balance" style={{ lineHeight: "1.1" }}>
            <span className="text-gradient-orange">Claim</span> your funds
          </h1>
          <p className="mt-3 text-sm text-muted-foreground max-w-sm mx-auto">
            Claim #{id} · hardcoded rates in contract (no DEX).
          </p>
        </div>

        <div className="glass-card p-6 md:p-8 animate-fade-up" style={{ animationDelay: "100ms" }}>
          {(state === "details" || state === "error") && (
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-secondary/40 border border-border/30 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">From</span>
                  <span className="font-mono text-foreground text-xs">
                    {claim.sender.slice(0, 8)}…{claim.sender.slice(-6)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Deposited</span>
                  <span className="font-semibold text-foreground">
                    {amountInFmt} {tokenInSymbol}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <span className="text-foreground text-xs">
                    {claimStatus === 0 ? "Open" : claimStatus === 1 ? "Executed" : "Cancelled"}
                  </span>
                </div>
              </div>

              <div className="flex justify-center">
                <div className="h-10 w-10 rounded-xl bg-secondary/60 border border-border/50 flex items-center justify-center">
                  <ArrowDown className="h-4 w-4 text-primary" />
                </div>
              </div>

              <TokenSelector value={tokenOut} onChange={(s) => setTokenOut(s as SupportedSymbol)} label="Receive as" />

              <div className="p-4 rounded-xl bg-primary/5 border border-primary/15">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">Estimated received</span>
                  <div className="flex items-center gap-1.5">
                    <RefreshCw className="h-3 w-3 text-primary/60" />
                    <span className="text-lg font-bold text-foreground">{estOutFmt}</span>
                    <span className="text-sm text-muted-foreground font-medium">{tokenOut}</span>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground/70 mt-1.5">
                  Contract must hold enough {tokenOut} to pay out. Same-token claims use 1:1.
                </p>
              </div>

              {!isConnected && <p className="text-xs text-amber-500/90 text-center">Connect with Para to claim.</p>}
              {isConnected && !ready && isExternalEvm && !hasInjectedProvider && (
                <p className="text-xs text-amber-500/90 text-center">
                  Browser wallet not detected. Use MetaMask (or Para embedded wallet) to sign the claim.
                </p>
              )}
              {isConnected && !ready && !(isExternalEvm && !hasInjectedProvider) && (
                <p className="text-xs text-muted-foreground text-center">Preparing your Para wallet…</p>
              )}
              {isConnected && ready && !isReceiver && (
                <p className="text-xs text-destructive/90 text-center">Connected wallet is not the receiver for this claim.</p>
              )}
              {claimStatus !== STATUS_OPEN && (
                <p className="text-xs text-muted-foreground text-center">This claim cannot be executed.</p>
              )}

              {state === "error" && <StatusIndicator status="error" message="Transaction failed. Try again or check the explorer." />}

              <button
                type="button"
                onClick={() => void handleClaim()}
                disabled={!canClaim || !isConnected}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm btn-primary-glow transition-all duration-200 hover:brightness-110 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Wallet className="h-4 w-4" />
                Claim now
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {state === "loading" && (
            <div className="flex flex-col items-center py-12 animate-fade-in">
              <div className="relative h-16 w-16 mb-6">
                <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
                <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary animate-spin-slow" />
                <div className="absolute inset-3 rounded-full bg-primary/10 flex items-center justify-center">
                  <ArrowDown className="h-5 w-5 text-primary" />
                </div>
              </div>
              <p className="text-sm font-medium text-foreground">Confirm in Para…</p>
            </div>
          )}

          {state === "success" && (
            <div className="animate-fade-up">
              <div className="flex flex-col items-center mb-6">
                <div className="h-14 w-14 rounded-full bg-success/10 flex items-center justify-center mb-4 glow-success">
                  <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" className="stroke-success" strokeWidth="2" />
                    <path
                      d="M8 12.5l2.5 2.5 5-5"
                      className="stroke-success"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray="100"
                      strokeDashoffset="100"
                      style={{ animation: "check-draw 0.5s ease-out 0.2s forwards" }}
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-foreground">Funds claimed</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  You received{" "}
                  <span className="text-foreground font-semibold">
                    {estOutFmt} {tokenOut}
                  </span>
                </p>
              </div>

              {lastTxHash && (
                <StatusIndicator
                  status="success"
                  message="Claim transaction confirmed"
                  txHash={lastTxHash}
                  explorerBase={explorerBase}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClaimFunds;
