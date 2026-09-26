import { JsonRpcProvider, Wallet, Transaction, TransactionResponse, parseEther } from "ethers";
import { appendLog, setBalance } from "./db";

export interface UnbroadcastWithdrawal {
  built: {
    from: string;
    to: string;
    value: string; // wei, as a decimal string
    nonce: number;
    gasLimit: string;
    maxFeePerGas: string;
    maxPriorityFeePerGas: string;
    chainId: string;
  };
  rawTransaction: string;
  signature: { r: string; s: string; v: number };
}

export interface BroadcastWithdrawal {
  txHash: string;
}

/**
 * Builds and signs a native-ETH transfer from `privateKey`'s wallet to
 * `toAddress`. Does not broadcast - that's a separate, explicit step so a
 * caller can inspect a transaction before it ever touches the network.
 */
export async function buildWithdrawal(
  provider: JsonRpcProvider,
  privateKey: string,
  toAddress: string,
  amountEth: string
): Promise<{ signer: Wallet; signedTx: string; parsed: Transaction }> {
  const signer = new Wallet(privateKey, provider);

  const [nonce, feeData, network] = await Promise.all([
    provider.getTransactionCount(signer.address, "pending"),
    provider.getFeeData(),
    provider.getNetwork(),
  ]);

  const txRequest = {
    type: 2, // EIP-1559
    to: toAddress,
    value: parseEther(amountEth),
    nonce,
    gasLimit: 21000n, // plain ETH transfer to an EOA needs exactly 21000 gas
    maxFeePerGas: feeData.maxFeePerGas ?? undefined,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ?? undefined,
    chainId: network.chainId,
  };

  const signedTx = await signer.signTransaction(txRequest);
  const parsed = Transaction.from(signedTx);

  return { signer, signedTx, parsed };
}

/**
 * Creates a withdrawal. If `broadcast` is false, returns the built
 * transaction (payload + signature) without sending it anywhere.
 * If `broadcast` is true, sends it and records the outflow immediately -
 * per the assignment, an outflow exists once the tx is broadcast, not once
 * it's confirmed.
 */
export async function createWithdrawal(
  provider: JsonRpcProvider,
  privateKey: string,
  toAddress: string,
  amountEth: string,
  broadcast: boolean
): Promise<UnbroadcastWithdrawal | BroadcastWithdrawal> {
  const { signer, signedTx, parsed } = await buildWithdrawal(provider, privateKey, toAddress, amountEth);

  if (!broadcast) {
    if (!parsed.signature) {
      throw new Error("Signed transaction is missing a signature - this should never happen");
    }
    return {
      built: {
        from: signer.address,
        to: parsed.to ?? toAddress,
        value: parsed.value.toString(),
        nonce: parsed.nonce,
        gasLimit: parsed.gasLimit.toString(),
        maxFeePerGas: (parsed.maxFeePerGas ?? 0n).toString(),
        maxPriorityFeePerGas: (parsed.maxPriorityFeePerGas ?? 0n).toString(),
        chainId: parsed.chainId.toString(),
      },
      rawTransaction: signedTx,
      signature: {
        r: parsed.signature.r,
        s: parsed.signature.s,
        v: parsed.signature.v,
      },
    };
  }

  const response: TransactionResponse = await provider.broadcastTransaction(signedTx);

  appendLog({
    address: signer.address,
    type: "outflow",
    amountWei: parsed.value.toString(),
    txHash: response.hash,
    timestamp: new Date().toISOString(),
  });

  // Reflect the debit locally right away so GET /wallets doesn't show stale
  // (pre-withdrawal) funds until the next poll tick catches up.
  const updatedBalance = await provider.getBalance(signer.address);
  setBalance(signer.address, updatedBalance.toString());

  return { txHash: response.hash };
}
