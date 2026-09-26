import { JsonRpcProvider } from "ethers";
import { WatchedWallet } from "./walletGenerator";
import { getBalance, setBalance, appendLog } from "./db";

/**
 * Polls the current on-chain balance of every watched wallet once, and:
 *  - if a wallet's balance went UP since the last poll, records an "inflow"
 *    log entry for the difference (deposits are only ever detected this way).
 *  - always updates the persisted balance to the latest observed value.
 *
 * Outflows are intentionally NOT recorded here, even if a balance goes down.
 * Per the assignment, an outflow is only recorded when this service itself
 * broadcasts a withdrawal (see withdrawalBuilder.ts) - that keeps "why did
 * the balance change" unambiguous instead of guessing at outside activity.
 */
export async function pollBalancesOnce(provider: JsonRpcProvider, wallets: WatchedWallet[]): Promise<void> {
  for (const wallet of wallets) {
    const currentBalance = await provider.getBalance(wallet.address);
    const previousBalance = BigInt(getBalance(wallet.address));

    if (currentBalance > previousBalance) {
      appendLog({
        address: wallet.address,
        type: "inflow",
        amountWei: (currentBalance - previousBalance).toString(),
        timestamp: new Date().toISOString(),
      });
    }

    setBalance(wallet.address, currentBalance.toString());
  }
}

/**
 * Starts polling on a fixed interval (must be <= 10 minutes per the
 * assignment). Runs an immediate poll first so balances are fresh as soon as
 * the service starts, rather than waiting a full interval.
 */
export function startBalanceTracker(
  provider: JsonRpcProvider,
  wallets: WatchedWallet[],
  intervalMs: number
): NodeJS.Timeout {
  pollBalancesOnce(provider, wallets).catch((err) => console.error("Initial balance poll failed:", err));

  return setInterval(() => {
    pollBalancesOnce(provider, wallets).catch((err) => console.error("Balance poll failed:", err));
  }, intervalMs);
}
