import * as React from 'react';

// Ported from DigitalExpertsConsulting/design-system components/avatar/Avatar.jsx

const AVATAR_COLORS: [string, string][] = [
  ['var(--brand-100)', 'var(--brand-700)'],
  ['var(--purple-100)', 'var(--purple-700)'],
  ['var(--teal-100)', 'var(--teal-700)'],
  ['var(--pink-100)', 'var(--pink-700)'],
  ['var(--orange-100)', 'var(--orange-700)'],
  ['var(--success-100)', 'var(--success-700)']
];

export interface IAvatarProps {
  name?: string;
  src?: string;
  size?: number;
  colorIndex?: number;
  style?: React.CSSProperties;
}

export const Avatar: React.FC<IAvatarProps> = ({ name = '', src, size = 36, colorIndex, style }) => {
  const initials: string = name.trim().split(/\s+/).map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();
  let idx: number | undefined = colorIndex;
  if (idx === undefined) {
    idx = 0;
    for (const ch of name) {
      idx = (idx + ch.charCodeAt(0)) % AVATAR_COLORS.length;
    }
  }
  const [bg, fg] = AVATAR_COLORS[idx % AVATAR_COLORS.length];
  return (
    <span title={name} style={{
      width: size, height: size, borderRadius: 999, flexShrink: 0, overflow: 'hidden',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      background: bg, color: fg, fontWeight: 700, fontSize: Math.round(size * 0.38),
      fontFamily: 'var(--font-sans)', ...style
    }}>
      {src ? <img src={src} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
    </span>
  );
};
