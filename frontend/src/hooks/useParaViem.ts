import { useEffect, useMemo, useState } from "react";
import { createWalletClient, custom, http, type EIP1193Provider, type WalletClient } from "viem";
import { useViemClient } from "@getpara/react-sdk/evm";
import { useAccount, useClient, useWallet } from "@getpara/react-sdk";
import { getAppChain, getRpcUrl } from "@/lib/viem/appChain";
import { eip1193WithEthChainIdFallback } from "@/lib/viem/eip1193ChainIdFallback";
import {
  bestInjectedProviderSync,
  orderedInjectedCandidates,
  resolveInjectedProviderForAddress,
} from "@/lib/viem/injectedProvider";
import {
  createParaExternalEvmWalletClient,
  type ParaEvmSigningClient,
} from "@/lib/viem/paraExternalWalletClient";

export type ParaViem = {
  address: `0x${string}` | undefined;
  viemClient: WalletClient | null;
  isViemLoading: boolean;
  ready: boolean;
  isExternalEvm: boolean;
  hasInjectedProvider: boolean;
};

/**
 * Viem wallet client for contract writes.
 * - Para embedded wallet: `@getpara/react-sdk/evm` `useViemClient`.
 * - External EVM in `para.wallets`: Para `signTransaction` + HTTP broadcast.
 * - Linked external (MetaMask / WC): real browser EIP-1193 that supports `eth_sendTransaction`.
 *   We resolve `ethereum.providers` + `eth_accounts` so MetaMask wins over a Para proxy that cannot send txs.
 */
export function useParaViem(): ParaViem {
  const para = useClient();
  const { isConnected } = useAccount();
  const { data: wallet } = useWallet();
  const rawAddress = wallet?.address as `0x${string}` | undefined;
  const [stableAddress, setStableAddress] = useState<`0x${string}` | undefined>(rawAddress);

  useEffect(() => {
    if (rawAddress) {
      setStableAddress(rawAddress);
      return;
    }
    // Para can briefly clear wallet data during connect/session refresh.
    // Keep the last known address for a short grace period to avoid false disconnect UX.
    const timer = setTimeout(() => {
      if (!isConnected) setStableAddress(undefined);
    }, 6000);
    return () => clearTimeout(timer);
  }, [rawAddress, isConnected]);

  const address = stableAddress;

  const chain = getAppChain();
  const { viemClient: paraEmbeddedClient, isLoading } = useViemClient({
    address,
    walletClientConfig: {
      chain,
      transport: http(getRpcUrl()),
    },
  });

  const isExternalEvm = useMemo(() => {
    if (!para || !address) return false;
    const w = para.findWallet(address) as { isExternal?: boolean } | undefined;
    return !!w?.isExternal;
  }, [para, address]);

  const externalViemMode = useMemo(() => {
    if (!isExternalEvm || !address || !para) return "off" as const;
    try {
      const w = para.findWalletByAddress(address, { type: ["EVM"] }) as { id: string };
      const paraWallets = (para as { wallets?: Record<string, unknown> }).wallets;
      if (w.id && paraWallets?.[w.id]) return "para_sign" as const;
    } catch {
      /* use injected */
    }
    return "injected" as const;
  }, [isExternalEvm, address, para]);

  const [resolvedInjected, setResolvedInjected] = useState<EIP1193Provider | undefined>(undefined);

  useEffect(() => {
    if (externalViemMode !== "injected" || !address) {
      setResolvedInjected(undefined);
      return;
    }
    setResolvedInjected(bestInjectedProviderSync());
    let cancelled = false;
    void resolveInjectedProviderForAddress(address).then((p) => {
      if (!cancelled) setResolvedInjected(p ?? bestInjectedProviderSync());
    });
    return () => {
      cancelled = true;
    };
  }, [externalViemMode, address]);

  const { externalLinkedClient, externalMissingInjected } = useMemo(() => {
    if (externalViemMode === "off") {
      return { externalLinkedClient: null as WalletClient | null, externalMissingInjected: false };
    }
    if (externalViemMode === "para_sign") {
      if (!address || !para) {
        return { externalLinkedClient: null, externalMissingInjected: false };
      }
      try {
        return {
          externalLinkedClient: createParaExternalEvmWalletClient(
            para as unknown as ParaEvmSigningClient,
            address,
            chain,
            getRpcUrl(),
          ) as WalletClient,
          externalMissingInjected: false,
        };
      } catch (e) {
        console.error("Para signTransaction client:", e);
        return { externalLinkedClient: null, externalMissingInjected: false };
      }
    }
    const injected =
      resolvedInjected ?? bestInjectedProviderSync() ?? orderedInjectedCandidates()[0];
    if (!injected) {
      return { externalLinkedClient: null, externalMissingInjected: true };
    }
    return {
      externalLinkedClient: createWalletClient({
        account: address!,
        chain,
        transport: custom(eip1193WithEthChainIdFallback(injected, chain.id)),
      }) as WalletClient,
      externalMissingInjected: false,
    };
  }, [externalViemMode, address, para, chain, resolvedInjected]);

  const viemClient = (paraEmbeddedClient ?? externalLinkedClient ?? null) as WalletClient | null;
  const waitingOnEmbeddedSdk = isLoading && !isExternalEvm;
  const ready = !!address && !!viemClient && !waitingOnEmbeddedSdk;

  return {
    address,
    viemClient,
    isViemLoading: waitingOnEmbeddedSdk,
    ready,
    isExternalEvm,
    hasInjectedProvider: !externalMissingInjected,
  };
}
