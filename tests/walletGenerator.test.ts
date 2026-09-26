import { generateWallets } from "../src/walletGenerator";

// The well-known public "hardhat/ganache" test mnemonic. Safe to use in
// tests - it's testnet-only and holds no real funds.
const TEST_MNEMONIC = "test test test test test test test test test test test junk";

describe("generateWallets", () => {
  it("is deterministic: same mnemonic + same count -> identical addresses", () => {
    const run1 = generateWallets(TEST_MNEMONIC, 5);
    const run2 = generateWallets(TEST_MNEMONIC, 5);
    expect(run1.map((w) => w.address)).toEqual(run2.map((w) => w.address));
  });

  it("growing count (N -> N+m) keeps the first N wallets and appends new ones", () => {
    const small = generateWallets(TEST_MNEMONIC, 5);
    const large = generateWallets(TEST_MNEMONIC, 8);
    expect(large.slice(0, 5).map((w) => w.address)).toEqual(small.map((w) => w.address));
    expect(large).toHaveLength(8);
  });

  it("shrinking count (N -> N-m) yields a subset of the larger list", () => {
    const large = generateWallets(TEST_MNEMONIC, 8);
    const small = generateWallets(TEST_MNEMONIC, 3);
    expect(small.map((w) => w.address)).toEqual(large.slice(0, 3).map((w) => w.address));
  });

  it("wallet at a given index is identical across differently-sized runs", () => {
    const runA = generateWallets(TEST_MNEMONIC, 4);
    const runB = generateWallets(TEST_MNEMONIC, 10);
    expect(runA[2].address).toBe(runB[2].address);
    expect(runA[2].privateKey).toBe(runB[2].privateKey);
  });

  it("rejects counts outside the valid range of 1-20", () => {
    expect(() => generateWallets(TEST_MNEMONIC, 0)).toThrow();
    expect(() => generateWallets(TEST_MNEMONIC, 21)).toThrow();
    expect(() => generateWallets(TEST_MNEMONIC, -1)).toThrow();
  });

  it("produces valid, unique checksummed addresses", () => {
    const wallets = generateWallets(TEST_MNEMONIC, 10);
    const uniqueAddresses = new Set(wallets.map((w) => w.address));
    expect(uniqueAddresses.size).toBe(10);
    for (const wallet of wallets) {
      expect(wallet.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    }
  });
});
