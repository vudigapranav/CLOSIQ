import React from 'react';
import { Home, Shirt, Sparkles, CalendarDays, User } from 'lucide-react';

export type NavTab = 'today' | 'collection' | 'stylist' | 'planner' | 'profile';

interface BottomNavigationProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
}

const TABS: { key: NavTab; label: string; icon: React.ReactNode }[] = [
  { key: 'today', label: 'Home', icon: <Home size={19} /> },
  { key: 'collection', label: 'Wardrobe', icon: <Shirt size={19} /> },
  { key: 'stylist', label: 'AI Stylist', icon: <Sparkles size={19} /> },
  { key: 'planner', label: 'Planner', icon: <CalendarDays size={19} /> },
  { key: 'profile', label: 'Profile', icon: <User size={19} /> }
];

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  activeTab,
  onTabChange
}) => {
  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'calc(100% - 24px)',
        maxWidth: 456,
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-lg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        padding: '7px 6px',
        zIndex: 50,
        transition: 'background-color 0.25s ease'
      }}
    >
      {TABS.map((tab) => {
        const isActive = activeTab === tab.key;
        // The AI Stylist tab carries a quiet, always-on accent so it reads as
        // the app's hero feature without breaking the otherwise minimal nav.
        const isStylist = tab.key === 'stylist';
        return (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            aria-label={tab.label}
            aria-current={isActive ? 'page' : undefined}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              flex: 1,
              background: isActive ? 'var(--color-primary)' : isStylist ? 'var(--color-primary-alpha)' : 'transparent',
              border: 'none',
              color: isActive ? 'var(--color-text-on-primary)' : isStylist ? 'var(--color-primary)' : 'var(--color-text-muted)',
              cursor: 'pointer',
              padding: '8px 4px',
              borderRadius: 'var(--radius-lg)',
              transition: 'color 0.2s ease, background-color 0.2s ease'
            }}
          >
            {React.cloneElement(tab.icon as React.ReactElement, {
              strokeWidth: isActive || isStylist ? 2.2 : 1.7
            })}
            <span
              style={{
                fontSize: '0.64rem',
                fontWeight: isActive ? 700 : 500,
                letterSpacing: '0.01em',
                whiteSpace: 'nowrap'
              }}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
