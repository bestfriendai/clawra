import {
  Connection,
  PublicKey,
  LAMPORTS_PER_SOL,
  ParsedTransactionWithMeta,
} from "@solana/web3.js";
import { env } from "../../config/env.js";
import { convex } from "../convex.js";
import { getSolPrice, cryptoToCredits } from "./price.js";

let connection: Connection | null = null;

function getConnection(): Connection {
  if (!connection) {
    connection = new Connection(env.SOLANA_RPC_URL, "confirmed");
  }
  return connection;
}

export async function checkDeposits(): Promise<void> {
  const wallets = await convex.getAllWalletsByChain("solana");
  if (wallets.length === 0) return;

  const conn = getConnection();
  const solPrice = await getSolPrice();

  for (const wallet of wallets) {
    try {
      const pubkey = new PublicKey(wallet.address);
      const signatures = await conn.getSignaturesForAddress(pubkey, {
        limit: 5,
      });

      for (const sig of signatures) {
        // Check if already processed
        const existing = await convex.getProcessedTx(sig.signature);
        if (existing) continue;

        const tx = await conn.getParsedTransaction(sig.signature, {
          maxSupportedTransactionVersion: 0,
        });
        if (!tx) continue;

        const depositAmount = extractDepositAmount(tx, wallet.address);
        if (depositAmount <= 0) continue;

        const amountUsd = depositAmount * solPrice;
        const credits = cryptoToCredits(amountUsd);
        if (credits <= 0) continue;

        // Credit the user
        await convex.addCredits({
          telegramId: wallet.telegramId,
          amount: credits,
          paymentMethod: "solana",
          paymentRef: `sol_${sig.signature}`,
        });

        // Record processed tx
        await convex.createProcessedTx({
          txHash: sig.signature,
          chain: "solana",
          telegramId: wallet.telegramId,
          amountCrypto: depositAmount,
          amountUsd,
          creditsCredited: credits,
        });

        console.log(
          `Credited ${credits} credits to ${wallet.telegramId} for ${depositAmount} SOL ($${amountUsd.toFixed(2)})`
        );
      }
    } catch (err) {
      console.error(`Error checking wallet ${wallet.address}:`, err);
    }
  }
}

function extractDepositAmount(
  tx: ParsedTransactionWithMeta,
  walletAddress: string
): number {
  if (!tx.meta || tx.meta.err) return 0;

  const preBalances = tx.meta.preBalances;
  const postBalances = tx.meta.postBalances;
  const accounts = tx.transaction.message.accountKeys;

  for (let i = 0; i < accounts.length; i++) {
    if (accounts[i].pubkey.toBase58() === walletAddress) {
      const diff = (postBalances[i] - preBalances[i]) / LAMPORTS_PER_SOL;
      return diff > 0 ? diff : 0;
    }
  }
  return 0;
}

let watcherInterval: ReturnType<typeof setInterval> | null = null;

export function startSolWatcher(intervalMs: number = 10_000): void {
  if (!env.MASTER_MNEMONIC) {
    console.log("SOL watcher disabled: MASTER_MNEMONIC not set");
    return;
  }
  console.log(`Starting SOL deposit watcher (every ${intervalMs / 1000}s)`);
  watcherInterval = setInterval(() => {
    checkDeposits().catch((err) =>
      console.error("SOL watcher error:", err)
    );
  }, intervalMs);
}

export function stopSolWatcher(): void {
  if (watcherInterval) {
    clearInterval(watcherInterval);
    watcherInterval = null;
  }
}
