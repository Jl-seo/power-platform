import * as React from 'react';

// Ported from DigitalExpertsConsulting/design-system components/tabs/Tabs.jsx

export interface ITabItem {
  id: string;
  label: string;
  count?: number;
}

export interface ITabsProps {
  items?: (string | ITabItem)[];
  active?: string;
  defaultActive?: string;
  onChange?: (id: string) => void;
  style?: React.CSSProperties;
}

export const Tabs: React.FC<ITabsProps> = ({ items = [], active, defaultActive, onChange, style }) => {
  const first: string | undefined = items.length ? (typeof items[0] === 'string' ? items[0] : items[0].id) : undefined;
  const [internal, setInternal] = React.useState<string | undefined>(defaultActive !== undefined ? defaultActive : first);
  const current: string | undefined = active !== undefined ? active : internal;
  return (
    <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--color-border-default)', fontFamily: 'var(--font-sans)', ...style }}>
      {items.map((it: string | ITabItem) => {
        const tab: ITabItem = typeof it === 'string' ? { id: it, label: it } : it;
        const isActive: boolean = tab.id === current;
        return (
          <button
            key={tab.id}
            onClick={() => {
              if (active === undefined) {
                setInternal(tab.id);
              }
              if (onChange) {
                onChange(tab.id);
              }
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px',
              background: 'transparent', border: 0, cursor: 'pointer', fontFamily: 'inherit',
              borderBottom: '2px solid ' + (isActive ? 'var(--brand-600)' : 'transparent'), marginBottom: -1,
              color: isActive ? 'var(--brand-700)' : 'var(--color-fg-secondary)',
              fontWeight: isActive ? 600 : 500, fontSize: 14
            }}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined ? (
              <span style={{
                fontSize: 12, fontWeight: 600, padding: '1px 7px', borderRadius: 999,
                background: isActive ? 'var(--brand-100)' : 'var(--neutral-100)',
                color: isActive ? 'var(--brand-700)' : 'var(--color-fg-tertiary)'
              }}>{tab.count}</span>
            ) : undefined}
          </button>
        );
      })}
    </div>
  );
};
