import { numberToHex } from "viem";
import type { EIP1193Provider } from "viem";

/**
 * Some injected bridges reject `eth_chainId`. viem still calls it for JSON-RPC accounts.
 */
export function eip1193WithEthChainIdFallback(
  provider: EIP1193Provider,
  chainId: number,
): EIP1193Provider {
  const fallbackHex = numberToHex(chainId);
  const innerRequest = provider.request.bind(provider) as EIP1193Provider["request"];

  return {
    ...provider,
    request: async (args) => {
      if (args.method === "eth_chainId") {
        try {
          const result = await innerRequest(args);
          if (typeof result === "string" && result.startsWith("0x") && result.length >= 3) {
            return result;
          }
        } catch {
          /* ignore */
        }
        return fallbackHex;
      }
      return innerRequest(args);
    },
  } as EIP1193Provider;
}
