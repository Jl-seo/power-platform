import * as React from 'react';

// Ported from DigitalExpertsConsulting/design-system components/statcard/StatCard.jsx

export interface IStatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  delta?: string;
  deltaPositive?: boolean;
  sparkline?: number[];
  style?: React.CSSProperties;
}

export const StatCard: React.FC<IStatCardProps> = ({ label, value, unit, delta, deltaPositive = true, sparkline, style }) => (
  <div style={{
    background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border-default)', borderRadius: 14,
    padding: 20, display: 'flex', flexDirection: 'column', gap: 8, boxShadow: 'var(--shadow-sm)',
    fontFamily: 'var(--font-sans)', flex: '1 1 0', minWidth: 150, ...style
  }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-fg-tertiary)', whiteSpace: 'nowrap' }}>{label}</span>
      {delta ? (
        <span style={{
          fontSize: 12, fontWeight: 600, padding: '2px 7px', borderRadius: 6, whiteSpace: 'nowrap',
          background: deltaPositive ? 'var(--success-100)' : 'var(--danger-100)',
          color: deltaPositive ? 'var(--success-700)' : 'var(--danger-700)'
        }}>{deltaPositive ? '▲' : '▼'} {delta}</span>
      ) : undefined}
    </div>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
      <span style={{ fontSize: 30, fontWeight: 700, color: 'var(--color-fg-primary)', letterSpacing: '-0.02em', lineHeight: 1.05, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
      {unit ? <span style={{ fontSize: 16, fontWeight: 500, color: 'var(--color-fg-tertiary)' }}>{unit}</span> : undefined}
    </div>
    {sparkline && sparkline.length > 1 ? (() => {
      const mx: number = Math.max(...sparkline);
      const mn: number = Math.min(...sparkline);
      const pts: string = sparkline
        .map((v: number, i: number) => (i / (sparkline.length - 1)) * 200 + ',' + (30 - ((v - mn) / Math.max(mx - mn, 1)) * 26 + 1))
        .join(' ');
      return (
        <svg viewBox='0 0 200 32' style={{ width: '100%', height: 32, marginTop: 'auto' }} preserveAspectRatio='none' aria-hidden='true'>
          <polyline points={'0,32 ' + pts + ' 200,32'} fill='var(--brand-50)' stroke='none' />
          <polyline points={pts} fill='none' stroke='var(--chart-1)' strokeWidth='1.5' />
        </svg>
      );
    })() : undefined}
  </div>
);
