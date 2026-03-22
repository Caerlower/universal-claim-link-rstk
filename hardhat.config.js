require("dotenv").config();
require("@nomicfoundation/hardhat-toolbox");

/** @param {string | undefined} pk */
function hardhatAccounts(pk) {
  if (!pk || typeof pk !== "string") return [];
  const t = pk.trim();
  if (!t) return [];
  return [t.startsWith("0x") ? t : `0x${t}`];
}

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: false,
    },
  },
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
    rootstockTestnet: {
      url:
        process.env.RSK_RPC_URL?.trim() ||
        process.env.RSK_TESTNET_RPC_URL?.trim() ||
        "https://public-node.testnet.rsk.co",
      accounts: hardhatAccounts(process.env.PRIVATE_KEY),
      chainId: 31,
    },
    rootstock: {
      url: process.env.RSK_RPC_URL_MAINNET || "",
      accounts: hardhatAccounts(process.env.PRIVATE_KEY),
      chainId: 30,
    },
  },
};
