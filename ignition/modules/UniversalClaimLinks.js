const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

/**
 * Local / testnet: deploys two `contracts/dev/MockERC20` tokens (RIF, USDRIF) and UniversalClaimLinks.
 * For Rootstock mainnet, swap mocks for `m.getParameter("rif")`, `m.getParameter("usdrif")`
 * and supply addresses via `ignition/parameters.json` (see Hardhat Ignition docs).
 */
module.exports = buildModule("UniversalClaimLinksModule", (m) => {
  const rif = m.contract("MockERC20", ["RIF Token", "RIF"], { id: "MockRIF" });
  const usdrif = m.contract("MockERC20", ["USDRIF", "USDRIF"], { id: "MockUSDRIF" });

  const universalClaimLinks = m.contract("UniversalClaimLinks", [rif, usdrif]);

  return { universalClaimLinks, rif, usdrif };
});
