import * as React from 'react';
import { mergeStyleSets } from '@fluentui/react';
import {
  IChartDatum,
  CHART_ACCENT,
  CHART_TEXT_MUTED
} from './ChartTypes';

export interface IHBarChartProps {
  data: IChartDatum[];
  ariaLabel: string;
}

const classNames = mergeStyleSets({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '84px 1fr 36px',
    alignItems: 'center',
    gap: 8
  },
  label: {
    fontSize: 11,
    color: CHART_TEXT_MUTED,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    textAlign: 'right'
  },
  track: {
    height: 12,
    borderRadius: 6,
    background: '#f1f3f7',
    overflow: 'hidden'
  },
  bar: {
    height: '100%',
    borderRadius: 6,
    background: `linear-gradient(90deg, #4a90e2 0%, ${CHART_ACCENT} 100%)`,
    minWidth: 2,
    transition: 'filter 0.1s',
    selectors: {
      ':hover': { filter: 'brightness(0.9)' }
    }
  },
  value: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--bodyText, #323130)'
  }
});

/**
 * Single-hue horizontal bar list with a per-row value label — doubles as the
 * table view of the data, so identity is never carried by color alone.
 */
export const HBarChart: React.FC<IHBarChartProps> = (props: IHBarChartProps) => {
  const maxValue: number = props.data.reduce(
    (m: number, d: IChartDatum) => Math.max(m, d.value),
    0
  );

  return (
    <div className={classNames.root} role='img' aria-label={props.ariaLabel}>
      {props.data.map((d: IChartDatum) => (
        <div key={d.label} className={classNames.row} title={`${d.label}: ${d.value}`}>
          <span className={classNames.label}>{d.label}</span>
          <div className={classNames.track}>
            <div
              className={classNames.bar}
              style={{ width: maxValue > 0 ? `${Math.max(2, (d.value / maxValue) * 100)}%` : '2%' }}
            />
          </div>
          <span className={classNames.value}>{d.value}</span>
        </div>
      ))}
    </div>
  );
};
