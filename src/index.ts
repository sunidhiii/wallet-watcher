import { JsonRpcProvider } from "ethers";
import { loadConfig } from "./config";
import { generateWallets } from "./walletGenerator";
import { startBalanceTracker } from "./balanceTracker";
import { createServer } from "./server";

async function main(): Promise<void> {
  const config = loadConfig();

  const provider = new JsonRpcProvider(config.rpcUrl);
  const wallets = generateWallets(config.mnemonic, config.walletCount);

  console.log(`Generated ${wallets.length} wallet(s):`);
  for (const wallet of wallets) {
    console.log(`  [${wallet.index}] ${wallet.address}`);
  }

  startBalanceTracker(provider, wallets, config.pollIntervalMs);

  const app = createServer(provider, wallets);
  app.listen(config.port, () => {
    console.log(`Wallet Watcher listening on http://localhost:${config.port}`);
  });
}

main().catch((err) => {
  console.error("Fatal error starting service:", err);
  process.exit(1);
});
