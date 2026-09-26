import { Wallet, Transaction, Network } from "ethers";
import { buildWithdrawal } from "../src/withdrawalBuilder";
import { generateWallets } from "../src/walletGenerator";

const TEST_MNEMONIC = "test test test test test test test test test test test junk";
const DESTINATION = "0x000000000000000000000000000000000000dEaD";

/**
 * A minimal stand-in for JsonRpcProvider that only implements the three
 * calls buildWithdrawal actually needs. This lets the test build and sign a
 * real transaction without any network access.
 */
function makeFakeProvider(nonce = 3) {
  return {
    getTransactionCount: async () => nonce,
    getFeeData: async () => ({
      maxFeePerGas: 100_000_000n,
      maxPriorityFeePerGas: 1_000_000n,
      gasPrice: 100_000_000n,
    }),
    getNetwork: async () => Network.from(11155111), // Sepolia's chain ID
  } as any;
}

describe("buildWithdrawal", () => {
  it("builds a transaction with the correct recipient, value, and nonce", async () => {
    const [wallet] = generateWallets(TEST_MNEMONIC, 1);
    const provider = makeFakeProvider(3);

    const { parsed, signedTx } = await buildWithdrawal(provider, wallet.privateKey, DESTINATION, "0.01");

    expect(parsed.to?.toLowerCase()).toBe(DESTINATION.toLowerCase());
    expect(parsed.value.toString()).toBe("10000000000000000"); // 0.01 ETH in wei
    expect(parsed.nonce).toBe(3);
    expect(parsed.gasLimit).toBe(21000n);
    expect(signedTx.startsWith("0x")).toBe(true);
  });

  it("produces a signature that recovers back to the sending wallet's address", async () => {
    const [wallet] = generateWallets(TEST_MNEMONIC, 1);
    const senderWallet = new Wallet(wallet.privateKey);
    const provider = makeFakeProvider();

    const { signedTx } = await buildWithdrawal(provider, wallet.privateKey, DESTINATION, "0.005");
    const parsed = Transaction.from(signedTx);

    expect(parsed.signature).not.toBeNull();
    expect(parsed.from?.toLowerCase()).toBe(senderWallet.address.toLowerCase());
  });

  it("handles small and precise decimal amounts without rounding errors", async () => {
    const [wallet] = generateWallets(TEST_MNEMONIC, 1);
    const provider = makeFakeProvider();

    const { parsed } = await buildWithdrawal(provider, wallet.privateKey, DESTINATION, "0.000000000000000001");

    expect(parsed.value.toString()).toBe("1"); // 1 wei, exactly
  });
});
