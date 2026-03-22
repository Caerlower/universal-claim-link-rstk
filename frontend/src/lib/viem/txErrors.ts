/** Turn low-level RPC errors into something actionable for wallet / Para setups. */
export function formatWriteContractError(message: string): string {
  if (/eth_sendTransaction is not supported/i.test(message)) {
    return [
      "The active browser provider does not support sending transactions (common when Para’s proxy is first in the stack).",
      "Fix: use Para’s embedded wallet for this app, or open the site with MetaMask as the signing wallet (multiple extensions: pick MetaMask in the provider list).",
    ].join(" ");
  }
  return message;
}
