import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { env } from "../../config/env.js";
import { convex } from "../convex.js";
import { deriveWallet } from "./wallet-derivation.js";

const MIN_SWEEP_LAMPORTS = 10_000; // ~0.00001 SOL minimum to sweep
const RENT_EXEMPT_RESERVE = 890_880; // lamports for rent exemption

export async function sweepToMainWallet(): Promise<void> {
  if (!env.MAIN_SOL_WALLET || !env.MASTER_MNEMONIC) {
    console.log("Sweeper disabled: MAIN_SOL_WALLET or MASTER_MNEMONIC not set");
    return;
  }

  const conn = new Connection(env.SOLANA_RPC_URL, "confirmed");
  const mainWallet = new PublicKey(env.MAIN_SOL_WALLET);
  const wallets = await convex.getAllWalletsByChain("solana");

  for (const wallet of wallets) {
    try {
      const pubkey = new PublicKey(wallet.address);
      const balance = await conn.getBalance(pubkey);

      // Need enough for rent + fee + minimum amount
      const sweepable = balance - RENT_EXEMPT_RESERVE - 5000; // 5000 lamports fee
      if (sweepable < MIN_SWEEP_LAMPORTS) continue;

      const { keypair } = deriveWallet(wallet.derivationIndex);

      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: pubkey,
          toPubkey: mainWallet,
          lamports: sweepable,
        })
      );

      const sig = await sendAndConfirmTransaction(conn, tx, [keypair]);
      const solAmount = sweepable / LAMPORTS_PER_SOL;
      console.log(
        `Swept ${solAmount.toFixed(6)} SOL from ${wallet.address} → ${env.MAIN_SOL_WALLET} (tx: ${sig})`
      );
    } catch (err) {
      console.error(`Error sweeping wallet ${wallet.address}:`, err);
    }
  }
}

let sweeperInterval: ReturnType<typeof setInterval> | null = null;

export function startSweeper(intervalMs: number = 3600_000): void {
  if (!env.MAIN_SOL_WALLET || !env.MASTER_MNEMONIC) {
    console.log("Sweeper disabled: MAIN_SOL_WALLET or MASTER_MNEMONIC not set");
    return;
  }
  console.log(`Starting wallet sweeper (every ${intervalMs / 3600_000}h)`);
  sweeperInterval = setInterval(() => {
    sweepToMainWallet().catch((err) =>
      console.error("Sweeper error:", err)
    );
  }, intervalMs);
}

export function stopSweeper(): void {
  if (sweeperInterval) {
    clearInterval(sweeperInterval);
    sweeperInterval = null;
  }
}
