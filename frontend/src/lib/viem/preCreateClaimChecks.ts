import { formatEther, formatUnits } from "viem";
import { readContract } from "viem/actions";
import type { Address, PublicClient } from "viem";
import { erc20Abi } from "@/lib/contracts/erc20Abi";
import universalClaimLinksAbi from "@/lib/contracts/universalClaimLinksAbi.json";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function assertSufficientNativeBalance(
  publicClient: PublicClient,
  owner: Address,
  amountWei: bigint,
): Promise<void> {
  const bal = await publicClient.getBalance({ address: owner });
  if (bal < amountWei) {
    throw new Error(
      `Insufficient native RBTC (wallet tRBTC): have ${formatEther(bal)}, need ${formatEther(amountWei)}.`,
    );
  }
}

/**
 * Public RPCs (e.g. public-node.testnet.rsk.co) can lag behind the wallet’s receipt.
 * `simulateContract` / `eth_call` then still sees allowance 0 and `transferFrom` reverts.
 */
export async function waitForAllowanceVisible(
  publicClient: PublicClient,
  p: { token: Address; owner: Address; spender: Address; atLeast: bigint },
  opts?: { maxAttempts?: number; delayMs?: number },
): Promise<void> {
  const maxAttempts = opts?.maxAttempts ?? 30;
  const delayMs = opts?.delayMs ?? 500;
  for (let i = 0; i < maxAttempts; i++) {
    const allowance = await readContract(publicClient as never, {
      address: p.token,
      abi: erc20Abi,
      functionName: "allowance",
      args: [p.owner, p.spender],
    });
    if (allowance >= p.atLeast) return;
    await sleep(delayMs);
  }
  throw new Error(
    "Allowance still not visible on your RPC after approve. Wait a few seconds and retry, or set VITE_RSK_RPC_URL to another Rootstock testnet endpoint.",
  );
}

export async function assertCreateClaimPreflight(
  publicClient: PublicClient,
  p: {
    claimLinks: Address;
    tokenIn: Address;
    owner: Address;
    amountWei: bigint;
    decimals: number;
  },
): Promise<void> {
  const [wbtc, rif, usd, balance, nativeWei] = await Promise.all([
    readContract(publicClient as never, {
      address: p.claimLinks,
      abi: universalClaimLinksAbi,
      functionName: "tokenWRBTC",
    }),
    readContract(publicClient as never, {
      address: p.claimLinks,
      abi: universalClaimLinksAbi,
      functionName: "tokenRIF",
    }),
    readContract(publicClient as never, {
      address: p.claimLinks,
      abi: universalClaimLinksAbi,
      functionName: "tokenUSDRIF",
    }),
    readContract(publicClient as never, {
      address: p.tokenIn,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [p.owner],
    }),
    publicClient.getBalance({ address: p.owner }),
  ]);

  const t = p.tokenIn.toLowerCase();
  const supported = [wbtc, rif, usd].map((a) => (a as string).toLowerCase());
  if (!supported.includes(t)) {
    throw new Error(
      "This token address is not one of the three tokens configured on the deployed claim contract. Check frontend .env matches the contract deployment.",
    );
  }
  if (balance < p.amountWei) {
    const have = formatUnits(balance, p.decimals);
    const need = formatUnits(p.amountWei, p.decimals);
    const isWrbtc = t === (wbtc as string).toLowerCase();
    let hint = "";
    if (isWrbtc) {
      if (balance === 0n && nativeWei > 0n) {
        hint = ` Para/MetaMask “tRBTC” is almost always native testnet RBTC (for gas). This escrow only moves WRBTC (ERC-20) at ${p.tokenIn}—a separate balance. Get WRBTC from a faucet that lists the wrapped token, wrap via Rootstock tooling, or use RIF/USDRIF instead.`;
      } else if (balance === 0n) {
        hint = ` You need WRBTC (ERC-20) at ${p.tokenIn}, not native RBTC alone—or use RIF/USDRIF.`;
      }
    }
    throw new Error(`Insufficient balance: have ${have}, need ${need}.${hint}`);
  }
}
