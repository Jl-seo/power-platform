import * as React from 'react';
import styles from './DocumentHub.module.scss';
import type { IDocumentHubProps, DocumentHubView } from './IDocumentHubProps';
import { DocumentService, IDocumentItem } from '../services/DocumentService';
import { PageHeader } from '../../../common/components/PageHeader';
import { EmptyState } from '../../../common/components/EmptyState';
import { Pagination } from '../../../common/components/Pagination';
import { StatCard } from '../../../common/components/StatCard';
import { formatDate, formatFileSize, isWithinDays } from '../../../common/format';
import * as strings from 'DocumentHubWebPartStrings';
import {
  SearchBox,
  IconButton,
  Icon,
  MessageBar,
  MessageBarType,
  Shimmer,
  DetailsList,
  DetailsListLayoutMode,
  SelectionMode,
  IColumn,
  Link
} from '@fluentui/react';
import { getFileTypeIconProps } from '@fluentui/react-file-type-icons';

const DocumentHub: React.FC<IDocumentHubProps> = (props: IDocumentHubProps) => {
  const { spHttpClient, webUrl, libraryTitle, pageSize } = props;

  const [documents, setDocuments] = React.useState<IDocumentItem[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | undefined>(undefined);
  const [query, setQuery] = React.useState<string>('');
  const [view, setView] = React.useState<DocumentHubView>(props.defaultView);
  const [page, setPage] = React.useState<number>(1);

  const service: DocumentService = React.useMemo(
    () => new DocumentService(spHttpClient, webUrl),
    [spHttpClient, webUrl]
  );

  const load = React.useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(undefined);
    try {
      const items: IDocumentItem[] = await service.getDocuments(libraryTitle);
      setDocuments(items);
    } catch (e) {
      setDocuments([]);
      setError(`${strings.LoadErrorPrefix} '${libraryTitle}' (${e instanceof Error ? e.message : e})`);
    } finally {
      setLoading(false);
      setPage(1);
    }
  }, [service, libraryTitle]);

  React.useEffect(() => {
    load().catch(() => { /* handled in load */ });
  }, [load]);

  const filtered: IDocumentItem[] = React.useMemo(() => {
    const q: string = query.trim().toLowerCase();
    if (!q) {
      return documents;
    }
    return documents.filter(
      (d: IDocumentItem) =>
        d.name.toLowerCase().indexOf(q) >= 0 || d.editor.toLowerCase().indexOf(q) >= 0
    );
  }, [documents, query]);

  const paged: IDocumentItem[] = React.useMemo(() => {
    const start: number = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const totalSize: number = React.useMemo(
    () => documents.reduce((sum: number, d: IDocumentItem) => sum + d.size, 0),
    [documents]
  );

  const recentCount: number = React.useMemo(
    () => documents.filter((d: IDocumentItem) => isWithinDays(d.modified, 7)).length,
    [documents]
  );

  const openDocument = (doc: IDocumentItem): void => {
    window.open(doc.serverRelativeUrl, '_blank', 'noopener,noreferrer');
  };

  const columns: IColumn[] = React.useMemo(() => [
    {
      key: 'name',
      name: strings.ColumnName,
      minWidth: 200,
      isResizable: true,
      onRender: (doc: IDocumentItem) => (
        <span className={styles.fileNameCell}>
          <Icon {...getFileTypeIconProps({ extension: doc.extension, size: 16, imageFileType: 'svg' })} />
          <Link className={styles.fileNameText} onClick={() => openDocument(doc)}>{doc.name}</Link>
        </span>
      )
    },
    {
      key: 'modified',
      name: strings.ColumnModified,
      minWidth: 90,
      maxWidth: 110,
      onRender: (doc: IDocumentItem) => <span>{formatDate(doc.modified)}</span>
    },
    {
      key: 'editor',
      name: strings.ColumnEditor,
      minWidth: 90,
      maxWidth: 140,
      onRender: (doc: IDocumentItem) => <span>{doc.editor}</span>
    },
    {
      key: 'size',
      name: strings.ColumnSize,
      minWidth: 70,
      maxWidth: 90,
      onRender: (doc: IDocumentItem) => <span>{formatFileSize(doc.size)}</span>
    }
  ], []);

  return (
    <section className={styles.documentHub}>
      <PageHeader title={props.title || strings.DefaultTitle} subtitle={libraryTitle}>
        <IconButton
          iconProps={{ iconName: 'GridViewMedium' }}
          title={strings.CardViewLabel}
          ariaLabel={strings.CardViewLabel}
          checked={view === 'card'}
          onClick={() => setView('card')}
        />
        <IconButton
          iconProps={{ iconName: 'BulletedList' }}
          title={strings.TableViewLabel}
          ariaLabel={strings.TableViewLabel}
          checked={view === 'table'}
          onClick={() => setView('table')}
        />
        <IconButton
          iconProps={{ iconName: 'Refresh' }}
          title={strings.RefreshLabel}
          ariaLabel={strings.RefreshLabel}
          onClick={() => { load().catch(() => { /* handled in load */ }); }}
        />
      </PageHeader>

      {!loading && !error ? (
        <div className={styles.statRow}>
          <StatCard iconName='DocumentSet' label={strings.StatTotalDocs} value={`${documents.length}`} />
          <StatCard iconName='Recent' label={strings.StatRecentDocs} value={`${recentCount}`} />
          <StatCard iconName='Database' label={strings.StatTotalSize} value={formatFileSize(totalSize)} />
        </div>
      ) : undefined}

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

      {!loading && !error && filtered.length === 0 ? (
        <EmptyState
          iconName='DocLibrary'
          title={strings.EmptyTitle}
          description={strings.EmptyDescription}
        />
      ) : undefined}

      {!loading && !error && filtered.length > 0 && view === 'card' ? (
        <div className={styles.cardGrid}>
          {paged.map((doc: IDocumentItem) => (
            <div
              key={doc.id}
              className={styles.docCard}
              role='button'
              tabIndex={0}
              onClick={() => openDocument(doc)}
              onKeyDown={(ev: React.KeyboardEvent<HTMLDivElement>) => {
                if (ev.key === 'Enter' || ev.key === ' ') {
                  openDocument(doc);
                }
              }}
            >
              <span className={styles.docCardIcon}>
                <Icon {...getFileTypeIconProps({ extension: doc.extension, size: 24, imageFileType: 'svg' })} />
              </span>
              <span className={styles.docCardBody}>
                <span className={styles.docCardName} title={doc.name}>{doc.name}</span>
                <span className={styles.docCardMeta}>{formatDate(doc.modified)} · {doc.editor}</span>
                <span className={styles.docCardMeta}>{formatFileSize(doc.size)}</span>
              </span>
            </div>
          ))}
        </div>
      ) : undefined}

      {!loading && !error && filtered.length > 0 && view === 'table' ? (
        <DetailsList
          items={paged}
          columns={columns}
          layoutMode={DetailsListLayoutMode.justified}
          selectionMode={SelectionMode.none}
          isHeaderVisible={true}
          compact={true}
        />
      ) : undefined}

      {!loading && !error ? (
        <Pagination
          currentPage={page}
          totalItems={filtered.length}
          pageSize={pageSize}
          onPageChange={setPage}
        />
      ) : undefined}
    </section>
  );
};

export default DocumentHub;
