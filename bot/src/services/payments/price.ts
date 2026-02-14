let cachedPrice: { sol: number; timestamp: number } | null = null;
const CACHE_TTL = 60_000; // 60 seconds

export async function getSolPrice(): Promise<number> {
  if (cachedPrice && Date.now() - cachedPrice.timestamp < CACHE_TTL) {
    return cachedPrice.sol;
  }

  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd"
    );
    const data = (await res.json()) as { solana: { usd: number } };
    const price = data.solana.usd;

    cachedPrice = { sol: price, timestamp: Date.now() };
    return price;
  } catch (err) {
    console.error("Failed to fetch SOL price:", err);
    if (cachedPrice) return cachedPrice.sol;
    throw new Error("Cannot fetch SOL price");
  }
}

export function cryptoToCredits(amountUsd: number): number {
  // 1 credit = $0.01
  return Math.floor(amountUsd / 0.01);
}
