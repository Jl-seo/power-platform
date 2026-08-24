import * as React from 'react';
import styles from './NoticeBoard.module.scss';
import type { INoticeBoardProps } from './INoticeBoardProps';
import { NoticeService, INotice } from '../services/NoticeService';
import { PageHeader } from '../../../common/components/PageHeader';
import { EmptyState } from '../../../common/components/EmptyState';
import { Pagination } from '../../../common/components/Pagination';
import { formatDate, formatDateTime, isWithinDays } from '../../../common/format';
import * as strings from 'NoticeBoardWebPartStrings';
import {
  SearchBox,
  Dropdown,
  IDropdownOption,
  IconButton,
  Icon,
  MessageBar,
  MessageBarType,
  Shimmer,
  Panel,
  PanelType,
  Persona,
  PersonaSize
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
      {notice.category ? <span className={styles.categoryChip}>{notice.category}</span> : undefined}
      <span className={styles.noticeTitle}>{notice.title}</span>
      {isWithinDays(notice.created, 7) ? <span className={styles.newBadge}>N</span> : undefined}
      {notice.author ? <span className={styles.metaText}>{notice.author}</span> : undefined}
      <span className={styles.metaText}>{formatDate(notice.created)}</span>
    </div>
  );

  return (
    <section className={styles.noticeBoard}>
      <PageHeader title={props.title || strings.DefaultTitle} subtitle={listTitle}>
        <IconButton
          iconProps={{ iconName: 'Refresh' }}
          title={strings.RefreshLabel}
          ariaLabel={strings.RefreshLabel}
          onClick={() => { load().catch(() => { /* handled in load */ }); }}
        />
      </PageHeader>

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
        <MessageBar messageBarType={MessageBarType.error}>{error}</MessageBar>
      ) : undefined}

      {loading ? (
        <div>
          <Shimmer style={{ marginBottom: 10 }} />
          <Shimmer style={{ marginBottom: 10 }} width='90%' />
          <Shimmer width='80%' />
        </div>
      ) : undefined}

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
        <EmptyState
          iconName='Megaphone'
          title={strings.EmptyTitle}
          description={strings.EmptyDescription}
        />
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
              <Persona text={selected.author || ' '} size={PersonaSize.size32} />
              <span className={styles.metaText}>{formatDateTime(selected.created)}</span>
              {selected.category ? (
                <span className={styles.categoryChip}>{selected.category}</span>
              ) : undefined}
            </div>
            {selected.body ? (
              <div
                className={styles.panelBody}
                dangerouslySetInnerHTML={{ __html: selected.body }}
              />
            ) : (
              <EmptyState iconName='TextDocument' title={strings.NoBodyLabel} />
            )}
          </div>
        ) : undefined}
      </Panel>
    </section>
  );
};

export default NoticeBoard;
