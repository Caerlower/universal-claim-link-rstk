/**
 * Deploy UniversalClaimLinks.
 *
 * Local Hardhat (chain 31337): deploys MockERC20 x3 + UniversalClaimLinks, prints env lines for frontend/.env
 * Rootstock testnet (31): RSK_RPC_URL + PRIVATE_KEY only — uses canonical WRBTC / tRIF / USDRIF unless TOKEN_* set
 *
 * After changing the Solidity contract, run: npm run sync:abi
 */
const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

/** Canonical Rootstock testnet — rsk-testnet-contract-metadata + dev.rootstock.io */
const ROOTSTOCK_TESTNET_TOKENS = {
  WRBTC: "0x09b6ca5e4496238a1f176aea6bb607db96c2286e",
  RIF: "0x19f64674d8a5b4e652319f5e239efd3bc969a1fe",
  USDRIF: "0x8dbf326e12a9ff37ed6ddf75ada548c2640a6482",
};

async function main() {
  const { ethers, network } = hre;
  const signers = await ethers.getSigners();
  if (signers.length === 0) {
    throw new Error(
      "No deployer account for this network. Put PRIVATE_KEY in the repo root .env (0x… or 64 hex chars). Hardhat loads .env via dotenv.",
    );
  }
  const [deployer] = signers;
  const net = await ethers.provider.getNetwork();
  const chainId = Number(net.chainId);

  let wrbtc;
  let rif;
  let usdrif;

  const isLocal = chainId === 31337 || network.name === "hardhat";

  if (isLocal) {
    const Mock = await ethers.getContractFactory("MockERC20");
    wrbtc = await Mock.deploy("Wrapped RBTC", "WRBTC");
    rif = await Mock.deploy("RIF Token", "RIF");
    usdrif = await Mock.deploy("USDRIF", "USDRIF");
    await wrbtc.waitForDeployment();
    await rif.waitForDeployment();
    await usdrif.waitForDeployment();
    wrbtc = await wrbtc.getAddress();
    rif = await rif.getAddress();
    usdrif = await usdrif.getAddress();
    console.log("Deployed local MockERC20 tokens.");

    const mintTo = process.env.MINT_TO;
    if (mintTo) {
      const m = (addr) => ethers.getContractAt("MockERC20", addr);
      const q = ethers.parseEther("1000000");
      await (await m(wrbtc)).mint(mintTo, q);
      await (await m(rif)).mint(mintTo, q);
      await (await m(usdrif)).mint(mintTo, q);
      console.log("Minted 1_000_000e18 of each token to MINT_TO=", mintTo);
    }
  } else if (chainId === 31) {
    wrbtc = process.env.TOKEN_WRBTC || ROOTSTOCK_TESTNET_TOKENS.WRBTC;
    rif = process.env.TOKEN_RIF || ROOTSTOCK_TESTNET_TOKENS.RIF;
    usdrif = process.env.TOKEN_USDRIF || ROOTSTOCK_TESTNET_TOKENS.USDRIF;
    console.log("Using Rootstock testnet canonical tokens (override with TOKEN_WRBTC / TOKEN_RIF / TOKEN_USDRIF).");
  } else {
    wrbtc = process.env.TOKEN_WRBTC;
    rif = process.env.TOKEN_RIF;
    usdrif = process.env.TOKEN_USDRIF;
    if (!wrbtc || !rif || !usdrif) {
      throw new Error("Set TOKEN_WRBTC, TOKEN_RIF, TOKEN_USDRIF for this network.");
    }
  }

  const UniversalClaimLinks = await ethers.getContractFactory("UniversalClaimLinks");
  const claimLinks = await UniversalClaimLinks.deploy(wrbtc, rif, usdrif);
  await claimLinks.waitForDeployment();
  const claimAddress = await claimLinks.getAddress();

  console.log("\n=== UniversalClaimLinks ===");
  console.log("Chain ID:", chainId);
  console.log("Contract:  ", claimAddress);
  console.log("WRBTC:     ", wrbtc);
  console.log("RIF:       ", rif);
  console.log("USDRIF:    ", usdrif);
  console.log("\n=== Add to frontend/.env ===\n");
  console.log(`VITE_UNIVERSAL_CLAIM_LINKS_ADDRESS=${claimAddress}`);
  console.log(`VITE_TOKEN_WRBTC=${wrbtc}`);
  console.log(`VITE_TOKEN_RIF=${rif}`);
  console.log(`VITE_TOKEN_USDRIF=${usdrif}`);
  console.log("");

  const out = {
    chainId,
    universalClaimLinks: claimAddress,
    tokenWRBTC: wrbtc,
    tokenRIF: rif,
    tokenUSDRIF: usdrif,
    deployedAt: new Date().toISOString(),
  };
  const outFile = path.join(__dirname, "../deployments", `deployment-${chainId}.json`);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(out, null, 2));
  console.log("Saved", outFile);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
