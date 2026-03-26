/** Turn low-level RPC errors into something actionable for wallet / Para setups. */
export function formatWriteContractError(message: string): string {
  if (/eth_sendTransaction is not supported/i.test(message)) {
    return [
      "The active browser provider does not support sending transactions (common when Para’s proxy is first in the stack).",
      "Fix: use Para’s embedded wallet for this app, or open the site with MetaMask as the signing wallet (multiple extensions: pick MetaMask in the provider list).",
    ].join(" ");
  }
  if (/InsufficientLiquidity/i.test(message)) {
    return [
      "The claim contract does not hold enough RIF or USDRIF to pay you at the hardcoded rate.",
      "Escrowed RBTC/RIF stays in the contract for accounting; payouts come from a separate balance.",
      "Fix: send the payout token (RIF or USDRIF, whichever you chose) to the UniversalClaimLinks contract address, then claim again.",
    ].join(" ");
  }
  if (/ClaimExpired|execution reverted.*ClaimExpired/i.test(message)) {
    return "This claim has expired on-chain (chain time ≥ expiry). The receiver can no longer execute it.";
  }
  if (/NotReceiver|execution reverted.*NotReceiver/i.test(message)) {
    return "Only the receiver address set on the claim can execute it. Connect the correct wallet.";
  }
  if (/UnsupportedToken|execution reverted.*UnsupportedToken/i.test(message)) {
    return "That output token is not supported. Choose RIF or USDRIF.";
  }
  if (/InvalidAmount|execution reverted.*InvalidAmount/i.test(message)) {
    return "Payout amount rounded to zero (try a larger claim or a different token pair).";
  }
  if (/NotOpen|execution reverted.*NotOpen/i.test(message)) {
    return "This claim is no longer open (already claimed or cancelled).";
  }
  return message;
}

/** When a tx is included but reverts, RPC rarely decodes the reason — keep the hint anyway. */
export function claimRevertedReceiptHint(tokenOutLabel: string): string {
  return [
    `Transaction reverted on-chain. Most often the escrow contract needs enough ${tokenOutLabel} on hand to pay you (send ${tokenOutLabel} to the same contract address you use for claims).`,
    "Open the tx in the block explorer for raw revert data.",
  ].join(" ");
}
