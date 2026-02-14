import { useEffect, useState } from 'react';
import { useTelegram } from './hooks/useTelegram';
import { ProfilePage } from './pages/ProfilePage';
import { GalleryPage } from './pages/GalleryPage';
import { CreditsPage } from './pages/CreditsPage';
import { SettingsPage } from './pages/SettingsPage';

type Tab = 'profile' | 'gallery' | 'credits' | 'settings';

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'profile', icon: '💕', label: 'Profile' },
  { id: 'gallery', icon: '📸', label: 'Gallery' },
  { id: 'credits', icon: '💎', label: 'Credits' },
  { id: 'settings', icon: '⚙️', label: 'Settings' },
];

export default function App() {
  const { ready, expand } = useTelegram();
  const [activeTab, setActiveTab] = useState<Tab>('profile');

  useEffect(() => {
    ready();
    expand();
  }, [ready, expand]);

  return (
    <>
      <main>
        {activeTab === 'profile' && <ProfilePage />}
        {activeTab === 'gallery' && <GalleryPage />}
        {activeTab === 'credits' && <CreditsPage />}
        {activeTab === 'settings' && <SettingsPage />}
      </main>

      <nav className="tab-bar">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`tab-item ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>
    </>
  );
}
