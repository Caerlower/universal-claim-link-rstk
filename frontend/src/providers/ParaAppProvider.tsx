import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Environment, ParaProvider } from "@getpara/react-sdk";
import { rootstockTestnet } from "viem/chains";
import "@getpara/react-sdk/styles.css";
import { useTheme } from "@/providers/ThemeProvider";

const queryClient = new QueryClient();

/** Rootstock testnet metadata for Para modal balances (see https://dev.rootstock.io/developers/quickstart/para/) */
const ROOTSTOCK_TESTNET = {
  name: "Rootstock Testnet",
  evmChainId: "31" as const,
  nativeTokenSymbol: "tRBTC",
  logoUrl:
    "https://raw.githubusercontent.com/rsksmart/rsk-contract-metadata/refs/heads/master/images/rootstock-orange.png",
  // Default: Rootstock public testnet node (override with VITE_RSK_RPC_URL if needed).
  rpcUrl: import.meta.env.VITE_RSK_RPC_URL?.trim() || "https://public-node.testnet.rsk.co",
  explorer: {
    name: "Rootstock Testnet Explorer",
    url: "https://explorer.testnet.rootstock.io",
    txUrlFormat: "https://explorer.testnet.rootstock.io/tx/{HASH}",
  },
  isTestnet: true,
};

const evmChains = [rootstockTestnet] as const;

type ParaAppProviderProps = {
  children: React.ReactNode;
};

export function ParaAppProvider({ children }: ParaAppProviderProps) {
  const apiKey = import.meta.env.VITE_PARA_API_KEY ?? "";
  const paraEnv = import.meta.env.VITE_PARA_ENV;
  const walletConnectProjectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID?.trim();
  // Theme is used for the app UI; Para modal is intentionally kept in the clean light style.
  useTheme();
  const appName = "RootClaim";

  // Enable WalletConnect only when a project id is provided in env.
  const wallets = walletConnectProjectId
    ? (["METAMASK", "PHANTOM", "WALLETCONNECT"] as const)
    : (["METAMASK", "PHANTOM"] as const);

  const env =
    paraEnv?.toUpperCase() === "PROD" ? Environment.PROD : Environment.BETA;

  return (
    <QueryClientProvider client={queryClient}>
      <ParaProvider
        paraClientConfig={{
          env,
          apiKey,
        }}
        externalWalletConfig={{
          appName,
          wallets,
          ...(walletConnectProjectId
            ? {
                walletConnect: {
                  projectId: walletConnectProjectId,
                },
              }
            : {}),
          includeWalletVerification: true,
          evmConnector: {
            config: {
              chains: evmChains,
            },
          },
        }}
        config={{ appName }}
        paraModalConfig={{
          balances: {
            displayType: "AGGREGATED",
            requestType: "MAINNET_AND_TESTNET",
            additionalAssets: [
              {
                name: "tRBTC",
                symbol: "tRBTC",
                logoUrl:
                  "https://raw.githubusercontent.com/rsksmart/rsk-contract-metadata/refs/heads/master/images/rootstock-orange.png",
                implementations: [
                  {
                    network: ROOTSTOCK_TESTNET,
                  },
                ],
              },
              {
                name: "tRIF Token",
                symbol: "tRIF",
                logoUrl:
                  "https://raw.githubusercontent.com/rsksmart/rsk-contract-metadata/refs/heads/master/images/rif.png",
                price: {
                  value: 1,
                  currency: "USD",
                },
                implementations: [
                  {
                    network: ROOTSTOCK_TESTNET,
                    contractAddress: "0x19f64674d8a5b4e652319f5e239efd3bc969a1fe",
                  },
                ],
              },
            ],
          },
          disableEmailLogin: false,
          disablePhoneLogin: false,
          authLayout: ["AUTH:FULL", "EXTERNAL:FULL"],
          oAuthMethods: ["GOOGLE", "TWITTER", "TELEGRAM"],
          onRampTestMode: true,
          theme: {
            // Match Para's clean light aesthetic (rounded, soft neutrals) like the reference screenshot.
            foregroundColor: "#111111",
            backgroundColor: "#FFFFFF",
            accentColor: "#111111",
            // Dark fields kept for completeness, but we force `mode: "light"` below.
            darkForegroundColor: "#FFFFFF",
            darkBackgroundColor: "#0B0B0B",
            darkAccentColor: "#FFFFFF",
            // Keep Para modal in the clean light aesthetic (like the reference screenshot).
            mode: "light",
            borderRadius: "large",
            font: "SF Pro Display",
          },
          logo: "/download.svg",
          recoverySecretStepEnabled: true,
          twoFactorAuthEnabled: false,
        }}
      >
        {children}
      </ParaProvider>
    </QueryClientProvider>
  );
}
