import { useState } from 'react';
import { useTelegram } from '../hooks/useTelegram';

export function SettingsPage() {
  const { user } = useTelegram();
  const [missYou, setMissYou] = useState(true);
  const [voiceMessages, setVoiceMessages] = useState(true);
  const [notifications, setNotifications] = useState(true);

  return (
    <div className="page">
      <h1 className="page-title">⚙️ Settings</h1>

      <div className="card">
        <div className="card-label">Account</div>
        <div className="card-value">{user?.first_name ?? 'User'}</div>
        {user?.username && (
          <div style={{ color: 'var(--tg-hint)', fontSize: 14 }}>
            @{user.username}
          </div>
        )}
      </div>

      <div className="card">
        <div className="setting-row">
          <div>
            <div className="setting-label">Miss You Messages</div>
            <div className="setting-hint">She'll text you when you're away</div>
          </div>
          <button
            className={`toggle ${missYou ? 'on' : ''}`}
            onClick={() => setMissYou(!missYou)}
          />
        </div>

        <div className="setting-row">
          <div>
            <div className="setting-label">Voice Messages</div>
            <div className="setting-hint">Allow voice replies</div>
          </div>
          <button
            className={`toggle ${voiceMessages ? 'on' : ''}`}
            onClick={() => setVoiceMessages(!voiceMessages)}
          />
        </div>

        <div className="setting-row" style={{ borderBottom: 'none' }}>
          <div>
            <div className="setting-label">Notifications</div>
            <div className="setting-hint">Get push notifications</div>
          </div>
          <button
            className={`toggle ${notifications ? 'on' : ''}`}
            onClick={() => setNotifications(!notifications)}
          />
        </div>
      </div>

      <div className="card">
        <div className="card-label">Voice Style</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          {['Soft', 'Playful', 'Sultry', 'Sweet'].map((voice) => (
            <button
              key={voice}
              className="btn btn-secondary"
              style={{
                padding: '8px 14px',
                fontSize: 13,
                width: 'auto',
                borderRadius: 20,
              }}
            >
              {voice}
            </button>
          ))}
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: 24, color: 'var(--tg-hint)', fontSize: 12 }}>
        Clawra v0.0.1
      </div>
    </div>
  );
}
