import * as React from 'react';
import styles from './NoticeBoard.module.scss';
import type { INoticeBoardProps } from './INoticeBoardProps';
import { NoticeService, INotice } from '../services/NoticeService';
import { Alert, Avatar, Badge, EmptyState, PageHeader, Skeleton } from '../../../common/dex';
import { Pagination } from '../../../common/components/Pagination';
import { formatDate, formatDateTime, isWithinDays } from '../../../common/format';
import * as strings from 'NoticeBoardWebPartStrings';
import {
  SearchBox,
  Dropdown,
  IDropdownOption,
  IconButton,
  Icon,
  Panel,
  PanelType
} from '@fluentui/react';

const ALL_CATEGORIES: string = '__all__';

const NoticeBoard: React.FC<INoticeBoardProps> = (props: INoticeBoardProps) => {
  const { spHttpClient, webUrl, listTitle, pageSize } = props;

  const [notices, setNotices] = React.useState<INotice[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | undefined>(undefined);
  const [query, setQuery] = React.useState<string>('');
  const [category, setCategory] = React.useState<string>(ALL_CATEGORIES);
  const [page, setPage] = React.useState<number>(1);
  const [selected, setSelected] = React.useState<INotice | undefined>(undefined);

  const service: NoticeService = React.useMemo(
    () => new NoticeService(spHttpClient, webUrl),
    [spHttpClient, webUrl]
  );

  const load = React.useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(undefined);
    try {
      const items: INotice[] = await service.getNotices(listTitle);
      setNotices(items);
    } catch (e) {
      setNotices([]);
      setError(`${strings.LoadErrorPrefix} '${listTitle}' (${e instanceof Error ? e.message : e})`);
    } finally {
      setLoading(false);
      setPage(1);
    }
  }, [service, listTitle]);

  React.useEffect(() => {
    load().catch(() => { /* handled in load */ });
  }, [load]);

  const categories: IDropdownOption[] = React.useMemo(() => {
    const seen: { [key: string]: boolean } = {};
    const options: IDropdownOption[] = [{ key: ALL_CATEGORIES, text: strings.AllCategoriesLabel }];
    notices.forEach((n: INotice) => {
      if (n.category && !seen[n.category]) {
        seen[n.category] = true;
        options.push({ key: n.category, text: n.category });
      }
    });
    return options;
  }, [notices]);

  const filtered: INotice[] = React.useMemo(() => {
    const q: string = query.trim().toLowerCase();
    return notices.filter((n: INotice) => {
      if (category !== ALL_CATEGORIES && n.category !== category) {
        return false;
      }
      if (q && n.title.toLowerCase().indexOf(q) < 0 && n.author.toLowerCase().indexOf(q) < 0) {
        return false;
      }
      return true;
    });
  }, [notices, query, category]);

  const pinned: INotice[] = React.useMemo(
    () => filtered.filter((n: INotice) => n.isPinned).slice(0, 3),
    [filtered]
  );

  const regular: INotice[] = React.useMemo(
    () => filtered.filter((n: INotice) => !n.isPinned),
    [filtered]
  );

  const paged: INotice[] = React.useMemo(() => {
    const start: number = (page - 1) * pageSize;
    return regular.slice(start, start + pageSize);
  }, [regular, page, pageSize]);

  const renderRow = (notice: INotice): React.ReactElement => (
    <div
      key={notice.id}
      className={styles.noticeRow}
      role='button'
      tabIndex={0}
      onClick={() => setSelected(notice)}
      onKeyDown={(ev: React.KeyboardEvent<HTMLDivElement>) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          setSelected(notice);
        }
      }}
    >
      {notice.category ? <Badge tone='brand'>{notice.category}</Badge> : undefined}
      <span className={styles.noticeTitle}>{notice.title}</span>
      {isWithinDays(notice.created, 7) ? <Badge tone='danger' dot={true}>N</Badge> : undefined}
      {notice.author ? <span className={styles.metaText}>{notice.author}</span> : undefined}
      <span className={styles.metaText}>{formatDate(notice.created)}</span>
    </div>
  );

  return (
    <section className={styles.noticeBoard}>
      <PageHeader
        title={props.title || strings.DefaultTitle}
        subtitle={listTitle}
        actions={(
          <IconButton
            iconProps={{ iconName: 'Refresh' }}
            title={strings.RefreshLabel}
            ariaLabel={strings.RefreshLabel}
            onClick={() => { load().catch(() => { /* handled in load */ }); }}
          />
        )}
      />

      <div className={styles.toolbar}>
        <SearchBox
          className={styles.searchBox}
          placeholder={strings.SearchPlaceholder}
          value={query}
          onChange={(_ev?: React.ChangeEvent<HTMLInputElement>, value?: string) => {
            setQuery(value || '');
            setPage(1);
          }}
        />
        {categories.length > 1 ? (
          <Dropdown
            options={categories}
            selectedKey={category}
            styles={{ dropdown: { minWidth: 140 } }}
            onChange={(_ev: React.FormEvent<HTMLDivElement>, option?: IDropdownOption) => {
              if (option) {
                setCategory(option.key as string);
                setPage(1);
              }
            }}
          />
        ) : undefined}
      </div>

      {error ? (
        <Alert tone='danger' title={strings.LoadErrorTitle}>{error}</Alert>
      ) : undefined}

      {loading ? <Skeleton lines={4} /> : undefined}

      {!loading && !error && pinned.length > 0 ? (
        <div className={styles.pinnedSection}>
          {pinned.map((notice: INotice) => (
            <div
              key={notice.id}
              className={styles.pinnedCard}
              role='button'
              tabIndex={0}
              onClick={() => setSelected(notice)}
              onKeyDown={(ev: React.KeyboardEvent<HTMLDivElement>) => {
                if (ev.key === 'Enter' || ev.key === ' ') {
                  setSelected(notice);
                }
              }}
            >
              <Icon iconName='Pinned' className={styles.pinnedIcon} />
              <span className={styles.pinnedTitle}>{notice.title}</span>
              <span className={styles.metaText}>{formatDate(notice.created)}</span>
            </div>
          ))}
        </div>
      ) : undefined}

      {!loading && !error && filtered.length === 0 ? (
        <EmptyState title={strings.EmptyTitle} description={strings.EmptyDescription} />
      ) : undefined}

      {!loading && !error ? (
        <div>
          {paged.map(renderRow)}
          <Pagination
            currentPage={page}
            totalItems={regular.length}
            pageSize={pageSize}
            onPageChange={setPage}
          />
        </div>
      ) : undefined}

      <Panel
        isOpen={!!selected}
        type={PanelType.medium}
        headerText={selected ? selected.title : ''}
        onDismiss={() => setSelected(undefined)}
        closeButtonAriaLabel={strings.CloseLabel}
        isLightDismiss={true}
      >
        {selected ? (
          <div>
            <div className={styles.panelMeta}>
              <Avatar name={selected.author || '?'} size={32} />
              {selected.author ? <span className={styles.metaText}>{selected.author}</span> : undefined}
              <span className={styles.metaText}>{formatDateTime(selected.created)}</span>
              {selected.category ? <Badge tone='brand'>{selected.category}</Badge> : undefined}
            </div>
            {selected.body ? (
              <div
                className={styles.panelBody}
                dangerouslySetInnerHTML={{ __html: selected.body }}
              />
            ) : (
              <EmptyState title={strings.NoBodyLabel} />
            )}
          </div>
        ) : undefined}
      </Panel>
    </section>
  );
};

export default NoticeBoard;
