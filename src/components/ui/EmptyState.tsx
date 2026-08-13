import React from 'react';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action
}) => {
  return (
    <div
      style={{
        padding: '48px 24px',
        textAlign: 'center',
        backgroundColor: 'var(--color-surface)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: '50%',
          backgroundColor: 'var(--color-surface-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-text-muted)',
          marginBottom: 4
        }}
      >
        {icon}
      </div>

      <h3 className="text-section-heading">{title}</h3>
      <p className="text-body" style={{ maxWidth: 320, color: 'var(--color-text-secondary)' }}>
        {description}
      </p>

      {action && <div style={{ marginTop: 12 }}>{action}</div>}
    </div>
  );
};
