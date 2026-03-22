import {
  createWalletClient,
  hashMessage,
  hashTypedData,
  http,
  parseSignature,
  serializeSignature,
  serializeTransaction,
  type Address,
  type Chain,
  type Hash,
  type Hex,
  type SignableMessage,
  type TypedDataDefinition,
} from "viem";
import { hashAuthorization } from "viem/utils";
import { toAccount } from "viem/accounts";

/** Match Para SDK / `rlpEncodedTxBase64` (hex body without `0x`). */
export function hexStringToBase64(hex: string): string {
  const hexClean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(hexClean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hexClean.slice(i * 2, i * 2 + 2), 16);
  }
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

function normalizeSignature(rawSignature: string): Hex {
  const sigHex = rawSignature.startsWith("0x") ? rawSignature : `0x${rawSignature}`;
  const parsed = parseSignature(sigHex as Hex);
  return serializeSignature({ r: parsed.r, s: parsed.s, yParity: parsed.yParity });
}

/** Minimal Para Core surface used here (from `useClient()`). */
export type ParaEvmSigningClient = {
  findWalletByAddress(
    addr: string,
    opts: { type: string[] },
  ): { id: string; address: string; publicKey?: string };
  signMessage: (opts: {
    walletId: string;
    messageBase64: string;
  }) => Promise<{ signature: string }>;
  signTransaction: (opts: {
    walletId: string;
    rlpEncodedTxBase64: string;
    chainId?: string;
  }) => Promise<{ signature: string }>;
};

/**
 * Linked external EVM wallet in Para: signing goes through `para.signTransaction` / `signMessage`,
 * broadcast via HTTP RPC (`eth_sendRawTransaction`). Does not rely on `eth_signTransaction` on `window.ethereum`.
 */
export function createParaExternalEvmWalletClient(
  para: ParaEvmSigningClient,
  address: Address,
  chain: Chain,
  rpcHttpUrl: string,
) {
  const currentWallet = para.findWalletByAddress(address, { type: ["EVM"] });
  if (!currentWallet?.id) {
    throw new Error(`Para: no EVM wallet registered for ${address}`);
  }
  const walletId = currentWallet.id;

  const account = toAccount({
    address: currentWallet.address as Address,
    publicKey: (currentWallet.publicKey || "0x") as Hex,
    sign: async ({ hash }) => {
      const res = await para.signMessage({
        walletId,
        messageBase64: hexStringToBase64(hash),
      });
      return normalizeSignature(res.signature);
    },
    signMessage: async ({ message }: { message: SignableMessage }) => {
      const hashedMessage = hashMessage(message);
      const res = await para.signMessage({
        walletId,
        messageBase64: hexStringToBase64(hashedMessage),
      });
      return normalizeSignature(res.signature);
    },
    signTransaction: async (transaction, { serializer = serializeTransaction } = {}) => {
      const serializedTx = await serializer(transaction, {
        r: "0x",
        s: "0x",
        v: BigInt(0),
      });
      const res = await para.signTransaction({
        walletId,
        rlpEncodedTxBase64: hexStringToBase64(serializedTx.substring(2)),
        chainId: transaction.chainId != null ? String(transaction.chainId) : undefined,
      });
      const normalizedSig = normalizeSignature(res.signature);
      const parsed = parseSignature(normalizedSig);
      return serializer(transaction, {
        r: parsed.r,
        s: parsed.s,
        v: parsed.v,
      });
    },
    signTypedData: async <
      const typedData extends Record<string, unknown>,
      primaryType extends keyof typedData | "EIP712Domain",
    >(
      parameters: TypedDataDefinition<typedData, primaryType>,
    ) => {
      const res = await para.signMessage({
        walletId,
        messageBase64: hexStringToBase64(hashTypedData(parameters)),
      });
      return normalizeSignature(res.signature);
    },
    signAuthorization: async (authorization) => {
      const addr =
        (authorization as { contractAddress?: Address }).contractAddress ??
        (authorization as { address?: Address }).address;
      if (!addr) throw new Error("signAuthorization: missing address");
      const hash = hashAuthorization({
        address: addr,
        chainId: authorization.chainId,
        nonce: authorization.nonce,
      });
      const res = await para.signMessage({
        walletId,
        messageBase64: hexStringToBase64(hash),
      });
      const sigHex = res.signature.startsWith("0x") ? res.signature : `0x${res.signature}`;
      const parsed = parseSignature(sigHex as Hex);
      return {
        address: addr,
        chainId: authorization.chainId,
        nonce: authorization.nonce,
        r: parsed.r,
        s: parsed.s,
        yParity: parsed.yParity,
      };
    },
  });

  return createWalletClient({
    account,
    chain,
    transport: http(rpcHttpUrl),
  });
}
