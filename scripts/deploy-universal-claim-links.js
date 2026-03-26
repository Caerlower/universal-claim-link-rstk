/**
 * Deploy UniversalClaimLinks.
 *
 * Local Hardhat (chain 31337): deploys MockERC20 (RIF + USDRIF) + UniversalClaimLinks, prints env lines for frontend/.env
 * Rootstock testnet (31): RSK_RPC_URL + PRIVATE_KEY — uses canonical tRIF / USDRIF unless TOKEN_* set
 *
 * After changing the Solidity contract, run: npm run sync:abi
 */
const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

/** Canonical Rootstock testnet — rsk-testnet-contract-metadata + dev.rootstock.io */
const ROOTSTOCK_TESTNET_TOKENS = {
  RIF: "0x19f64674d8a5b4e652319f5e239efd3bc969a1fe",
  USDRIF: "0x8dbf326e12a9ff37ed6ddf75ada548c2640a6482",
};

const ERC20_ABI = [
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function balanceOf(address owner) external view returns (uint256)",
];

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

  let rif;
  let usdrif;

  const isLocal = chainId === 31337 || network.name === "hardhat";

  if (isLocal) {
    const Mock = await ethers.getContractFactory("MockERC20");
    rif = await Mock.deploy("RIF Token", "RIF");
    usdrif = await Mock.deploy("USDRIF", "USDRIF");
    await rif.waitForDeployment();
    await usdrif.waitForDeployment();
    rif = await rif.getAddress();
    usdrif = await usdrif.getAddress();
    console.log("Deployed local MockERC20 tokens (RIF, USDRIF).");

    const mintTo = process.env.MINT_TO;
    if (mintTo) {
      const m = (addr) => ethers.getContractAt("MockERC20", addr);
      const q = ethers.parseEther("1000000");
      await (await m(rif)).mint(mintTo, q);
      await (await m(usdrif)).mint(mintTo, q);
      console.log("Minted 1_000_000e18 of each token to MINT_TO=", mintTo);
    }
  } else if (chainId === 31) {
    rif = process.env.TOKEN_RIF || ROOTSTOCK_TESTNET_TOKENS.RIF;
    usdrif = process.env.TOKEN_USDRIF || ROOTSTOCK_TESTNET_TOKENS.USDRIF;
    console.log("Using Rootstock testnet canonical tokens (override with TOKEN_RIF / TOKEN_USDRIF).");
  } else {
    rif = process.env.TOKEN_RIF;
    usdrif = process.env.TOKEN_USDRIF;
    if (!rif || !usdrif) {
      throw new Error("Set TOKEN_RIF, TOKEN_USDRIF for this network.");
    }
  }

  const UniversalClaimLinks = await ethers.getContractFactory("UniversalClaimLinks");
  const claimLinks = await UniversalClaimLinks.deploy(rif, usdrif);
  await claimLinks.waitForDeployment();
  const claimAddress = await claimLinks.getAddress();

  // Optional: auto-fund payout liquidity so each new deploy is usable immediately.
  // Set env vars (examples):
  //   FUND_LIQUIDITY=1
  //   FUND_RBTC=0.02
  //   FUND_RIF=10000
  //   FUND_USDRIF=0
  if (process.env.FUND_LIQUIDITY === "1") {
    const fundRbtc = (process.env.FUND_RBTC || "").trim();
    const fundRif = (process.env.FUND_RIF || "").trim();
    const fundUsd = (process.env.FUND_USDRIF || "").trim();

    console.log("\n=== Funding liquidity (optional) ===");
    console.log("Deployer:", deployer.address);

    if (fundRbtc) {
      const value = ethers.parseEther(fundRbtc);
      const tx = await deployer.sendTransaction({ to: claimAddress, value });
      await tx.wait();
      console.log(`Funded native RBTC: ${fundRbtc} → ${claimAddress}`);
    } else {
      console.log("Skipped native RBTC funding (set FUND_RBTC).");
    }

    const fundErc20 = async (tokenAddr, label, amountStr) => {
      if (!amountStr) {
        console.log(`Skipped ${label} funding (set FUND_${label}).`);
        return;
      }
      const amountWei = ethers.parseEther(amountStr);
      const token = await ethers.getContractAt(ERC20_ABI, tokenAddr);
      const bal = await token.balanceOf(deployer.address);
      if (bal < amountWei) {
        throw new Error(
          `Deployer has insufficient ${label}. Have ${ethers.formatEther(bal)}, need ${amountStr}. Get tokens first, or lower FUND_${label}.`,
        );
      }
      const tx = await token.transfer(claimAddress, amountWei);
      await tx.wait();
      console.log(`Funded ${label}: ${amountStr} → ${claimAddress}`);
    };

    await fundErc20(rif, "RIF", fundRif);
    await fundErc20(usdrif, "USDRIF", fundUsd);
  }

  console.log("\n=== UniversalClaimLinks ===");
  console.log("Chain ID:", chainId);
  console.log("Contract:  ", claimAddress);
  console.log("RIF:       ", rif);
  console.log("USDRIF:    ", usdrif);
  console.log("\n=== Add to frontend/.env ===\n");
  console.log(`VITE_UNIVERSAL_CLAIM_LINKS_ADDRESS=${claimAddress}`);
  console.log(`VITE_TOKEN_RIF=${rif}`);
  console.log(`VITE_TOKEN_USDRIF=${usdrif}`);
  console.log("");

  const out = {
    chainId,
    universalClaimLinks: claimAddress,
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
