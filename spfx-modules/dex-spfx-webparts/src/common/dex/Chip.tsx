import * as React from 'react';

// Ported from DigitalExpertsConsulting/design-system components/chip/Chip.jsx

export type ChipTone =
  | 'brand' | 'neutral' | 'purple' | 'teal' | 'pink' | 'orange'
  | 'success' | 'indigo' | 'sky' | 'lime' | 'gold';

const CHIP_TONES: { [tone: string]: [string, string] } = {
  brand: ['var(--brand-100)', 'var(--brand-700)'],
  neutral: ['var(--neutral-100)', 'var(--neutral-600)'],
  purple: ['var(--purple-100)', 'var(--purple-700)'],
  teal: ['var(--teal-100)', 'var(--teal-700)'],
  pink: ['var(--pink-100)', 'var(--pink-700)'],
  orange: ['var(--orange-100)', 'var(--orange-700)'],
  success: ['var(--success-100)', 'var(--success-700)'],
  indigo: ['var(--indigo-100)', 'var(--indigo-700)'],
  sky: ['var(--sky-100)', 'var(--sky-700)'],
  lime: ['var(--lime-100)', 'var(--lime-700)'],
  gold: ['var(--gold-100)', 'var(--gold-700)']
};

export interface IChipProps {
  tone?: ChipTone;
  onDelete?: () => void;
  disabled?: boolean;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

export const Chip: React.FC<IChipProps> = ({ tone = 'brand', onDelete, disabled, children, style }) => {
  const [bg, fg] = CHIP_TONES[tone] || CHIP_TONES.brand;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, background: bg, color: fg,
      padding: '5px 10px', borderRadius: 8, fontSize: 13, fontWeight: 600,
      fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap', opacity: disabled ? 0.5 : 1, ...style
    }}>
      {children}
      {onDelete ? (
        <button onClick={disabled ? undefined : onDelete} aria-label='삭제' style={{
          border: 0, background: 'transparent', color: 'inherit', cursor: disabled ? 'not-allowed' : 'pointer',
          padding: 0, fontSize: 11, lineHeight: 1, fontFamily: 'inherit', opacity: 0.7
        }}>✕</button>
      ) : undefined}
    </span>
  );
};
