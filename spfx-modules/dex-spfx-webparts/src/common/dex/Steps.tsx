import * as React from 'react';

// Ported from DigitalExpertsConsulting/design-system components/steps/Steps.jsx

export interface IStepItem {
  label: string;
  description?: string;
}

export interface IStepsProps {
  items?: (string | IStepItem)[];
  current?: number;
  style?: React.CSSProperties;
}

export const Steps: React.FC<IStepsProps> = ({ items = [], current = 0, style }) => (
  <div style={{ display: 'flex', alignItems: 'flex-start', fontFamily: 'var(--font-sans)', ...style }}>
    {items.map((it: string | IStepItem, i: number) => {
      const item: IStepItem = typeof it === 'string' ? { label: it } : it;
      const done: boolean = i < current;
      const active: boolean = i === current;
      return (
        <React.Fragment key={i}>
          {i > 0 ? <div style={{ flex: 1, height: 2, borderRadius: 2, background: i <= current ? 'var(--brand-600)' : 'var(--neutral-200)', marginTop: 15, minWidth: 24 }} /> : undefined}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '0 12px' }}>
            <div aria-current={active ? 'step' : undefined} style={{
              width: 32, height: 32, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700, boxSizing: 'border-box',
              background: done || active ? 'var(--brand-600)' : 'var(--color-bg-elevated)',
              color: done || active ? 'var(--color-fg-on-brand)' : 'var(--color-fg-tertiary)',
              border: done || active ? '2px solid var(--brand-600)' : '2px solid var(--neutral-300)'
            }}>
              {done ? (
                <svg width='14' height='14' viewBox='0 0 12 12'>
                  <path d='M2 6.5L4.8 9.2 10 3.5' fill='none' stroke='var(--color-fg-on-brand)' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' />
                </svg>
              ) : i + 1}
            </div>
            <div style={{ fontSize: 13, fontWeight: active ? 700 : 500, color: active ? 'var(--color-fg-primary)' : 'var(--color-fg-tertiary)', whiteSpace: 'nowrap' }}>{item.label}</div>
            {item.description ? <div style={{ fontSize: 11, color: 'var(--color-fg-tertiary)', marginTop: -4 }}>{item.description}</div> : undefined}
          </div>
        </React.Fragment>
      );
    })}
  </div>
);
