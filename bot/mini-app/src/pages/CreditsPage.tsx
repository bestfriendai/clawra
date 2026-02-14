import { useEffect, useState } from 'react';
import { apiGet } from '../api';
import { useTelegram } from '../hooks/useTelegram';

const PACKAGES = [
  { credits: 100, price: '$2.99', emoji: '💎' },
  { credits: 500, price: '$9.99', emoji: '💰', popular: true },
  { credits: 1200, price: '$19.99', emoji: '👑' },
  { credits: 3000, price: '$39.99', emoji: '🔥' },
];

export function CreditsPage() {
  const { tg } = useTelegram();
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<{ balance: number }>('/api/miniapp/balance')
      .then((data) => setBalance(data.balance))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleBuy = (credits: number, _price: string) => {
    // For now, redirect to bot with /buy command
    // In production, this would use Telegram Stars or Stripe
    tg?.close();
    // The bot's /buy command handles payment
    console.log(`Buy ${credits} credits`);
  };

  if (loading) {
    return (
      <div className="page">
        <h1 className="page-title">💎 Credits</h1>
        <div className="loading"><div className="spinner" /></div>
      </div>
    );
  }

  return (
    <div className="page">
      <h1 className="page-title">💎 Credits</h1>

      <div className="balance-display">
        <div className="balance-amount">{balance ?? 0}</div>
        <div className="balance-label">credits remaining</div>
      </div>

      <h2 style={{ fontSize: 18, marginBottom: 12 }}>Buy Credits</h2>

      {PACKAGES.map((pkg) => (
        <div key={pkg.credits} className="package-card">
          <div className="package-info">
            <div className="package-credits">
              {pkg.emoji} {pkg.credits} credits
              {pkg.popular && (
                <span
                  style={{
                    background: '#e91e63',
                    color: 'white',
                    fontSize: 10,
                    padding: '2px 6px',
                    borderRadius: 8,
                    marginLeft: 8,
                    verticalAlign: 'middle',
                  }}
                >
                  POPULAR
                </span>
              )}
            </div>
            <div className="package-price">{pkg.price}</div>
          </div>
          <button
            className="package-buy"
            onClick={() => handleBuy(pkg.credits, pkg.price)}
          >
            Buy
          </button>
        </div>
      ))}

      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-label">How credits work</div>
        <div style={{ fontSize: 13, color: 'var(--tg-hint)', lineHeight: 1.6 }}>
          • 1 message = 1 credit<br />
          • 1 selfie = 5 credits<br />
          • 1 voice message = 3 credits<br />
          • 1 video = 10 credits
        </div>
      </div>
    </div>
  );
}
