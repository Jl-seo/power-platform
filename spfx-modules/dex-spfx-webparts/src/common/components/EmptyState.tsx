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
  iconCircle: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 56,
    height: 56,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #f2f6fc 0%, #e6eefa 100%)',
    marginBottom: 14
  },
  icon: {
    fontSize: 24,
    color: '#8ba4c9'
  },
  title: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--bodyText, #1f2430)'
  },
  description: {
    fontSize: 12,
    color: '#7a8394',
    marginTop: 4
  }
});

export const EmptyState: React.FC<IEmptyStateProps> = (props: IEmptyStateProps) => (
  <div className={classNames.root}>
    <div className={classNames.iconCircle}>
      <Icon iconName={props.iconName || 'SearchIssue'} className={classNames.icon} />
    </div>
    <span className={classNames.title}>{props.title}</span>
    {props.description ? <span className={classNames.description}>{props.description}</span> : undefined}
  </div>
);
