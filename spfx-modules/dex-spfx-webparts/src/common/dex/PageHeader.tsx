import * as React from 'react';

// Ported from DigitalExpertsConsulting/design-system components/pageheader/PageHeader.jsx

export interface IPageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumb?: React.ReactNode;
  actions?: React.ReactNode;
  tabs?: React.ReactNode;
  style?: React.CSSProperties;
}

export const PageHeader: React.FC<IPageHeaderProps> = ({ title, subtitle, breadcrumb, actions, tabs, style }) => (
  <div style={{
    display: 'flex', flexDirection: 'column', gap: 14, fontFamily: 'var(--font-sans)',
    borderBottom: tabs ? 'none' : '1px solid var(--color-border-default)',
    paddingBottom: tabs ? 0 : 16, marginBottom: 16, ...style
  }}>
    {breadcrumb}
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--color-fg-primary)', letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</h1>
        {subtitle ? <p style={{ margin: 0, fontSize: 13, color: 'var(--color-fg-tertiary)' }}>{subtitle}</p> : undefined}
      </div>
      {actions ? <div style={{ display: 'flex', gap: 10, flexShrink: 0, alignItems: 'center' }}>{actions}</div> : undefined}
    </div>
    {tabs}
  </div>
);
