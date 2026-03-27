import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Check, ExternalLink } from "lucide-react";
import { bytesToHex, isAddress, keccak256, maxUint256, parseUnits } from "viem";
import { readContract, simulateContract, waitForTransactionReceipt, writeContract } from "viem/actions";
import { toast } from "sonner";
import universalClaimLinksAbi from "@/lib/contracts/universalClaimLinksAbi.json";
import { erc20Abi } from "@/lib/contracts/erc20Abi";
import { getClaimLinksEnv, tokenAddressForSymbol, type SupportedSymbol } from "@/lib/contracts/contractConfig";
import { parseClaimIdFromReceipt } from "@/lib/contracts/parseClaimCreated";
import { useParaViem } from "@/hooks/useParaViem";
import { getAppChain, getPublicClient, getRpcUrl } from "@/lib/viem/appChain";
import { assertCreateClaimPreflight, assertSufficientNativeBalance, waitForAllowanceVisible } from "@/lib/viem/preCreateClaimChecks";
import { formatWriteContractError } from "@/lib/viem/txErrors";
import { upsertClaimCreated } from "@/lib/supabase/claims";
import { isSupabaseConfigured } from "@/lib/supabase/client";

type ViemWriteClient = Parameters<typeof writeContract>[0];
type FlowState = "form" | "loading" | "success";

const tokens: { symbol: SupportedSymbol; name: string; logoUrl: string }[] = [
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

const toDateTimeLocal = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const formatExpiry = (value: string) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
};

const CreateClaim = () => {
  const env = getClaimLinksEnv();
  const { address, viemClient, ready } = useParaViem();
  const isConnected = !!address;

  const [selectedToken, setSelectedToken] = useState(0);
  const [claimMode, setClaimMode] = useState<"locked" | "open">("locked");
  const [amount, setAmount] = useState("");
  const [receiver, setReceiver] = useState("");
  const [expiryAt, setExpiryAt] = useState(() => {
    const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
    d.setSeconds(0, 0);
    return toDateTimeLocal(d);
  });
  const [state, setState] = useState<FlowState>("form");
  const [copied, setCopied] = useState(false);
  const [claimLink, setClaimLink] = useState("");
  const [lastTxHash, setLastTxHash] = useState<string | undefined>();

  const currentToken = tokens[selectedToken]?.symbol ?? "RBTC";
  const isOpenClaimMode = claimMode === "open";
  const explorerBase = import.meta.env.VITE_RSK_EXPLORER_URL?.replace(/\/$/, "") ?? "https://explorer.testnet.rootstock.io";

  const handleCreate = async () => {
    if (!env) {
      toast.error("Contract env missing");
      return;
    }
    if (!isConnected || !address || !viemClient) {
      toast.error("Connect wallet first");
      return;
    }
    if (!isOpenClaimMode) {
      if (!isAddress(receiver)) {
        toast.error("Enter a valid receiver address");
        return;
      }
      if (receiver.toLowerCase() === address.toLowerCase()) {
        toast.error("Receiver must be different from sender");
        return;
      }
    }
    if (!amount || Number(amount) <= 0) {
      toast.error("Enter an amount");
      return;
    }
    const expiryDate = new Date(expiryAt);
    if (Number.isNaN(expiryDate.getTime())) {
      toast.error("Select a valid expiry date and time");
      return;
    }

    setState("loading");
    setLastTxHash(undefined);

    try {
      const writeClient = viemClient as unknown as ViemWriteClient;
      const chain = getAppChain();
      const publicClient = getPublicClient();
      const tokenIn = tokenAddressForSymbol(env, currentToken);
      const useNativeRbtc = currentToken === "RBTC";
      const receiverForTx = receiver as `0x${string}`;
      const receiverForRecord = isOpenClaimMode
        ? "0x0000000000000000000000000000000000000000"
        : receiver.toLowerCase();

      let secretForLink: `0x${string}` | null = null;
      let secretHash: `0x${string}` | null = null;
      if (isOpenClaimMode) {
        const bytes = new Uint8Array(32);
        crypto.getRandomValues(bytes);
        secretForLink = bytesToHex(bytes);
        secretHash = keccak256(secretForLink);
      }

      let amountWei: bigint;
      let didApprove = false;
      if (useNativeRbtc) {
        amountWei = parseUnits(amount, 18);
        if (amountWei > BigInt("0xffffffffffffffffffffffffffffffff")) throw new Error("Amount too large");
        await assertSufficientNativeBalance(publicClient, address, amountWei);
      } else {
        const decimalsOnChain = await readContract(publicClient as never, {
          address: tokenIn,
          abi: erc20Abi,
          functionName: "decimals",
        } as never);
        const decimals = Number(decimalsOnChain);
        amountWei = parseUnits(amount, decimals);
        if (amountWei > BigInt("0xffffffffffffffffffffffffffffffff")) throw new Error("Amount too large");
        await assertCreateClaimPreflight(publicClient, {
          claimLinks: env.claimLinks,
          tokenIn,
          owner: address,
          amountWei,
          decimals,
        });

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
        }
      }

      const { timestamp: chainNow } = await publicClient.getBlock({ blockTag: "latest" });
      const expiryTs = BigInt(Math.floor(expiryDate.getTime() / 1000));
      if (expiryTs <= chainNow + 60n) {
        throw new Error("Expiry must be at least 1 minute in the future.");
      }
      const uint40Max = (1n << 40n) - 1n;
      if (expiryTs > uint40Max) {
        throw new Error("Expiry too far in the future (uint40 limit).");
      }

      let hashCreate: `0x${string}`;
      if (useNativeRbtc) {
        if (isOpenClaimMode) {
          hashCreate = await writeContract(writeClient as never, {
            chain,
            address: env.claimLinks,
            abi: universalClaimLinksAbi,
            functionName: "createClaimNativeOpen",
            args: [expiryTs, secretHash!],
            value: amountWei,
          } as never);
        } else {
          hashCreate = await writeContract(writeClient as never, {
            chain,
            address: env.claimLinks,
            abi: universalClaimLinksAbi,
            functionName: "createClaimNative",
            args: [receiverForTx, expiryTs],
            value: amountWei,
          } as never);
        }
      } else {
        const createArgs = isOpenClaimMode
          ? ([tokenIn, amountWei, expiryTs, secretHash!] as const)
          : ([receiverForTx, tokenIn, amountWei, expiryTs] as const);
        try {
          hashCreate = await writeContract(writeClient as never, {
            chain,
            address: env.claimLinks,
            abi: universalClaimLinksAbi,
            functionName: isOpenClaimMode ? "createClaimOpen" : "createClaim",
            args: createArgs,
          } as never);
        } catch (e) {
          if (didApprove) {
            const isPublic = /public-node\.testnet\.rsk\.co|public-node\.rsk\.co/i.test(getRpcUrl());
            await waitForAllowanceVisible(
              publicClient,
              { token: tokenIn, owner: address, spender: env.claimLinks, atLeast: amountWei },
              isPublic ? undefined : { maxAttempts: 6, delayMs: 250 },
            );
            hashCreate = await writeContract(writeClient as never, {
              chain,
              address: env.claimLinks,
              abi: universalClaimLinksAbi,
              functionName: isOpenClaimMode ? "createClaimOpen" : "createClaim",
              args: createArgs,
            } as never);
          } else {
            await simulateContract(publicClient as never, {
              address: env.claimLinks,
              abi: universalClaimLinksAbi,
              functionName: isOpenClaimMode ? "createClaimOpen" : "createClaim",
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
      if (claimId == null) throw new Error("Could not parse claim id");

      const path = `/app?tab=claim&id=${claimId.toString()}`;
      const full = `${window.location.origin}${path}${isOpenClaimMode && secretForLink ? `#${secretForLink}` : ""}`;
      setClaimLink(full);

      if (isSupabaseConfigured) {
        try {
          await upsertClaimCreated({
            claimId: claimId.toString(),
            chainId: chain.id,
            sender: address,
            receiver: receiverForRecord,
            tokenInSymbol: currentToken,
            amountInWei: amountWei.toString(),
            expiryTs: expiryTs.toString(),
            claimLink: full,
            createdTxHash: hashCreate,
          });
        } catch (dbError) {
          console.error("Supabase save failed:", dbError);
          toast.warning("Claim created on-chain, but history sync failed.");
        }
      }

      setState("success");
      toast.success("Claim created", { description: `Claim #${claimId.toString()}` });
    } catch (e: unknown) {
      const raw = e instanceof Error ? e.message : "Transaction failed";
      toast.error(formatWriteContractError(raw));
      setState("form");
    }
  };

  const handleCopy = async () => {
    if (!claimLink) return;
    await navigator.clipboard.writeText(claimLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="grid lg:grid-cols-2 gap-8">
      <div className="space-y-6">
        <div>
          <label className="tracking-label mb-3 block">Claim Type</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setClaimMode("locked")}
              className={`py-2.5 rounded-xl text-sm font-medium transition-all ${
                !isOpenClaimMode
                  ? "bg-primary/15 text-primary border border-primary/30"
                  : "bg-secondary/60 text-muted-foreground border border-border/50"
              }`}
            >
              Address-Locked
            </button>
            <button
              type="button"
              onClick={() => setClaimMode("open")}
              className={`py-2.5 rounded-xl text-sm font-medium transition-all ${
                isOpenClaimMode
                  ? "bg-primary/15 text-primary border border-primary/30"
                  : "bg-secondary/60 text-muted-foreground border border-border/50"
              }`}
            >
              Open (Secret)
            </button>
          </div>
        </div>

        {!isOpenClaimMode && (
          <div>
            <label className="tracking-label mb-3 block">Receiver Address</label>
            <input
              type="text"
              placeholder="0x..."
              value={receiver}
              onChange={(e) => setReceiver(e.target.value.trim())}
              className="w-full bg-muted/50 border border-border rounded-xl px-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
            />
          </div>
        )}

        {isOpenClaimMode && (
          <p className="text-xs text-muted-foreground">
            Open claim has no fixed receiver. The generated link includes a secret in the URL fragment (`#...`) so anyone
            with that link can claim.
          </p>
        )}
        

        <div>
          <label className="tracking-label mb-3 block">Token</label>
          <div className="grid grid-cols-3 gap-3">
            {tokens.map((token, i) => (
              <motion.button
                key={token.symbol}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedToken(i)}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all duration-200 ${
                  selectedToken === i ? "bg-primary/10 border-primary/40 shadow-sm" : "bg-muted/30 border-border hover:border-border/80"
                }`}
              >
                <div className="w-9 h-9 rounded-full bg-muted/40 border border-border/60 flex items-center justify-center overflow-hidden">
                  <img src={token.logoUrl} alt={token.symbol} className="h-7 w-7 object-contain" />
                </div>
                <span className="text-xs font-medium text-foreground">{token.symbol}</span>
              </motion.button>
            ))}
          </div>
        </div>

        <div>
          <label className="tracking-label mb-3 block">Amount</label>
          <input
            type="text"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full bg-muted/50 border border-border rounded-xl px-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
          />
        </div>

        <div>
          <label className="tracking-label mb-3 block">Expiry</label>
          <input
            type="datetime-local"
            value={expiryAt}
            min={toDateTimeLocal(new Date(Date.now() + 60 * 1000))}
            onChange={(e) => setExpiryAt(e.target.value)}
            className="w-full bg-muted/50 border border-border rounded-xl px-4 py-3.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all [color-scheme:dark]"
          />
          <p className="mt-1 text-xs text-muted-foreground">Choose exact date and time when this claim expires.</p>
        </div>

        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={() => void handleCreate()}
          disabled={!isConnected || !ready || state === "loading"}
          className="w-full py-4 rounded-xl bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-semibold text-sm shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all disabled:opacity-50"
        >
          {state === "loading" ? "Creating..." : "Create Claim Link"}
        </motion.button>
      </div>

      <div>
        <AnimatePresence mode="wait">
          {state !== "success" ? (
            <motion.div key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="glass rounded-2xl p-8 h-full">
              <h3 className="tracking-label mb-6">Live Preview</h3>
              <div className="space-y-5">
                <div className="flex justify-between items-center py-3 border-b border-border/30">
                  <span className="text-sm text-muted-foreground">Token</span>
                  <span className="text-sm font-medium text-foreground">{tokens[selectedToken].symbol}</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-border/30">
                  <span className="text-sm text-muted-foreground">Amount</span>
                  <span className="text-sm font-medium text-foreground">{amount || "—"}</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-border/30">
                  <span className="text-sm text-muted-foreground">Receiver</span>
                  <span className="text-sm font-mono text-foreground/70">
                    {isOpenClaimMode ? "Open (secret link)" : receiver ? `${receiver.slice(0, 6)}...${receiver.slice(-4)}` : "—"}
                  </span>
                </div>
                <div className="flex justify-between items-center py-3">
                  <span className="text-sm text-muted-foreground">Expiry</span>
                  <span className="text-sm font-medium text-foreground">{formatExpiry(expiryAt)}</span>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass rounded-2xl p-8 glow-orange-sm">
              <div className="text-center mb-8">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", bounce: 0.5 }} className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-primary" />
                </motion.div>
                <h3 className="text-lg font-semibold text-foreground mb-1">Claim Link Created</h3>
                <p className="text-sm text-muted-foreground">Share this link with the receiver</p>
              </div>

              <div className="bg-muted/40 rounded-xl p-4 mb-6">
                <p className="text-xs font-mono text-foreground/70 break-all">{claimLink}</p>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <button onClick={() => void handleCopy()} className="flex items-center justify-center gap-2 p-3 rounded-xl bg-muted/30 border border-border hover:border-primary/20 transition-all text-sm">
                  {copied ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
                  {copied ? "Copied!" : "Copy Link"}
                </button>
                {lastTxHash && (
                  <a
                    href={`${explorerBase}/tx/${lastTxHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 p-3 rounded-xl bg-secondary text-secondary-foreground text-sm font-medium border border-border hover:bg-secondary/80 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    View Receipt
                  </a>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default CreateClaim;
