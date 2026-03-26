import type { Address } from "viem";
import { NATIVE_TOKEN_IN } from "@/lib/contracts/contractConfig";

/** Must stay in sync with `UniversalClaimLinks.sol` RATE_* constants. */
export const RATE_SCALE = 10n ** 18n;

const RATE_RBTC_TO_RIF = 50_000n * RATE_SCALE;
const RATE_RBTC_TO_USDRIF = 95_000n * RATE_SCALE;
const RATE_RIF_TO_RBTC = 20_000_000_000_000n;
const RATE_USDRIF_TO_RBTC = 10_526_315_789_473n;
const RATE_RIF_TO_USDRIF = 1_900_000_000_000_000_000n;
const RATE_USDRIF_TO_RIF = 526_315_789_473_684_210n;

const a = (x: Address) => x.toLowerCase();

/**
 * Fixed-point conversion rate for claim payout (matches on-chain `_conversionRate`).
 * `tokenOut` is always RIF or USDRIF when calling `executeClaim`.
 */
export function conversionRate(tokenIn: Address, tokenOut: Address, r: Address, u: Address): bigint {
  if (a(tokenIn) === a(tokenOut)) return RATE_SCALE;

  if (a(tokenIn) === a(NATIVE_TOKEN_IN) && a(tokenOut) === a(r)) return RATE_RBTC_TO_RIF;
  if (a(tokenIn) === a(NATIVE_TOKEN_IN) && a(tokenOut) === a(u)) return RATE_RBTC_TO_USDRIF;
  if (a(tokenIn) === a(r) && a(tokenOut) === a(NATIVE_TOKEN_IN)) return RATE_RIF_TO_RBTC;
  if (a(tokenIn) === a(u) && a(tokenOut) === a(NATIVE_TOKEN_IN)) return RATE_USDRIF_TO_RBTC;
  if (a(tokenIn) === a(r) && a(tokenOut) === a(u)) return RATE_RIF_TO_USDRIF;
  if (a(tokenIn) === a(u) && a(tokenOut) === a(r)) return RATE_USDRIF_TO_RIF;

  return 0n;
}

export function estimateAmountOut(
  amountIn: bigint,
  tokenIn: Address,
  tokenOut: Address,
  r: Address,
  u: Address
): bigint {
  const rate = conversionRate(tokenIn, tokenOut, r, u);
  if (rate === 0n) return 0n;
  return (amountIn * rate) / RATE_SCALE;
}
