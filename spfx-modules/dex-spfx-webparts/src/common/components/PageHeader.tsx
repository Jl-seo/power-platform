import * as React from 'react';
import { mergeStyleSets } from '@fluentui/react';
import { DEX } from '../dexTokens';

export interface IPageHeaderProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}

// DEX design-system PageHeader: bold title, tertiary subtitle, bottom hairline.
const classNames = mergeStyleSets({
  root: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    paddingBottom: 16,
    marginBottom: 16,
    borderBottom: `1px solid ${DEX.borderDefault}`
  },
  titleArea: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    flex: 1,
    minWidth: 0
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    lineHeight: '28px',
    letterSpacing: '-0.01em',
    color: `var(--bodyText, ${DEX.fgPrimary})`,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  subtitle: {
    fontSize: 13,
    color: DEX.fgTertiary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0
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
