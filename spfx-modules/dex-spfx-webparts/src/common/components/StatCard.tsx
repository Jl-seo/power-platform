import * as React from 'react';
import { Icon, mergeStyleSets } from '@fluentui/react';

export interface IStatCardProps {
  iconName: string;
  label: string;
  value: string;
}

const classNames = mergeStyleSets({
  root: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    flex: '1 1 0',
    minWidth: 150,
    padding: '16px 18px',
    border: '1px solid #e6e9ef',
    borderRadius: 10,
    background: 'var(--bodyBackground, #ffffff)',
    boxShadow: '0 1px 2px rgba(16, 24, 40, 0.04)',
    transition: 'box-shadow .15s ease, transform .15s ease, border-color .15s ease',
    selectors: {
      ':hover': {
        borderColor: '#c9d7ec',
        boxShadow: '0 6px 16px rgba(27, 58, 107, 0.10)',
        transform: 'translateY(-1px)'
      }
    }
  },
  iconWrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 42,
    height: 42,
    borderRadius: 10,
    background: 'linear-gradient(135deg, #eef4fd 0%, #dcE9fb 100%)',
    color: '#1b3a6b',
    fontSize: 18,
    flexShrink: 0
  },
  textWrap: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0
  },
  value: {
    fontSize: 22,
    fontWeight: 700,
    lineHeight: '28px',
    letterSpacing: '-0.3px',
    color: 'var(--bodyText, #1f2430)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  label: {
    fontSize: 12,
    color: '#7a8394'
  }
});

export const StatCard: React.FC<IStatCardProps> = (props: IStatCardProps) => (
  <div className={classNames.root}>
    <div className={classNames.iconWrap}>
      <Icon iconName={props.iconName} />
    </div>
    <div className={classNames.textWrap}>
      <span className={classNames.value}>{props.value}</span>
      <span className={classNames.label}>{props.label}</span>
    </div>
  </div>
);
