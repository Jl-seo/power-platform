import * as React from 'react';

// Ported from DigitalExpertsConsulting/design-system components/timeline/Timeline.jsx

export type TimelineTone = 'brand' | 'success' | 'warning' | 'danger' | 'purple' | 'teal' | 'neutral';

const TL_TONES: { [tone: string]: string } = {
  brand: 'var(--brand-600)',
  success: 'var(--success-600)',
  warning: 'var(--warning-600)',
  danger: 'var(--danger-600)',
  purple: 'var(--purple-600)',
  teal: 'var(--teal-600)',
  neutral: 'var(--neutral-400)'
};

export interface ITimelineItem {
  title: string;
  time?: string;
  description?: string;
  tone?: TimelineTone;
}

export interface ITimelineProps {
  items?: ITimelineItem[];
  style?: React.CSSProperties;
}

export const Timeline: React.FC<ITimelineProps> = ({ items = [], style }) => (
  <div style={{ display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-sans)', ...style }}>
    {items.map((it: ITimelineItem, i: number) => (
      <div key={i} style={{ display: 'flex', gap: 14 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 12, flexShrink: 0 }}>
          <span style={{ width: 10, height: 10, borderRadius: 999, background: TL_TONES[it.tone || 'brand'] || TL_TONES.brand, marginTop: 5, flexShrink: 0, boxShadow: '0 0 0 3px ' + (it.tone === 'neutral' ? 'var(--neutral-100)' : 'var(--brand-50)') }} />
          {i < items.length - 1 ? <span style={{ width: 2, flex: 1, background: 'var(--neutral-200)', margin: '4px 0' }} /> : undefined}
        </div>
        <div style={{ paddingBottom: i < items.length - 1 ? 20 : 0, minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-fg-primary)' }}>{it.title}</span>
            {it.time ? <span style={{ fontSize: 12, color: 'var(--color-fg-tertiary)', fontVariantNumeric: 'tabular-nums' }}>{it.time}</span> : undefined}
          </div>
          {it.description ? <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--color-fg-secondary)', marginTop: 2, wordBreak: 'keep-all' }}>{it.description}</div> : undefined}
        </div>
      </div>
    ))}
  </div>
);
