import * as React from 'react';
import { mergeStyleSets } from '@fluentui/react';

export interface IPageHeaderProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}

const classNames = mergeStyleSets({
  root: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderLeft: '4px solid #1b3a6b',
    padding: '2px 0 2px 12px',
    marginBottom: 16
  },
  titleArea: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2
  },
  title: {
    fontSize: 18,
    fontWeight: 600,
    lineHeight: '24px',
    color: 'var(--bodyText, #323130)'
  },
  subtitle: {
    fontSize: 12,
    color: '#605e5c'
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: 8
  }
});

export const PageHeader: React.FC<IPageHeaderProps> = (props: IPageHeaderProps) => (
  <div className={classNames.root}>
    <div className={classNames.titleArea}>
      <span className={classNames.title}>{props.title}</span>
      {props.subtitle ? <span className={classNames.subtitle}>{props.subtitle}</span> : undefined}
    </div>
    {props.children ? <div className={classNames.actions}>{props.children}</div> : undefined}
  </div>
);
