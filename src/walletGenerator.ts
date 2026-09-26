import { HDNodeWallet, Mnemonic } from "ethers";

export interface WatchedWallet {
  index: number;
  address: string;
  privateKey: string;
}

/**
 * Generates `count` wallets deterministically from a mnemonic, using the
 * standard Ethereum derivation path m/44'/60'/0'/0/{index}.
 *
 * Determinism/index-ordering guarantee:
 * - Wallet at index i is derived only from (mnemonic, i), so it never
 *   depends on `count`. That gives us, for free, everything the assignment
 *   asks for:
 *     - same mnemonic + same count -> identical list every run
 *     - count N+m -> the original N wallets, plus m new ones appended
 *     - count N-m -> a subset (the first N-m wallets) of the count-N list
 */
export function generateWallets(mnemonicPhrase: string, count: number): WatchedWallet[] {
  if (!Number.isInteger(count) || count < 1 || count > 20) {
    throw new Error("count must be an integer between 1 and 20");
  }

  const mnemonic = Mnemonic.fromPhrase(mnemonicPhrase);
  const wallets: WatchedWallet[] = [];

  for (let index = 0; index < count; index++) {
    const derivationPath = `m/44'/60'/0'/0/${index}`;
    const node = HDNodeWallet.fromMnemonic(mnemonic, derivationPath);
    wallets.push({
      index,
      address: node.address,
      privateKey: node.privateKey,
    });
  }

  return wallets;
}
