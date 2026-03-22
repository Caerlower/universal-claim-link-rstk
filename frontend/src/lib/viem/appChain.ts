import { createPublicClient, http, type Chain, type PublicClient } from "viem";
import { hardhat, rootstock, rootstockTestnet } from "viem/chains";

/** Target chain for RPC + Para `useViemClient` (match your deployment). */
export function getAppChain(): Chain {
  const id = Number(import.meta.env.VITE_CHAIN_ID || 31);
  if (id === 30) return rootstock;
  if (id === 31) return rootstockTestnet;
  if (id === 31337) return hardhat;
  return rootstockTestnet;
}

/** Rootstock public HTTP RPC (no API key). See https://dev.rootstock.io/node-operators/public-nodes */
const PUBLIC_RSK_TESTNET_RPC = "https://public-node.testnet.rsk.co";
const PUBLIC_RSK_MAINNET_RPC = "https://public-node.rsk.co";

export function getRpcUrl(): string {
  const fromEnv = import.meta.env.VITE_RSK_RPC_URL?.trim();
  if (fromEnv) return fromEnv;
  const id = Number(import.meta.env.VITE_CHAIN_ID || 31);
  if (id === 31337) return "http://127.0.0.1:8545";
  if (id === 31) return PUBLIC_RSK_TESTNET_RPC;
  if (id === 30) return PUBLIC_RSK_MAINNET_RPC;
  return PUBLIC_RSK_TESTNET_RPC;
}

let cached: PublicClient | null = null;
let cachedKey = "";

export function getPublicClient(): PublicClient {
  const chain = getAppChain();
  const url = getRpcUrl();
  const key = `${chain.id}:${url}`;
  if (!cached || cachedKey !== key) {
    cached = createPublicClient({ chain, transport: http(url) });
    cachedKey = key;
  }
  return cached;
}
