import React from 'react';
import { Calendar, Grid, Sparkles, User } from 'lucide-react';

export type NavTab = 'today' | 'collection' | 'stylist' | 'profile';

interface BottomNavigationProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  activeTab,
  onTabChange
}) => {
  const tabs: { key: NavTab; label: string; icon: React.ReactNode }[] = [
    { key: 'today', label: 'Today', icon: <Calendar size={19} /> },
    { key: 'collection', label: 'Collection', icon: <Grid size={19} /> },
    { key: 'stylist', label: 'Stylist', icon: <Sparkles size={19} /> },
    { key: 'profile', label: 'Profile', icon: <User size={19} /> }
  ];

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
        padding: '8px',
        zIndex: 50,
        transition: 'background-color 0.25s ease'
      }}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
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
              background: isActive ? 'var(--color-primary-alpha)' : 'transparent',
              border: 'none',
              color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
              cursor: 'pointer',
              padding: '9px 6px',
              borderRadius: 'var(--radius-lg)',
              transition: 'color 0.2s ease, background-color 0.2s ease'
            }}
          >
            {React.cloneElement(tab.icon as React.ReactElement, {
              strokeWidth: isActive ? 2.2 : 1.7
            })}
            <span
              style={{
                fontSize: '0.68rem',
                fontWeight: isActive ? 700 : 500,
                letterSpacing: '0.01em'
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
