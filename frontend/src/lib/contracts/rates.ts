import type { Address } from "viem";

/** Must stay in sync with `UniversalClaimLinks.sol` RATE_* constants. */
export const RATE_SCALE = 10n ** 18n;

const RATE_WRBTC_TO_RIF = 50_000n * RATE_SCALE;
const RATE_WRBTC_TO_USDRIF = 95_000n * RATE_SCALE;
const RATE_RIF_TO_WRBTC = 20_000_000_000_000n;
const RATE_USDRIF_TO_WRBTC = 10_526_315_789_473n;
const RATE_RIF_TO_USDRIF = 1_900_000_000_000_000_000n;
const RATE_USDRIF_TO_RIF = 526_315_789_473_684_210n;

export function conversionRate(
  tokenIn: Address,
  tokenOut: Address,
  w: Address,
  r: Address,
  u: Address
): bigint {
  if (tokenIn.toLowerCase() === tokenOut.toLowerCase()) return RATE_SCALE;
  const a = (x: Address) => x.toLowerCase();

  if (a(tokenIn) === a(w) && a(tokenOut) === a(r)) return RATE_WRBTC_TO_RIF;
  if (a(tokenIn) === a(w) && a(tokenOut) === a(u)) return RATE_WRBTC_TO_USDRIF;
  if (a(tokenIn) === a(r) && a(tokenOut) === a(w)) return RATE_RIF_TO_WRBTC;
  if (a(tokenIn) === a(u) && a(tokenOut) === a(w)) return RATE_USDRIF_TO_WRBTC;
  if (a(tokenIn) === a(r) && a(tokenOut) === a(u)) return RATE_RIF_TO_USDRIF;
  if (a(tokenIn) === a(u) && a(tokenOut) === a(r)) return RATE_USDRIF_TO_RIF;

  return 0n;
}

export function estimateAmountOut(
  amountIn: bigint,
  tokenIn: Address,
  tokenOut: Address,
  w: Address,
  r: Address,
  u: Address
): bigint {
  const rate = conversionRate(tokenIn, tokenOut, w, r, u);
  if (rate === 0n) return 0n;
  return (amountIn * rate) / RATE_SCALE;
}
