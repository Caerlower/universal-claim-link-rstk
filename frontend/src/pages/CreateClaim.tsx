import { useState } from "react";
import { Link2, Copy, Check, ArrowRight, Clock } from "lucide-react";
import { readContract, simulateContract, writeContract, waitForTransactionReceipt } from "viem/actions";
import { isAddress, maxUint256, parseUnits } from "viem";
import { toast } from "sonner";
import TokenSelector from "@/components/TokenSelector";
import StatusIndicator from "@/components/StatusIndicator";
import universalClaimLinksAbi from "@/lib/contracts/universalClaimLinksAbi.json";
import { erc20Abi } from "@/lib/contracts/erc20Abi";
import { getClaimLinksEnv, tokenAddressForSymbol, type SupportedSymbol } from "@/lib/contracts/contractConfig";
import { parseClaimIdFromReceipt } from "@/lib/contracts/parseClaimCreated";
import { useParaViem } from "@/hooks/useParaViem";
import { getAppChain, getPublicClient, getRpcUrl } from "@/lib/viem/appChain";
import {
  assertCreateClaimPreflight,
  assertSufficientNativeBalance,
  waitForAllowanceVisible,
} from "@/lib/viem/preCreateClaimChecks";
import { formatWriteContractError } from "@/lib/viem/txErrors";

/** Matches `viem/actions` client type (Para bundles a second viem copy → avoid `never`). */
type ViemWriteClient = Parameters<typeof writeContract>[0];

type FlowState = "form" | "loading" | "success";

const CreateClaim = () => {
  const env = getClaimLinksEnv();
  const { address, viemClient, ready, isExternalEvm, hasInjectedProvider } = useParaViem();
  const isConnected = !!address;

  const [state, setState] = useState<FlowState>("form");
  const [receiver, setReceiver] = useState("");
  const [token, setToken] = useState<SupportedSymbol>("RBTC");
  const [amount, setAmount] = useState("");
  const [expiry, setExpiry] = useState("24");
  const [copied, setCopied] = useState(false);
  const [claimLink, setClaimLink] = useState("");
  const [lastTxHash, setLastTxHash] = useState<string | undefined>();

  const explorerBase =
    import.meta.env.VITE_RSK_EXPLORER_URL?.replace(/\/$/, "") ?? "https://explorer.testnet.rootstock.io";

  const handleCreate = async () => {
    if (!env) {
      toast.error("Contract env missing", {
        description: "Set VITE_UNIVERSAL_CLAIM_LINKS_ADDRESS (and RIF / USDRIF if not using chain 31 defaults) in frontend/.env",
      });
      return;
    }
    if (!isConnected || !address || !viemClient) {
      toast.error("Connect with Para first");
      return;
    }
    if (!isAddress(receiver)) {
      toast.error("Enter a valid receiver address");
      return;
    }
    if (receiver.toLowerCase() === address.toLowerCase()) {
      toast.error("Receiver must be different from your wallet (same as the contract rule).");
      return;
    }
    if (!amount || Number(amount) <= 0) {
      toast.error("Enter an amount");
      return;
    }

    const tokenIn = tokenAddressForSymbol(env, token);
    const useNativeRbtc = token === "RBTC";

    const hoursNum = Number(expiry);
    if (!Number.isFinite(hoursNum) || hoursNum <= 0) {
      toast.error("Enter a positive expiry (hours)");
      return;
    }

    setState("loading");
    setLastTxHash(undefined);

    try {
      const writeClient = viemClient as unknown as ViemWriteClient;
      const chain = getAppChain();
      const publicClient = getPublicClient();

      let amountWei: bigint;
      let decimals: number;
      let didApprove = false;

      if (useNativeRbtc) {
        decimals = 18;
        try {
          amountWei = parseUnits(amount, decimals);
        } catch {
          throw new Error("Invalid amount");
        }
        if (amountWei > BigInt("0xffffffffffffffffffffffffffffffff")) {
          throw new Error("Amount too large for a single claim (uint128 limit).");
        }
        await assertSufficientNativeBalance(publicClient, address, amountWei);
      } else {
        const decimalsOnChain = await readContract(publicClient as never, {
          address: tokenIn,
          abi: erc20Abi,
          functionName: "decimals",
        } as never);
        decimals = Number(decimalsOnChain);
        if (!Number.isFinite(decimals) || decimals < 0 || decimals > 36) {
          throw new Error("Token returned invalid decimals()");
        }
        try {
          amountWei = parseUnits(amount, decimals);
        } catch {
          throw new Error("Invalid amount for this token’s decimals");
        }
        if (amountWei > BigInt("0xffffffffffffffffffffffffffffffff")) {
          throw new Error("Amount too large for a single claim (uint128 limit).");
        }
        await assertCreateClaimPreflight(publicClient, {
          claimLinks: env.claimLinks,
          tokenIn,
          owner: address,
          amountWei,
          decimals,
        });

        // Speed: only approve if needed.
        const allowance = await readContract(publicClient as never, {
          address: tokenIn,
          abi: erc20Abi,
          functionName: "allowance",
          args: [address, env.claimLinks],
        } as never);
        if (allowance < amountWei) {
          const hashApprove = await writeContract(writeClient as never, {
            chain,
            address: tokenIn,
            abi: erc20Abi,
            functionName: "approve",
            args: [env.claimLinks, maxUint256],
          } as never);
          const receiptApprove = await waitForTransactionReceipt(writeClient, { hash: hashApprove });
          if (receiptApprove.status !== "success") throw new Error("Approve failed");
          didApprove = true;

          // Don't block here on fast RPCs. We'll retry the create once if the node still
          // doesn't see the allowance immediately (common on laggy public nodes).
        }

      }

      /** Contract checks `expiry > block.timestamp`. Use chain time, not `Date.now()`, or RSK can revert `InvalidExpiry`. */
      const { timestamp: chainNow } = await publicClient.getBlock({ blockTag: "latest" });
      const durationSec = BigInt(Math.ceil(hoursNum * 3600));
      const expiryTs = chainNow + durationSec + 300n;
      const uint40Max = (1n << 40n) - 1n;
      if (expiryTs > uint40Max) {
        throw new Error("Expiry too far in the future (uint40 limit)");
      }

      let hashCreate: `0x${string}`;
      if (useNativeRbtc) {
        try {
          hashCreate = await writeContract(writeClient as never, {
            chain,
            address: env.claimLinks,
            abi: universalClaimLinksAbi,
            functionName: "createClaimNative",
            args: [receiver as `0x${string}`, expiryTs],
            value: amountWei,
          } as never);
        } catch (e) {
          // Fallback: simulation to get a readable revert reason.
          await simulateContract(publicClient as never, {
            address: env.claimLinks,
            abi: universalClaimLinksAbi,
            functionName: "createClaimNative",
            args: [receiver as `0x${string}`, expiryTs],
            account: address,
            value: amountWei,
          } as never);
          throw e;
        }
      } else {
        const createArgs = [receiver as `0x${string}`, tokenIn, amountWei, expiryTs] as const;
        try {
          hashCreate = await writeContract(writeClient as never, {
            chain,
            address: env.claimLinks,
            abi: universalClaimLinksAbi,
            functionName: "createClaim",
            args: createArgs,
          } as never);
        } catch (e) {
          // If we just approved, some RPCs still don't see the allowance. Wait briefly then retry once.
          if (didApprove) {
            const rpc = getRpcUrl();
            const isPublic = /public-node\.testnet\.rsk\.co|public-node\.rsk\.co/i.test(rpc);
            await waitForAllowanceVisible(
              publicClient,
              { token: tokenIn, owner: address, spender: env.claimLinks, atLeast: amountWei },
              isPublic ? undefined : { maxAttempts: 6, delayMs: 250 },
            );
            hashCreate = await writeContract(writeClient as never, {
              chain,
              address: env.claimLinks,
              abi: universalClaimLinksAbi,
              functionName: "createClaim",
              args: createArgs,
            } as never);
          } else {
            await simulateContract(publicClient as never, {
              address: env.claimLinks,
              abi: universalClaimLinksAbi,
              functionName: "createClaim",
              args: createArgs,
              account: address,
            } as never);
            throw e;
          }
        }
      }
      setLastTxHash(hashCreate);
      const receiptCreate = await waitForTransactionReceipt(writeClient, { hash: hashCreate });
      if (receiptCreate.status !== "success") throw new Error("createClaim failed");

      const claimId = parseClaimIdFromReceipt(receiptCreate, env.claimLinks);
      if (claimId == null) throw new Error("Could not parse claim id from logs");

      const path = `/claim/${claimId.toString()}`;
      setClaimLink(`${window.location.origin}${path}`);
      setState("success");
      toast.success("Claim created", { description: `Claim #${claimId.toString()}` });
    } catch (e: unknown) {
      console.error(e);
      const raw = e instanceof Error ? e.message : "Transaction failed";
      toast.error(formatWriteContractError(raw));
      setState("form");
    }
  };

  const handleCopy = () => {
    void navigator.clipboard.writeText(claimLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    setState("form");
    setReceiver("");
    setAmount("");
    setToken("RBTC");
    setExpiry("24");
    setClaimLink("");
    setLastTxHash(undefined);
  };

  if (!env) {
    return (
      <div className="min-h-screen pt-24 pb-16 px-4">
        <div className="relative max-w-lg mx-auto glass-card p-6 text-sm text-muted-foreground space-y-3">
          <p className="font-semibold text-foreground">Contract not configured</p>
          <p>
            Deploy <strong>UniversalClaimLinks</strong> to Rootstock testnet from the repo root, then set{" "}
            <code className="text-primary">VITE_UNIVERSAL_CLAIM_LINKS_ADDRESS</code> in{" "}
            <code className="text-primary">frontend/.env</code> to the printed contract address. Canonical tRIF / USDRIF
            are filled automatically when <code className="text-primary">VITE_CHAIN_ID=31</code> (native RBTC claims need no
            token address).
          </p>
          <pre className="text-xs bg-secondary/80 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap">
            npm run compile{"\n"}
            {"# Repo root: RSK_RPC_URL (e.g. https://public-node.testnet.rsk.co), PRIVATE_KEY\n"}
            npm run deploy:rstest{"\n"}
            npm run sync:frontend-env
          </pre>
          <p>
            The app uses the <strong>public</strong> testnet RPC by default (
            <code className="text-primary">public-node.testnet.rsk.co</code>) if{" "}
            <code className="text-primary">VITE_RSK_RPC_URL</code> is unset. You still must set{" "}
            <code className="text-primary">VITE_UNIVERSAL_CLAIM_LINKS_ADDRESS</code> (use{" "}
            <code className="text-primary">sync:frontend-env</code> after deploy, or paste it).
          </p>
          <p>Restart Vite after editing <code className="text-primary">.env</code>.</p>
        </div>
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
            Create a <span className="text-gradient-orange">Claim Link</span>
          </h1>
          <p className="mt-3 text-sm text-muted-foreground max-w-sm mx-auto">
            Deposit tokens on-chain and share the link with the receiver.
          </p>
        </div>

        <div className="glass-card p-6 md:p-8 animate-fade-up" style={{ animationDelay: "100ms" }}>
          {!isConnected && (
            <p className="text-sm text-amber-500/90 mb-4 text-center">Connect with Para to create a claim.</p>
          )}
          {isConnected && !ready && isExternalEvm && !hasInjectedProvider && (
            <p className="text-sm text-amber-500/90 mb-4 text-center">
              Browser wallet (e.g. MetaMask) not detected. Install or unlock it, or use your Para embedded wallet to sign
              transactions.
            </p>
          )}
          {isConnected && !ready && !(isExternalEvm && !hasInjectedProvider) && (
            <p className="text-sm text-muted-foreground mb-4 text-center">Preparing your Para wallet…</p>
          )}

          {state === "form" && (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                  Receiver address
                </label>
                <input
                  type="text"
                  value={receiver}
                  onChange={(e) => setReceiver(e.target.value.trim())}
                  placeholder="0x…"
                  className="w-full px-4 py-3 rounded-xl bg-secondary/60 border border-border/50 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary/30 transition-all"
                />
              </div>

              <TokenSelector value={token} onChange={(s) => setToken(s as SupportedSymbol)} label="Token" />

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                  Amount
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-4 py-3 rounded-xl bg-secondary/60 border border-border/50 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary/30 transition-all pr-16"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                    {token}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  <span className="font-medium text-foreground/90">RBTC</span> uses native testnet RBTC (wallet “tRBTC”) sent with the transaction. RIF / USDRIF use ERC-20 approve + transfer.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                  <Clock className="inline h-3 w-3 mr-1 -mt-0.5" />
                  Expires in
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {["1", "6", "24", "72"].map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setExpiry(h)}
                      className={`py-2.5 rounded-xl text-sm font-medium transition-all duration-200 active:scale-[0.96] ${
                        expiry === h
                          ? "bg-primary/15 text-primary border border-primary/30"
                          : "bg-secondary/60 text-muted-foreground border border-border/50 hover:border-primary/20 hover:text-foreground"
                      }`}
                    >
                      {h}h
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => void handleCreate()}
                disabled={!amount || !isConnected || !ready}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm btn-primary-glow transition-all duration-200 hover:brightness-110 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none mt-2"
              >
                Create Claim Link
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
                  <Link2 className="h-5 w-5 text-primary" />
                </div>
              </div>
              <p className="text-sm font-medium text-foreground">Confirm in Para…</p>
              <p className="text-xs text-muted-foreground mt-1">Approve then create claim</p>
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
                <h3 className="text-lg font-bold text-foreground">Claim link created</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {amount} {token} escrowed · expires in {expiry}h
                </p>
              </div>

              <div className="flex items-center gap-2 p-3 rounded-xl bg-secondary/60 border border-border/50">
                <Link2 className="h-4 w-4 text-primary shrink-0" />
                <span className="text-sm text-foreground font-mono truncate flex-1">{claimLink}</span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/15 text-primary text-xs font-semibold transition-all duration-200 hover:bg-primary/25 active:scale-[0.95]"
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>

              {lastTxHash && (
                <div className="mt-4">
                  <StatusIndicator status="success" message="On-chain deposit confirmed" txHash={lastTxHash} explorerBase={explorerBase} />
                </div>
              )}

              <button
                type="button"
                onClick={handleReset}
                className="w-full mt-5 py-3 rounded-xl border border-border/50 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all duration-200 active:scale-[0.97]"
              >
                Create another link
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreateClaim;
