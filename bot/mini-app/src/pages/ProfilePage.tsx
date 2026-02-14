import { useEffect, useState } from 'react';
import { apiGet } from '../api';

interface GirlfriendProfile {
  name: string;
  age: number;
  race: string;
  bodyType: string;
  hairColor: string;
  hairStyle: string;
  personality: string;
  backstory?: string;
  referenceImageUrl?: string;
  isConfirmed: boolean;
}

export function ProfilePage() {
  const [profile, setProfile] = useState<GirlfriendProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<{ profile: GirlfriendProfile }>('/api/miniapp/profile')
      .then((data) => setProfile(data.profile))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="page">
        <div className="loading"><div className="spinner" /></div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="page">
        <div className="empty-state">
          <div className="empty-icon">💕</div>
          <p>No girlfriend created yet!</p>
          <p style={{ marginTop: 8, fontSize: 14 }}>
            Use /start in the bot to create her.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="profile-header">
        {profile.referenceImageUrl ? (
          <img
            className="profile-avatar"
            src={profile.referenceImageUrl}
            alt={profile.name}
          />
        ) : (
          <div
            className="profile-avatar"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(233, 30, 99, 0.2)',
              fontSize: 48,
            }}
          >
            💕
          </div>
        )}
        <div className="profile-name">{profile.name}</div>
        <div className="profile-age">{profile.age} years old</div>
        <div className="profile-traits">
          <span className="trait-tag">{profile.personality}</span>
          <span className="trait-tag">{profile.race}</span>
          <span className="trait-tag">{profile.bodyType}</span>
        </div>
      </div>

      <div className="card">
        <div className="card-label">Appearance</div>
        <div className="card-value">
          {profile.hairColor} {profile.hairStyle} hair
        </div>
      </div>

      {profile.backstory && (
        <div className="card">
          <div className="card-label">Backstory</div>
          <div style={{ fontSize: 14, lineHeight: 1.5 }}>{profile.backstory}</div>
        </div>
      )}

      <button className="btn btn-secondary" style={{ marginTop: 8 }}>
        ✨ Edit Appearance
      </button>
    </div>
  );
}
