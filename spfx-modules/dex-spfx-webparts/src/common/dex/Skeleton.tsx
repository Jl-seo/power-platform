import * as React from 'react';

// Ported from DigitalExpertsConsulting/design-system components/skeleton/Skeleton.jsx
// The ds-pulse keyframes are declared globally in styles/_dex.scss.

export type SkeletonVariant = 'text' | 'circle' | 'rect';

export interface ISkeletonProps {
  variant?: SkeletonVariant;
  width?: number | string;
  height?: number | string;
  size?: number;
  lines?: number;
  style?: React.CSSProperties;
}

export const Skeleton: React.FC<ISkeletonProps> = ({ variant = 'text', width, height, size = 36, lines = 1, style }) => {
  const base: React.CSSProperties = { background: 'var(--neutral-200)', animation: 'ds-pulse 1.4s ease-in-out infinite' };
  if (variant === 'circle') {
    return <span style={{ ...base, display: 'inline-block', width: size, height: size, borderRadius: 999, ...style }} />;
  }
  if (variant === 'rect') {
    return <span style={{ ...base, display: 'block', width: width || '100%', height: height || 80, borderRadius: 10, ...style }} />;
  }
  return (
    <span style={{ display: 'flex', flexDirection: 'column', gap: 8, width: width || '100%', ...style }}>
      {Array.apply(0, Array(lines)).map((_: unknown, i: number) => (
        <span key={i} style={{ ...base, display: 'block', height: height || 14, borderRadius: 6, width: i === lines - 1 && lines > 1 ? '62%' : '100%' }} />
      ))}
    </span>
  );
};
