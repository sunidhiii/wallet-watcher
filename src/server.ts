import express, { Request, Response } from "express";
import { JsonRpcProvider } from "ethers";
import { WatchedWallet } from "./walletGenerator";
import { getAllBalances } from "./db";
import { createWithdrawal } from "./withdrawalBuilder";

export function createServer(provider: JsonRpcProvider, wallets: WatchedWallet[]) {
  const app = express();
  app.use(express.json());

  // (a) All wallet addresses and their current tracked balance.
  app.get("/wallets", (_req: Request, res: Response) => {
    const balances = getAllBalances();
    const result = wallets.map((wallet) => ({
      index: wallet.index,
      address: wallet.address,
      balanceWei: balances[wallet.address.toLowerCase()] ?? "0",
    }));
    res.json(result);
  });

  // (b) Create, and optionally broadcast, a withdrawal.
  // Body: { walletIndex: number, to: string, amountEth: string, broadcast?: boolean }
  app.post("/withdraw", async (req: Request, res: Response) => {
    const { walletIndex, to, amountEth, broadcast } = req.body ?? {};

    if (typeof walletIndex !== "number" || !Number.isInteger(walletIndex) || walletIndex < 0 || walletIndex >= wallets.length) {
      res.status(400).json({ error: `walletIndex must be an integer between 0 and ${wallets.length - 1}` });
      return;
    }
    if (typeof to !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(to)) {
      res.status(400).json({ error: "to must be a valid 0x-prefixed Ethereum address" });
      return;
    }
    if (typeof amountEth !== "string" || Number.isNaN(Number(amountEth)) || Number(amountEth) <= 0) {
      res.status(400).json({ error: "amountEth must be a positive numeric string, e.g. \"0.01\"" });
      return;
    }

    const wallet = wallets[walletIndex];

    try {
      const result = await createWithdrawal(provider, wallet.privateKey, to, amountEth, Boolean(broadcast));
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  return app;
}
