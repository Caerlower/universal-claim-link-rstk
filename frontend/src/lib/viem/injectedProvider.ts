import type { EIP1193Provider } from "viem";

type InjectedFlags = {
  isMetaMask?: boolean;
  isRabby?: boolean;
  isCoinbaseWallet?: boolean;
  isBraveWallet?: boolean;
  isTrust?: boolean;
  isPhantom?: boolean;
};

function providerScore(p: EIP1193Provider): number {
  const f = p as InjectedFlags;
  if (f.isMetaMask) return 100;
  if (f.isRabby) return 95;
  if (f.isCoinbaseWallet) return 85;
  if (f.isBraveWallet) return 85;
  if (f.isTrust) return 80;
  if (f.isPhantom) return 15;
  return 50;
}

/** Prefer real browser wallets over generic / aggregator `window.ethereum` (often first in the list). */
export function orderedInjectedCandidates(): EIP1193Provider[] {
  if (typeof window === "undefined") return [];
  const eth = (window as Window & { ethereum?: EIP1193Provider & { providers?: EIP1193Provider[] } })
    .ethereum;
  if (!eth) return [];
  const raw =
    Array.isArray(eth.providers) && eth.providers.length > 0 ? [...eth.providers] : [eth];
  return raw.sort((a, b) => providerScore(b) - providerScore(a));
}

/** Sync pick (no `eth_accounts`); use when async resolve has not run yet. */
export function bestInjectedProviderSync(): EIP1193Provider | undefined {
  const list = orderedInjectedCandidates();
  return list[0];
}

/**
 * Use the injected stack that actually controls `address` and supports normal wallet RPC.
 * Tries higher-priority wallets first so MetaMask/Rabby win over a Para-only proxy.
 */
export async function resolveInjectedProviderForAddress(
  address: string,
): Promise<EIP1193Provider | undefined> {
  const want = address.toLowerCase();
  const candidates = orderedInjectedCandidates();
  if (candidates.length === 0) return undefined;

  for (const p of candidates) {
    try {
      const accounts = (await p.request({ method: "eth_accounts", params: [] })) as string[];
      if (accounts.some((a) => typeof a === "string" && a.toLowerCase() === want)) {
        return p;
      }
    } catch {
      /* try next */
    }
  }

  return candidates[0];
}
