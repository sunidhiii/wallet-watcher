import "dotenv/config";

export interface Config {
  rpcUrl: string;
  mnemonic: string;
  walletCount: number;
  pollIntervalMs: number;
  port: number;
}

/**
 * Reads and validates configuration from environment variables (loaded from .env).
 * Throws early with a clear message if anything required is missing or invalid,
 * rather than failing confusingly later on.
 */
export function loadConfig(): Config {
  const rpcUrl = process.env.SEPOLIA_RPC_URL ?? "https://rpc.sepolia.org";
  const mnemonic = process.env.MNEMONIC;
  const walletCount = Number(process.env.WALLET_COUNT ?? 5);
  const pollIntervalMs = Number(process.env.POLL_INTERVAL_MS ?? 5 * 60 * 1000);
  const port = Number(process.env.PORT ?? 3000);

  if (!mnemonic) {
    throw new Error("MNEMONIC is required. Copy .env.example to .env and set a testnet-only mnemonic.");
  }
  if (!Number.isInteger(walletCount) || walletCount < 1 || walletCount > 20) {
    throw new Error("WALLET_COUNT must be an integer between 1 and 20.");
  }
  if (!Number.isFinite(pollIntervalMs) || pollIntervalMs <= 0 || pollIntervalMs > 10 * 60 * 1000) {
    throw new Error("POLL_INTERVAL_MS must be a positive number no greater than 600000 (10 minutes).");
  }

  return { rpcUrl, mnemonic, walletCount, pollIntervalMs, port };
}
