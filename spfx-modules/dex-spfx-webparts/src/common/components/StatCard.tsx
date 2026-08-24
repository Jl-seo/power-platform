import * as React from 'react';
import { Icon, mergeStyleSets } from '@fluentui/react';
import { DEX } from '../dexTokens';

export interface IStatCardProps {
  iconName: string;
  label: string;
  value: string;
}

// DEX design-system StatCard: uppercase micro label on top, large tabular value.
const classNames = mergeStyleSets({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    flex: '1 1 0',
    minWidth: 150,
    padding: 20,
    border: `1px solid ${DEX.borderDefault}`,
    borderRadius: DEX.radiusMd,
    background: 'var(--bodyBackground, #ffffff)',
    boxShadow: DEX.shadowSm,
    transition: 'box-shadow .15s ease, transform .15s ease, border-color .15s ease',
    selectors: {
      ':hover': {
        borderColor: DEX.brand200,
        boxShadow: DEX.shadowMd,
        transform: 'translateY(-1px)'
      }
    }
  },
  labelRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8
  },
  label: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: DEX.fgTertiary,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  icon: {
    fontSize: 14,
    color: DEX.brand600,
    flexShrink: 0
  },
  value: {
    fontSize: 28,
    fontWeight: 700,
    lineHeight: '32px',
    letterSpacing: '-0.02em',
    fontVariantNumeric: 'tabular-nums',
    color: `var(--bodyText, ${DEX.fgPrimary})`,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  }
});

export const StatCard: React.FC<IStatCardProps> = (props: IStatCardProps) => (
  <div className={classNames.root}>
    <div className={classNames.labelRow}>
      <span className={classNames.label}>{props.label}</span>
      <Icon iconName={props.iconName} className={classNames.icon} />
    </div>
    <span className={classNames.value}>{props.value}</span>
  </div>
);
