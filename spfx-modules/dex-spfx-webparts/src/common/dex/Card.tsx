import * as React from 'react';

// Ported from DigitalExpertsConsulting/design-system components/card/Card.jsx

export interface ICardProps {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  padding?: number | string;
  bodyStyle?: React.CSSProperties;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

export const Card: React.FC<ICardProps> = ({ title, subtitle, actions, footer, padding = 24, bodyStyle, children, style }) => (
  <div style={{
    background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border-default)', borderRadius: 14,
    boxShadow: 'var(--shadow-sm)', fontFamily: 'var(--font-sans)', overflow: 'hidden',
    display: 'flex', flexDirection: 'column', ...style
  }}>
    {(title || actions) ? (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: '1px solid var(--color-border-default)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
          {title ? <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-fg-primary)' }}>{title}</div> : undefined}
          {subtitle ? <div style={{ fontSize: 13, color: 'var(--color-fg-tertiary)' }}>{subtitle}</div> : undefined}
        </div>
        {actions ? <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>{actions}</div> : undefined}
      </div>
    ) : undefined}
    <div style={{ padding, flex: 1, minHeight: 0, ...bodyStyle }}>{children}</div>
    {footer ? <div style={{ padding: '14px 20px', borderTop: '1px solid var(--color-border-default)', background: 'var(--neutral-50)' }}>{footer}</div> : undefined}
  </div>
);
