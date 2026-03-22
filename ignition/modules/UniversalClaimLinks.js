const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

/**
 * Local / testnet: deploys three `contracts/dev/MockERC20` tokens and UniversalClaimLinks.
 * For Rootstock mainnet, swap the three `m.contract("MockERC20", ...)` lines for
 * `m.getParameter("wrbtc")`, `m.getParameter("rif")`, `m.getParameter("usdrif")`
 * and supply addresses via `ignition/parameters.json` (see Hardhat Ignition docs).
 */
module.exports = buildModule("UniversalClaimLinksModule", (m) => {
  const wrbtc = m.contract("MockERC20", ["Wrapped RBTC", "WRBTC"], { id: "MockWRBTC" });
  const rif = m.contract("MockERC20", ["RIF Token", "RIF"], { id: "MockRIF" });
  const usdrif = m.contract("MockERC20", ["USDRIF", "USDRIF"], { id: "MockUSDRIF" });

  const universalClaimLinks = m.contract("UniversalClaimLinks", [wrbtc, rif, usdrif]);

  return { universalClaimLinks, wrbtc, rif, usdrif };
});
