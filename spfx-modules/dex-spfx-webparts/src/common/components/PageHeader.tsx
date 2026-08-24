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
    gap: 12,
    marginBottom: 18
  },
  accentBar: {
    alignSelf: 'stretch',
    width: 4,
    borderRadius: 2,
    background: 'linear-gradient(180deg, #2a78d6 0%, #1b3a6b 100%)',
    marginRight: 12,
    flexShrink: 0
  },
  titleGroup: {
    display: 'flex',
    alignItems: 'center',
    flex: 1,
    minWidth: 0
  },
  titleArea: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    minWidth: 0
  },
  title: {
    fontSize: 20,
    fontWeight: 700,
    lineHeight: '26px',
    letterSpacing: '-0.2px',
    color: 'var(--bodyText, #1f2430)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  subtitle: {
    fontSize: 12,
    color: '#7a8394',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0
  }
});

export const PageHeader: React.FC<IPageHeaderProps> = (props: IPageHeaderProps) => (
  <div className={classNames.root}>
    <div className={classNames.titleGroup}>
      <div className={classNames.accentBar} />
      <div className={classNames.titleArea}>
        <span className={classNames.title}>{props.title}</span>
        {props.subtitle ? <span className={classNames.subtitle}>{props.subtitle}</span> : undefined}
      </div>
    </div>
    {props.children ? <div className={classNames.actions}>{props.children}</div> : undefined}
  </div>
);
