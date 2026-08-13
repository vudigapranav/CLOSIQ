import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { ClosiqLogo } from './ClosiqLogo';

interface AppHeaderProps {
  isDarkMode: boolean;
  onToggleTheme: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({ isDarkMode, onToggleTheme }) => {
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
        backgroundColor: 'var(--color-bg)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--color-border)',
        padding: '10px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        transition: 'background-color 0.25s ease'
      }}
    >
      <ClosiqLogo width={92} style={{ padding: '6px 10px', boxShadow: 'none' }} />

      <button
        onClick={onToggleTheme}
        style={{
          background: 'var(--color-surface-subtle)',
          border: '1px solid var(--color-border)',
          borderRadius: '50%',
          width: 36,
          height: 36,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: 'var(--color-text-primary)',
          transition: 'all 0.2s ease'
        }}
        title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      >
        {isDarkMode ? <Sun size={18} color="#C5A880" /> : <Moon size={18} color="var(--color-primary)" />}
      </button>
    </header>
  );
};
