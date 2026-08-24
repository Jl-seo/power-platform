import * as React from 'react';

// Ported from DigitalExpertsConsulting/design-system components/barchart/BarChart.jsx

export type BarChartTone = 'brand' | 'purple' | 'teal' | 'orange';

const BAR_TONES: { [tone: string]: [string, string] } = {
  brand: ['var(--chart-1)', 'var(--brand-200)'],
  purple: ['var(--chart-2)', 'var(--purple-100)'],
  teal: ['var(--chart-3)', 'var(--teal-100)'],
  orange: ['var(--chart-4)', 'var(--orange-100)']
};

export interface IBarChartDatum {
  label: string;
  value: number;
}

export interface IBarChartProps {
  data?: IBarChartDatum[];
  height?: number;
  tone?: BarChartTone;
  highlightLast?: boolean;
  showValues?: boolean;
  target?: number;
  style?: React.CSSProperties;
}

export const BarChart: React.FC<IBarChartProps> = ({
  data = [], height = 140, tone = 'brand', highlightLast = true, showValues, target, style
}) => {
  const max: number = Math.max(...data.map((d: IBarChartDatum) => d.value), target || 0, 1);
  const [main, dim] = BAR_TONES[tone] || BAR_TONES.brand;
  return (
    <div style={{ fontFamily: 'var(--font-sans)', position: 'relative', ...style }}>
      {target !== undefined ? (
        <div style={{ position: 'absolute', left: 0, right: 0, top: (1 - target / max) * height, borderTop: '1px dashed var(--warning-600)', zIndex: 1 }}>
          <span style={{ position: 'absolute', right: 0, top: -9, fontSize: 11, fontWeight: 600, color: 'var(--warning-600)', background: 'var(--color-bg-elevated)', padding: '0 4px' }}>목표 {target}</span>
        </div>
      ) : undefined}
      <div style={{ display: 'flex', gap: 8, height, alignItems: 'flex-end' }}>
        {data.map((d: IBarChartDatum, i: number) => (
          <div key={i} style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
            {showValues ? <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-fg-secondary)', fontVariantNumeric: 'tabular-nums' }}>{d.value}</span> : undefined}
            <div
              title={d.label + ': ' + d.value}
              style={{ width: '100%', height: (d.value / max) * 100 + '%', minHeight: 2, borderRadius: '5px 5px 0 0', background: highlightLast && i !== data.length - 1 ? dim : main }}
            />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
        {data.map((d: IBarChartDatum, i: number) => (
          <span key={i} style={{ flex: 1, textAlign: 'center', fontSize: 10, color: 'var(--color-fg-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.label}</span>
        ))}
      </div>
    </div>
  );
};
