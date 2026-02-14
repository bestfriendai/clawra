import { Keypair } from "@solana/web3.js";
import { derivePath } from "ed25519-hd-key";
import * as bip39 from "bip39";
import { env } from "../../config/env.js";

export function deriveWallet(index: number): { address: string; keypair: Keypair } {
  const mnemonic = env.MASTER_MNEMONIC;
  if (!mnemonic) throw new Error("MASTER_MNEMONIC not set");

  const seed = bip39.mnemonicToSeedSync(mnemonic);
  const path = `m/44'/501'/${index}'/0'`;
  const derived = derivePath(path, seed.toString("hex"));
  const keypair = Keypair.fromSeed(derived.key);

  return {
    address: keypair.publicKey.toBase58(),
    keypair,
  };
}
