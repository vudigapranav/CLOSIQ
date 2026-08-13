import React from 'react';

interface SecondaryButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

export const SecondaryButton: React.FC<SecondaryButtonProps> = ({
  children,
  icon,
  fullWidth = false,
  style,
  ...props
}) => {
  return (
    <button
      {...props}
      style={{
        backgroundColor: 'var(--color-surface-subtle)',
        color: 'var(--color-text-primary)',
        border: '1px solid var(--color-border)',
        padding: '12px 20px',
        borderRadius: 'var(--radius-pill)',
        fontSize: '0.85rem',
        fontWeight: 500,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        width: fullWidth ? '100%' : 'auto',
        transition: 'all 0.2s ease',
        ...style
      }}
    >
      {icon}
      <span>{children}</span>
    </button>
  );
};
