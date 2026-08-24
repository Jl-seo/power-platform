import * as React from 'react';

// Ported from DigitalExpertsConsulting/design-system components/donut/Donut.jsx

const DONUT_SEQ: string[] = [
  'var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)',
  'var(--chart-4)', 'var(--chart-5)', 'var(--chart-6)'
];

export interface IDonutDatum {
  label: string;
  value: number;
  color?: string;
}

export interface IDonutProps {
  data?: IDonutDatum[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
  showLegend?: boolean;
  style?: React.CSSProperties;
}

export const Donut: React.FC<IDonutProps> = ({
  data = [], size = 160, thickness = 22, centerLabel, centerValue, showLegend = true, style
}) => {
  const total: number = data.reduce((s: number, d: IDonutDatum) => s + d.value, 0) || 1;
  const r: number = (size - thickness) / 2;
  const circumference: number = 2 * Math.PI * r;
  let acc: number = 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20, fontFamily: 'var(--font-sans)', ...style }}>
      <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }} aria-hidden='true'>
          <circle cx={size / 2} cy={size / 2} r={r} fill='none' stroke='var(--neutral-100)' strokeWidth={thickness} />
          {data.map((d: IDonutDatum, i: number) => {
            const frac: number = d.value / total;
            const el: React.ReactElement = (
              <circle
                key={i} cx={size / 2} cy={size / 2} r={r} fill='none'
                stroke={d.color || DONUT_SEQ[i % DONUT_SEQ.length]} strokeWidth={thickness}
                strokeDasharray={(frac * circumference - 2) + ' ' + (circumference - frac * circumference + 2)}
                strokeDashoffset={-acc * circumference}
              />
            );
            acc += frac;
            return el;
          })}
        </svg>
        {(centerLabel || centerValue) ? (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
            {centerValue ? <span style={{ fontSize: Math.round(size * 0.16), fontWeight: 700, color: 'var(--color-fg-primary)', fontVariantNumeric: 'tabular-nums' }}>{centerValue}</span> : undefined}
            {centerLabel ? <span style={{ fontSize: 12, color: 'var(--color-fg-tertiary)' }}>{centerLabel}</span> : undefined}
          </div>
        ) : undefined}
      </div>
      {showLegend ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0, flex: 1 }}>
          {data.map((d: IDonutDatum, i: number) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <span style={{ width: 8, height: 8, borderRadius: 3, background: d.color || DONUT_SEQ[i % DONUT_SEQ.length], flexShrink: 0 }} />
              <span style={{ fontWeight: 600, color: 'var(--color-fg-primary)', whiteSpace: 'nowrap' }}>{d.label}</span>
              <span style={{ color: 'var(--color-fg-tertiary)', fontVariantNumeric: 'tabular-nums', marginLeft: 'auto' }}>{Math.round((d.value / total) * 100)}%</span>
            </div>
          ))}
        </div>
      ) : undefined}
    </div>
  );
};
