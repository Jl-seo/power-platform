import * as React from 'react';

// Ported from DigitalExpertsConsulting/design-system components/progressring/ProgressRing.jsx

export type ProgressRingTone = 'brand' | 'success' | 'warning' | 'danger' | 'purple' | 'teal';

const RING_TONES: { [tone: string]: string } = {
  brand: 'var(--brand-600)',
  success: 'var(--success-600)',
  warning: 'var(--warning-600)',
  danger: 'var(--danger-600)',
  purple: 'var(--purple-600)',
  teal: 'var(--teal-600)'
};

export interface IProgressRingProps {
  value?: number;
  size?: number;
  thickness?: number;
  tone?: ProgressRingTone;
  label?: string;
  showValue?: boolean;
  style?: React.CSSProperties;
}

export const ProgressRing: React.FC<IProgressRingProps> = ({
  value = 0, size = 64, thickness = 6, tone = 'brand', label, showValue = true, style
}) => {
  const pct: number = Math.max(0, Math.min(100, value));
  const r: number = (size - thickness) / 2;
  const circumference: number = 2 * Math.PI * r;
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, fontFamily: 'var(--font-sans)', ...style }}>
      <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }} role='img' aria-label={(label ? label + ' ' : '') + pct + '%'}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }} aria-hidden='true'>
          <circle cx={size / 2} cy={size / 2} r={r} fill='none' stroke='var(--neutral-100)' strokeWidth={thickness} />
          <circle
            cx={size / 2} cy={size / 2} r={r} fill='none'
            stroke={RING_TONES[tone] || RING_TONES.brand} strokeWidth={thickness} strokeLinecap='round'
            strokeDasharray={(pct / 100) * circumference + ' ' + circumference}
            style={{ transition: 'stroke-dasharray 320ms var(--ease-standard)' }}
          />
        </svg>
        {showValue ? (
          <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.round(size * 0.24), fontWeight: 700, color: 'var(--color-fg-primary)', fontVariantNumeric: 'tabular-nums' }}>
            {pct}<span style={{ fontSize: Math.round(size * 0.14), fontWeight: 500, color: 'var(--color-fg-tertiary)' }}>%</span>
          </span>
        ) : undefined}
      </div>
      {label ? <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-fg-secondary)' }}>{label}</span> : undefined}
    </div>
  );
};
