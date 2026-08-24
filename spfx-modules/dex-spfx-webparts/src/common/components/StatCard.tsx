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
    gap: 12,
    flex: '1 1 0',
    minWidth: 140,
    padding: '12px 16px',
    border: '1px solid #edebe9',
    borderRadius: 4,
    background: 'var(--bodyBackground, #ffffff)'
  },
  iconWrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    borderRadius: 4,
    background: '#f0f4fa',
    color: '#1b3a6b',
    fontSize: 16
  },
  textWrap: {
    display: 'flex',
    flexDirection: 'column'
  },
  value: {
    fontSize: 18,
    fontWeight: 600,
    lineHeight: '24px',
    color: 'var(--bodyText, #323130)'
  },
  label: {
    fontSize: 12,
    color: '#605e5c'
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
