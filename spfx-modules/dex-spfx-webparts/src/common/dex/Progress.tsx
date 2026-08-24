import * as React from 'react';

// Ported from DigitalExpertsConsulting/design-system components/progress/Progress.jsx

export type ProgressTone = 'brand' | 'success' | 'warning' | 'danger' | 'purple' | 'teal';

const PROGRESS_TONES: { [tone: string]: string } = {
  brand: 'var(--brand-600)',
  success: 'var(--success-600)',
  warning: 'var(--warning-600)',
  danger: 'var(--danger-600)',
  purple: 'var(--purple-600)',
  teal: 'var(--teal-600)'
};

export interface IProgressProps {
  value?: number;
  tone?: ProgressTone;
  showLabel?: boolean;
  height?: number;
  style?: React.CSSProperties;
}

export const Progress: React.FC<IProgressProps> = ({ value = 0, tone = 'brand', showLabel, height = 8, style }) => {
  const pct: number = Math.max(0, Math.min(100, value));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'var(--font-sans)', ...style }}>
      <div style={{ flex: 1, height, borderRadius: 999, background: 'var(--neutral-100)', overflow: 'hidden' }}>
        <div style={{ width: pct + '%', height: '100%', borderRadius: 999, background: PROGRESS_TONES[tone] || PROGRESS_TONES.brand, transition: 'width 320ms var(--ease-standard)' }} />
      </div>
      {showLabel ? <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-fg-primary)', fontVariantNumeric: 'tabular-nums', width: 38, textAlign: 'right' }}>{pct}%</span> : undefined}
    </div>
  );
};
