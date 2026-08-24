import * as React from 'react';

// Ported from DigitalExpertsConsulting/design-system components/emptystate/EmptyState.jsx

export interface IEmptyStateProps {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  visual?: React.ReactNode | null;
  style?: React.CSSProperties;
}

export const EmptyState: React.FC<IEmptyStateProps> = ({ title = '아직 항목이 없습니다', description, action, visual, style }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '48px 24px', textAlign: 'center', fontFamily: 'var(--font-sans)', ...style }}>
    {visual !== null ? (visual || (
      <div aria-hidden='true' style={{ width: 64, height: 64, borderRadius: 999, background: 'var(--brand-50)', border: '1px solid var(--brand-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
        <div style={{ width: 24, height: 24, borderRadius: 8, background: 'var(--brand-200)' }} />
      </div>
    )) : undefined}
    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-fg-primary)' }}>{title}</div>
    {description ? <div style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--color-fg-tertiary)', maxWidth: 360, wordBreak: 'keep-all' }}>{description}</div> : undefined}
    {action ? <div style={{ marginTop: 10 }}>{action}</div> : undefined}
  </div>
);
