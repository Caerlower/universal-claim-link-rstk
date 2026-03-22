import type { Address } from "viem";

export type SupportedSymbol = "RBTC" | "RIF" | "USDRIF";

export type ClaimLinksEnv = {
  claimLinks: Address;
  wrbtc: Address;
  rif: Address;
  usdrif: Address;
};

/**
 * Canonical Rootstock testnet (31) tokens — rsk-testnet-contract-metadata + dev.rootstock.io.
 * Used when VITE_TOKEN_* are omitted so you only set VITE_UNIVERSAL_CLAIM_LINKS_ADDRESS after deploy.
 */
export const ROOTSTOCK_TESTNET_TOKENS = {
  wrbtc: "0x09b6ca5e4496238a1f176aea6bb607db96c2286e",
  rif: "0x19f64674d8a5b4e652319f5e239efd3bc969a1fe",
  usdrif: "0x8dbf326e12a9ff37ed6ddf75ada548c2640a6482",
} as const satisfies Record<string, Address>;

export function getClaimLinksEnv(): ClaimLinksEnv | null {
  const chainId = Number(import.meta.env.VITE_CHAIN_ID || 31);
  const claimLinks = import.meta.env.VITE_UNIVERSAL_CLAIM_LINKS_ADDRESS?.trim();
  let wrbtc = import.meta.env.VITE_TOKEN_WRBTC?.trim();
  let rif = import.meta.env.VITE_TOKEN_RIF?.trim();
  let usdrif = import.meta.env.VITE_TOKEN_USDRIF?.trim();

  if (chainId === 31) {
    if (!wrbtc) wrbtc = ROOTSTOCK_TESTNET_TOKENS.wrbtc;
    if (!rif) rif = ROOTSTOCK_TESTNET_TOKENS.rif;
    if (!usdrif) usdrif = ROOTSTOCK_TESTNET_TOKENS.usdrif;
  }

  if (!claimLinks || !wrbtc || !rif || !usdrif) return null;
  return {
    claimLinks: claimLinks as Address,
    wrbtc: wrbtc as Address,
    rif: rif as Address,
    usdrif: usdrif as Address,
  };
}

export function tokenAddressForSymbol(env: ClaimLinksEnv, symbol: SupportedSymbol): Address {
  switch (symbol) {
    case "RBTC":
      return env.wrbtc;
    case "RIF":
      return env.rif;
    case "USDRIF":
      return env.usdrif;
    default:
      return env.wrbtc;
  }
}

export function symbolForTokenAddress(env: ClaimLinksEnv, token: Address): SupportedSymbol {
  const t = token.toLowerCase();
  if (t === env.wrbtc.toLowerCase()) return "RBTC";
  if (t === env.rif.toLowerCase()) return "RIF";
  if (t === env.usdrif.toLowerCase()) return "USDRIF";
  return "RBTC";
}
