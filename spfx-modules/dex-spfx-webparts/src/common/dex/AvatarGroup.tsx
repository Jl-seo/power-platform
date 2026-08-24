import * as React from 'react';

// Ported from DigitalExpertsConsulting/design-system components/avatargroup/AvatarGroup.jsx

const AG_COLORS: [string, string][] = [
  ['var(--brand-100)', 'var(--brand-700)'],
  ['var(--purple-100)', 'var(--purple-700)'],
  ['var(--teal-100)', 'var(--teal-700)'],
  ['var(--pink-100)', 'var(--pink-700)'],
  ['var(--orange-100)', 'var(--orange-700)'],
  ['var(--success-100)', 'var(--success-700)']
];

export interface IAvatarGroupProps {
  names?: string[];
  max?: number;
  size?: number;
  style?: React.CSSProperties;
}

export const AvatarGroup: React.FC<IAvatarGroupProps> = ({ names = [], max = 4, size = 36, style }) => {
  const shown: string[] = names.slice(0, max);
  const rest: number = names.length - shown.length;
  const circle = (bg: string, fg: string, content: string, i: number, title: string): React.ReactElement => (
    <span key={i} title={title} style={{
      width: size, height: size, borderRadius: 999, flexShrink: 0, boxSizing: 'border-box',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      background: bg, color: fg, fontWeight: 700, fontSize: Math.round(size * 0.36),
      border: '2px solid var(--color-bg-elevated)', marginLeft: i === 0 ? 0 : -Math.round(size * 0.28)
    }}>{content}</span>
  );
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', fontFamily: 'var(--font-sans)', ...style }}>
      {shown.map((name: string, i: number) => {
        let idx: number = 0;
        for (const ch of name) {
          idx = (idx + ch.charCodeAt(0)) % AG_COLORS.length;
        }
        const [bg, fg] = AG_COLORS[idx];
        const initials: string = name.trim().split(/\s+/).map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();
        return circle(bg, fg, initials, i, name);
      })}
      {rest > 0 ? circle('var(--neutral-100)', 'var(--neutral-600)', '+' + rest, shown.length, rest + '명 더') : undefined}
    </span>
  );
};
