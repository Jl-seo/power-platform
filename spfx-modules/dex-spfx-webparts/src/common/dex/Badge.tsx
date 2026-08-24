import * as React from 'react';

// Ported from DigitalExpertsConsulting/design-system components/badge/Badge.jsx

export type BadgeTone =
  | 'brand' | 'neutral' | 'success' | 'warning' | 'danger'
  | 'purple' | 'teal' | 'pink' | 'orange' | 'indigo' | 'sky' | 'lime' | 'gold';

const BADGE_TONES: { [tone: string]: [string, string] } = {
  brand: ['var(--brand-100)', 'var(--brand-700)'],
  neutral: ['var(--neutral-100)', 'var(--neutral-600)'],
  success: ['var(--success-100)', 'var(--success-700)'],
  warning: ['var(--warning-100)', 'var(--warning-700)'],
  danger: ['var(--danger-100)', 'var(--danger-700)'],
  purple: ['var(--purple-100)', 'var(--purple-700)'],
  teal: ['var(--teal-100)', 'var(--teal-700)'],
  pink: ['var(--pink-100)', 'var(--pink-700)'],
  orange: ['var(--orange-100)', 'var(--orange-700)'],
  indigo: ['var(--indigo-100)', 'var(--indigo-700)'],
  sky: ['var(--sky-100)', 'var(--sky-700)'],
  lime: ['var(--lime-100)', 'var(--lime-700)'],
  gold: ['var(--gold-100)', 'var(--gold-700)']
};

export interface IBadgeProps {
  tone?: BadgeTone;
  solid?: boolean;
  dot?: boolean;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

export const Badge: React.FC<IBadgeProps> = ({ tone = 'brand', solid, dot, children, style }) => {
  const [bg, fg] = BADGE_TONES[tone] || BADGE_TONES.brand;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: solid ? fg : bg, color: solid ? 'var(--color-fg-on-brand)' : fg,
      padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600,
      fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap', ...style
    }}>
      {dot ? <span style={{ width: 6, height: 6, borderRadius: 999, background: 'currentColor' }} /> : undefined}
      {children}
    </span>
  );
};
