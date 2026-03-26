import type { Address } from "viem";

export type SupportedSymbol = "RBTC" | "RIF" | "USDRIF";

/** Matches `UniversalClaimLinks.TOKEN_NATIVE` — native tRBTC/RBTC in `Claim.tokenIn`. */
export const NATIVE_TOKEN_IN: Address = "0x0000000000000000000000000000000000000000";

export type ClaimLinksEnv = {
  claimLinks: Address;
  rif: Address;
  usdrif: Address;
};

/**
 * Canonical Rootstock testnet (31) ERC-20s — rsk-testnet-contract-metadata + dev.rootstock.io.
 * Native RBTC / tRBTC uses no token address; claims store `tokenIn = address(0)`.
 */
export const ROOTSTOCK_TESTNET_TOKENS = {
  rif: "0x19f64674d8a5b4e652319f5e239efd3bc969a1fe",
  usdrif: "0x8dbf326e12a9ff37ed6ddf75ada548c2640a6482",
} as const satisfies Record<string, Address>;

export function getClaimLinksEnv(): ClaimLinksEnv | null {
  const chainId = Number(import.meta.env.VITE_CHAIN_ID || 31);
  const claimLinks = import.meta.env.VITE_UNIVERSAL_CLAIM_LINKS_ADDRESS?.trim();
  let rif = import.meta.env.VITE_TOKEN_RIF?.trim();
  let usdrif = import.meta.env.VITE_TOKEN_USDRIF?.trim();

  if (chainId === 31) {
    if (!rif) rif = ROOTSTOCK_TESTNET_TOKENS.rif;
    if (!usdrif) usdrif = ROOTSTOCK_TESTNET_TOKENS.usdrif;
  }

  if (!claimLinks || !rif || !usdrif) return null;
  return {
    claimLinks: claimLinks as Address,
    rif: rif as Address,
    usdrif: usdrif as Address,
  };
}

export function tokenAddressForSymbol(env: ClaimLinksEnv, symbol: SupportedSymbol): Address {
  switch (symbol) {
    case "RBTC":
      return NATIVE_TOKEN_IN;
    case "RIF":
      return env.rif;
    case "USDRIF":
      return env.usdrif;
    default:
      return env.rif;
  }
}

export function symbolForTokenAddress(env: ClaimLinksEnv, token: Address): SupportedSymbol {
  const t = token.toLowerCase();
  if (t === NATIVE_TOKEN_IN.toLowerCase()) return "RBTC";
  if (t === env.rif.toLowerCase()) return "RIF";
  if (t === env.usdrif.toLowerCase()) return "USDRIF";
  return "RIF";
}
