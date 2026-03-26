/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PARA_API_KEY: string;
  /** Optional: e.g. `BETA` for sandbox keys — see Para docs */
  readonly VITE_PARA_ENV?: string;
  /** Full Rootstock JSON-RPC URL including API key segment, e.g. https://rpc.testnet.rootstock.io/<key> */
  readonly VITE_RSK_RPC_URL?: string;
  /** WalletConnect Cloud project id (Para external wallet flow) */
  readonly VITE_WALLETCONNECT_PROJECT_ID?: string;
  /** Rootstock explorer base URL, no trailing slash (WalletButton default: testnet) */
  readonly VITE_RSK_EXPLORER_URL?: string;
  readonly VITE_UNIVERSAL_CLAIM_LINKS_ADDRESS?: string;
  readonly VITE_TOKEN_RIF?: string;
  readonly VITE_TOKEN_USDRIF?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
