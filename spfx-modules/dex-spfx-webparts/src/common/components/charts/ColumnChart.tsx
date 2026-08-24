import * as React from 'react';
import {
  IChartDatum,
  CHART_ACCENT,
  CHART_ACCENT_HOVER,
  CHART_DIM,
  CHART_GRID,
  CHART_TEXT_MUTED
} from './ChartTypes';

export interface IColumnChartProps {
  data: IChartDatum[];
  height?: number;
  ariaLabel: string;
}

const PADDING_LEFT: number = 34;
const PADDING_RIGHT: number = 8;
const PADDING_TOP: number = 16;
const PADDING_BOTTOM: number = 22;
const CORNER_RADIUS: number = 5;
const GRID_STEPS: number = 3;

const niceMax = (value: number): number => {
  if (value <= 0) {
    return GRID_STEPS;
  }
  const rawStep: number = value / GRID_STEPS;
  const magnitude: number = Math.pow(10, Math.floor(Math.log(rawStep) / Math.LN10));
  const residual: number = rawStep / magnitude;
  let step: number;
  if (residual > 5) {
    step = 10 * magnitude;
  } else if (residual > 2) {
    step = 5 * magnitude;
  } else if (residual > 1) {
    step = 2 * magnitude;
  } else {
    step = magnitude;
  }
  return Math.max(GRID_STEPS, Math.ceil(value / step) * step);
};

/**
 * Single-series column chart (SVG). Rounded data-end at the top, square
 * baseline; only the max value is direct-labeled, others show on hover.
 */
export const ColumnChart: React.FC<IColumnChartProps> = (props: IColumnChartProps) => {
  const { data } = props;
  const height: number = props.height || 180;
  const [hovered, setHovered] = React.useState<number>(-1);

  const width: number = 320;
  const plotWidth: number = width - PADDING_LEFT - PADDING_RIGHT;
  const plotHeight: number = height - PADDING_TOP - PADDING_BOTTOM;

  const maxValue: number = niceMax(data.reduce((m: number, d: IChartDatum) => Math.max(m, d.value), 0));
  const maxIndex: number = data.reduce(
    (best: number, d: IChartDatum, i: number) => (d.value > data[best].value ? i : best),
    0
  );

  const slot: number = data.length > 0 ? plotWidth / data.length : plotWidth;
  const barWidth: number = Math.max(8, Math.min(28, slot - 12));

  const barPath = (x: number, y: number, w: number, h: number): string => {
    const r: number = Math.min(CORNER_RADIUS, w / 2, h);
    const bottom: number = y + h;
    return (
      `M ${x} ${bottom} L ${x} ${y + r} Q ${x} ${y} ${x + r} ${y} ` +
      `L ${x + w - r} ${y} Q ${x + w} ${y} ${x + w} ${y + r} L ${x + w} ${bottom} Z`
    );
  };

  const gridLines: React.ReactElement[] = [];
  for (let i: number = 0; i <= GRID_STEPS; i++) {
    const value: number = (maxValue / GRID_STEPS) * i;
    const y: number = PADDING_TOP + plotHeight - (plotHeight * i) / GRID_STEPS;
    gridLines.push(
      <g key={i}>
        <line
          x1={PADDING_LEFT}
          x2={width - PADDING_RIGHT}
          y1={y}
          y2={y}
          stroke={CHART_GRID}
          strokeWidth={1}
        />
        <text x={PADDING_LEFT - 6} y={y + 3} fontSize={10} fill={CHART_TEXT_MUTED} textAnchor='end'>
          {Math.round(value)}
        </text>
      </g>
    );
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width='100%'
      height={height}
      role='img'
      aria-label={props.ariaLabel}
      style={{ display: 'block' }}
    >
      {gridLines}
      {data.map((d: IChartDatum, i: number) => {
        const barHeight: number = maxValue > 0 ? (plotHeight * d.value) / maxValue : 0;
        const x: number = PADDING_LEFT + slot * i + (slot - barWidth) / 2;
        const y: number = PADDING_TOP + plotHeight - barHeight;
        const isLast: boolean = i === data.length - 1;
        const showLabel: boolean = i === maxIndex || isLast || hovered === i;
        // DEX BarChart highlight-last pattern: the current period carries the
        // brand color, earlier periods sit back in brand-200.
        const fill: string = hovered === i
          ? CHART_ACCENT_HOVER
          : isLast ? CHART_ACCENT : CHART_DIM;
        return (
          <g
            key={d.label}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(-1)}
          >
            <rect
              x={PADDING_LEFT + slot * i}
              y={PADDING_TOP}
              width={slot}
              height={plotHeight}
              fill='transparent'
            />
            {barHeight > 0 ? (
              <path d={barPath(x, y, barWidth, barHeight)} fill={fill}>
                <title>{`${d.label}: ${d.value}`}</title>
              </path>
            ) : undefined}
            {showLabel && d.value > 0 ? (
              <text
                x={x + barWidth / 2}
                y={y - 4}
                fontSize={10}
                fontWeight={600}
                fill={CHART_TEXT_MUTED}
                textAnchor='middle'
              >
                {d.value}
              </text>
            ) : undefined}
            <text
              x={PADDING_LEFT + slot * i + slot / 2}
              y={height - 6}
              fontSize={10}
              fill={CHART_TEXT_MUTED}
              textAnchor='middle'
            >
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
};
