import * as React from 'react';
import { IconButton, mergeStyleSets } from '@fluentui/react';

export interface IPaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

const classNames = mergeStyleSets({
  root: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12
  },
  label: {
    fontSize: 12,
    color: '#605e5c',
    minWidth: 64,
    textAlign: 'center'
  }
});

export const Pagination: React.FC<IPaginationProps> = (props: IPaginationProps) => {
  const totalPages: number = Math.max(1, Math.ceil(props.totalItems / Math.max(1, props.pageSize)));
  const page: number = Math.min(Math.max(1, props.currentPage), totalPages);

  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className={classNames.root}>
      <IconButton
        iconProps={{ iconName: 'DoubleChevronLeft' }}
        ariaLabel='First page'
        disabled={page <= 1}
        onClick={() => props.onPageChange(1)}
      />
      <IconButton
        iconProps={{ iconName: 'ChevronLeft' }}
        ariaLabel='Previous page'
        disabled={page <= 1}
        onClick={() => props.onPageChange(page - 1)}
      />
      <span className={classNames.label}>{page} / {totalPages}</span>
      <IconButton
        iconProps={{ iconName: 'ChevronRight' }}
        ariaLabel='Next page'
        disabled={page >= totalPages}
        onClick={() => props.onPageChange(page + 1)}
      />
      <IconButton
        iconProps={{ iconName: 'DoubleChevronRight' }}
        ariaLabel='Last page'
        disabled={page >= totalPages}
        onClick={() => props.onPageChange(totalPages)}
      />
    </div>
  );
};
