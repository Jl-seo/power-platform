import * as React from 'react';
import { Icon, mergeStyleSets } from '@fluentui/react';

export interface IEmptyStateProps {
  iconName?: string;
  title: string;
  description?: string;
}

const classNames = mergeStyleSets({
  root: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 16px',
    textAlign: 'center'
  },
  icon: {
    fontSize: 32,
    color: '#a19f9d',
    marginBottom: 12
  },
  title: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--bodyText, #323130)'
  },
  description: {
    fontSize: 12,
    color: '#605e5c',
    marginTop: 4
  }
});

export const EmptyState: React.FC<IEmptyStateProps> = (props: IEmptyStateProps) => (
  <div className={classNames.root}>
    <Icon iconName={props.iconName || 'SearchIssue'} className={classNames.icon} />
    <span className={classNames.title}>{props.title}</span>
    {props.description ? <span className={classNames.description}>{props.description}</span> : undefined}
  </div>
);
