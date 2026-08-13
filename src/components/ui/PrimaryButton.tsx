import React from 'react';

interface PrimaryButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

export const PrimaryButton: React.FC<PrimaryButtonProps> = ({
  children,
  icon,
  fullWidth = false,
  className = '',
  style,
  ...props
}) => {
  return (
    <button
      {...props}
      style={{
        backgroundColor: 'var(--color-primary)',
        color: 'var(--color-text-on-primary)',
        border: 'none',
        padding: '14px 24px',
        borderRadius: 'var(--radius-pill)',
        fontSize: '0.88rem',
        fontWeight: 600,
        letterSpacing: '0.02em',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        width: fullWidth ? '100%' : 'auto',
        boxShadow: 'var(--shadow-sm)',
        transition: 'all 0.2s ease',
        ...style
      }}
    >
      {icon}
      <span>{children}</span>
    </button>
  );
};
