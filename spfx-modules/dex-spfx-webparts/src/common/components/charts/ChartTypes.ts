import { DEX } from '../../dexTokens';

export interface IChartDatum {
  label: string;
  value: number;
}

// DEX chart tokens: --chart-1 is brand-600; dim bars use brand-200 (BarChart
// highlightLast pattern), tracks use neutral-100.
export const CHART_ACCENT: string = DEX.brand600;
export const CHART_ACCENT_HOVER: string = DEX.brand700;
export const CHART_DIM: string = DEX.brand200;
export const CHART_TRACK: string = DEX.bgMuted;
export const CHART_GRID: string = DEX.borderDefault;
export const CHART_TEXT_MUTED: string = DEX.fgTertiary;
