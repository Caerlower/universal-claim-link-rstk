import { decodeEventLog, type Hash, type TransactionReceipt } from "viem";
import type { Address } from "viem";
import universalClaimLinksAbi from "./universalClaimLinksAbi.json";

export function parseClaimIdFromReceipt(
  receipt: TransactionReceipt,
  claimLinksAddress: Address
): bigint | null {
  const target = claimLinksAddress.toLowerCase();
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== target) continue;
    try {
      const decoded = decodeEventLog({
        abi: universalClaimLinksAbi,
        data: log.data,
        topics: log.topics as [Hash, ...Hash[]],
      });
      if (decoded.eventName === "ClaimCreated" && decoded.args && "claimId" in decoded.args) {
        return decoded.args.claimId as bigint;
      }
    } catch {
      // not this event
    }
  }
  return null;
}
