import React from 'react';

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  active?: boolean;
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  active = false,
  style,
  ...props
}) => {
  return (
    <button
      {...props}
      style={{
        background: active ? 'var(--color-primary-alpha)' : 'var(--color-surface-subtle)',
        border: '1px solid var(--color-border)',
        borderRadius: '50%',
        width: 38,
        height: 38,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        color: active ? 'var(--color-primary)' : 'var(--color-text-secondary)',
        transition: 'all 0.2s ease',
        ...style
      }}
    >
      {icon}
    </button>
  );
};
