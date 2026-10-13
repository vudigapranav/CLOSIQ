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

/**
 * Floating taupe dock on phones and narrow windows; a left sidebar rail on
 * desktop (>= 1024px). Layout lives in index.css (.app-nav) so the same
 * markup can switch with a media query.
 */
export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  activeTab,
  onTabChange
}) => {
  return (
    <nav className="app-nav" aria-label="Main">
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
            className={`app-nav__tab${isActive ? ' is-active' : ''}${isStylist ? ' is-stylist' : ''}`}
          >
            {React.cloneElement(tab.icon as React.ReactElement<{ strokeWidth?: number }>, {
              strokeWidth: isActive || isStylist ? 2.2 : 1.7
            })}
            <span className="app-nav__label">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
