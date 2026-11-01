import React from 'react';
import { Home, Shirt, CalendarDays, User, Camera } from 'lucide-react';

/**
 * 'stylist' is still a screen (opened from the AI Stylist card on Home) but
 * no longer a tab — the user moved it into Home on 2026-11-01.
 */
export type NavTab = 'today' | 'collection' | 'stylist' | 'planner' | 'profile';

interface BottomNavigationProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  /** The raised centre camera button — opens Shop Check. */
  onShopCheck: () => void;
}

const LEFT_TABS: { key: NavTab; label: string; icon: React.ReactNode }[] = [
  { key: 'today', label: 'Home', icon: <Home size={19} /> },
  { key: 'collection', label: 'Wardrobe', icon: <Shirt size={19} /> }
];

const RIGHT_TABS: { key: NavTab; label: string; icon: React.ReactNode }[] = [
  { key: 'planner', label: 'Planner', icon: <CalendarDays size={19} /> },
  { key: 'profile', label: 'Profile', icon: <User size={19} /> }
];

/**
 * Home · Wardrobe · (Shop Check camera) · Planner · Profile.
 * Floating taupe dock on phones and narrow windows, with the camera button
 * raised above it; a left sidebar rail on desktop (>= 1024px), where the
 * camera becomes a highlighted row. Layout lives in index.css (.app-nav).
 */
export const BottomNavigation: React.FC<BottomNavigationProps> = ({ activeTab, onTabChange, onShopCheck }) => {
  // The Stylist is reached from Home, so Home stays lit while it's open.
  const isActive = (key: NavTab) => activeTab === key || (key === 'today' && activeTab === 'stylist');
  const renderTab = (tab: { key: NavTab; label: string; icon: React.ReactNode }) => {
    const active = isActive(tab.key);
    return (
      <button
        key={tab.key}
        onClick={() => onTabChange(tab.key)}
        aria-label={tab.label}
        aria-current={active ? 'page' : undefined}
        className={`app-nav__tab${active ? ' is-active' : ''}`}
      >
        {React.cloneElement(tab.icon as React.ReactElement<{ strokeWidth?: number }>, {
          strokeWidth: active ? 2.2 : 1.7
        })}
        <span className="app-nav__label">{tab.label}</span>
      </button>
    );
  };

  return (
    <nav className="app-nav" aria-label="Main">
      {LEFT_TABS.map(renderTab)}
      <button
        onClick={onShopCheck}
        className="app-nav__camera"
        aria-label="Shop Check — scan a garment to see if it works with your wardrobe"
        title="Shop Check"
      >
        <span className="app-nav__camera-circle">
          <Camera size={24} strokeWidth={2.1} />
        </span>
        <span className="app-nav__label app-nav__camera-label">Shop Check</span>
      </button>
      {RIGHT_TABS.map(renderTab)}
    </nav>
  );
};
