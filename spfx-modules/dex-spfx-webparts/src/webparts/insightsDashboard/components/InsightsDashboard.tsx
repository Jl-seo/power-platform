import * as React from 'react';
import styles from './InsightsDashboard.module.scss';
import type { IInsightsDashboardProps } from './IInsightsDashboardProps';
import { NoticeService, INotice } from '../../noticeBoard/services/NoticeService';
import { DocumentService, IDocumentItem } from '../../documentHub/services/DocumentService';
import {
  Alert,
  BarChart,
  Donut,
  EmptyState,
  IBarChartDatum,
  IDonutDatum,
  PageHeader,
  Skeleton,
  StatCard
} from '../../../common/dex';
import { formatFileSize, isWithinDays } from '../../../common/format';
import * as strings from 'InsightsDashboardWebPartStrings';
import { IconButton } from '@fluentui/react';

const TOP_TYPES: number = 5;

const monthKey = (d: Date): string => `${d.getFullYear()}-${d.getMonth()}`;

const buildMonthlyTrend = (documents: IDocumentItem[], monthsBack: number): IBarChartDatum[] => {
  const now: Date = new Date();
  const buckets: IBarChartDatum[] = [];
  const bucketIndex: { [key: string]: number } = {};

  for (let i: number = monthsBack - 1; i >= 0; i--) {
    const d: Date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    bucketIndex[monthKey(d)] = buckets.length;
    buckets.push({ label: `${d.getMonth() + 1}${strings.MonthSuffix}`, value: 0 });
  }

  documents.forEach((doc: IDocumentItem) => {
    const modified: Date = new Date(doc.modified);
    if (!isNaN(modified.getTime())) {
      const index: number | undefined = bucketIndex[monthKey(modified)];
      if (index !== undefined) {
        buckets[index].value++;
      }
    }
  });

  return buckets;
};

const buildTypeDistribution = (documents: IDocumentItem[]): IDonutDatum[] => {
  const counts: { [ext: string]: number } = {};
  documents.forEach((doc: IDocumentItem) => {
    const ext: string = doc.extension ? doc.extension.toUpperCase() : strings.OtherLabel;
    counts[ext] = (counts[ext] || 0) + 1;
  });

  const sorted: IDonutDatum[] = Object.keys(counts)
    .map((ext: string): IDonutDatum => ({ label: ext, value: counts[ext] }))
    .sort((a: IDonutDatum, b: IDonutDatum) => b.value - a.value);

  if (sorted.length <= TOP_TYPES + 1) {
    return sorted;
  }
  const top: IDonutDatum[] = sorted.slice(0, TOP_TYPES);
  const otherTotal: number = sorted
    .slice(TOP_TYPES)
    .reduce((sum: number, d: IDonutDatum) => sum + d.value, 0);
  top.push({ label: strings.OtherLabel, value: otherTotal });
  return top;
};

const buildCategoryDistribution = (notices: INotice[]): IBarChartDatum[] => {
  const counts: { [category: string]: number } = {};
  notices.forEach((n: INotice) => {
    const category: string = n.category || strings.UncategorizedLabel;
    counts[category] = (counts[category] || 0) + 1;
  });
  return Object.keys(counts)
    .map((category: string): IBarChartDatum => ({ label: category, value: counts[category] }))
    .sort((a: IBarChartDatum, b: IBarChartDatum) => b.value - a.value);
};

const InsightsDashboard: React.FC<IInsightsDashboardProps> = (props: IInsightsDashboardProps) => {
  const { spHttpClient, webUrl, listTitle, libraryTitle, monthsBack } = props;

  const [notices, setNotices] = React.useState<INotice[]>([]);
  const [documents, setDocuments] = React.useState<IDocumentItem[]>([]);
  const [noticeError, setNoticeError] = React.useState<string | undefined>(undefined);
  const [documentError, setDocumentError] = React.useState<string | undefined>(undefined);
  const [loading, setLoading] = React.useState<boolean>(true);

  const load = React.useCallback(async (): Promise<void> => {
    setLoading(true);
    setNoticeError(undefined);
    setDocumentError(undefined);

    const noticeService: NoticeService = new NoticeService(spHttpClient, webUrl);
    const documentService: DocumentService = new DocumentService(spHttpClient, webUrl);

    const noticesPromise: Promise<void> = noticeService
      .getNotices(listTitle)
      .then((items: INotice[]) => setNotices(items))
      .catch((e) => {
        setNotices([]);
        setNoticeError(`${strings.NoticeLoadErrorPrefix} '${listTitle}' (${e instanceof Error ? e.message : e})`);
      });

    const documentsPromise: Promise<void> = documentService
      .getDocuments(libraryTitle)
      .then((items: IDocumentItem[]) => setDocuments(items))
      .catch((e) => {
        setDocuments([]);
        setDocumentError(`${strings.DocumentLoadErrorPrefix} '${libraryTitle}' (${e instanceof Error ? e.message : e})`);
      });

    await Promise.all([noticesPromise, documentsPromise]);
    setLoading(false);
  }, [spHttpClient, webUrl, listTitle, libraryTitle]);

  React.useEffect(() => {
    load().catch(() => { /* handled per-source in load */ });
  }, [load]);

  const monthlyTrend: IBarChartDatum[] = React.useMemo(
    () => buildMonthlyTrend(documents, monthsBack),
    [documents, monthsBack]
  );

  const typeDistribution: IDonutDatum[] = React.useMemo(
    () => buildTypeDistribution(documents),
    [documents]
  );

  const categoryDistribution: IBarChartDatum[] = React.useMemo(
    () => buildCategoryDistribution(notices),
    [notices]
  );

  const totalSize: number = React.useMemo(
    () => documents.reduce((sum: number, d: IDocumentItem) => sum + d.size, 0),
    [documents]
  );

  const recentDocs: number = React.useMemo(
    () => documents.filter((d: IDocumentItem) => isWithinDays(d.modified, 7)).length,
    [documents]
  );

  const recentNotices: number = React.useMemo(
    () => notices.filter((n: INotice) => isWithinDays(n.created, 30)).length,
    [notices]
  );

  return (
    <section className={styles.insightsDashboard}>
      <PageHeader
        title={props.title || strings.DefaultTitle}
        subtitle={`${listTitle} · ${libraryTitle}`}
        actions={(
          <IconButton
            iconProps={{ iconName: 'Refresh' }}
            title={strings.RefreshLabel}
            ariaLabel={strings.RefreshLabel}
            onClick={() => { load().catch(() => { /* handled per-source in load */ }); }}
          />
        )}
      />

      {loading ? (
        <div>
          <div className={styles.statRow}>
            <Skeleton variant='rect' height={96} />
            <Skeleton variant='rect' height={96} />
            <Skeleton variant='rect' height={96} />
            <Skeleton variant='rect' height={96} />
          </div>
          <Skeleton lines={4} />
        </div>
      ) : (
        <div>
          {noticeError ? (
            <div className={styles.sectionError}>
              <Alert tone='warning' title={strings.LoadErrorTitle}>{noticeError}</Alert>
            </div>
          ) : undefined}
          {documentError ? (
            <div className={styles.sectionError}>
              <Alert tone='warning' title={strings.LoadErrorTitle}>{documentError}</Alert>
            </div>
          ) : undefined}

          <div className={styles.statRow}>
            <StatCard
              label={strings.StatTotalDocs}
              value={documents.length}
              sparkline={monthlyTrend.map((d: IBarChartDatum) => d.value)}
            />
            <StatCard label={strings.StatRecentDocs} value={recentDocs} unit={strings.CountUnit} />
            <StatCard label={strings.StatRecentNotices} value={recentNotices} unit={strings.CountUnit} />
            <StatCard label={strings.StatTotalSize} value={formatFileSize(totalSize)} />
          </div>

          <div className={styles.chartGrid}>
            <div className={styles.chartCard}>
              <span className={styles.chartTitle}>{strings.TrendChartTitle}</span>
              <span className={styles.chartSubtitle}>{strings.TrendChartSubtitle}</span>
              {documents.length > 0 ? (
                <BarChart data={monthlyTrend} height={150} showValues={true} />
              ) : (
                <EmptyState title={strings.NoDataLabel} />
              )}
            </div>

            <div className={styles.chartCard}>
              <span className={styles.chartTitle}>{strings.TypeChartTitle}</span>
              <span className={styles.chartSubtitle}>{strings.TypeChartSubtitle}</span>
              {typeDistribution.length > 0 ? (
                <Donut
                  data={typeDistribution}
                  size={150}
                  thickness={20}
                  centerValue={`${documents.length}`}
                  centerLabel={strings.DonutCenterLabel}
                />
              ) : (
                <EmptyState title={strings.NoDataLabel} />
              )}
            </div>

            <div className={styles.chartCard}>
              <span className={styles.chartTitle}>{strings.CategoryChartTitle}</span>
              <span className={styles.chartSubtitle}>{strings.CategoryChartSubtitle}</span>
              {categoryDistribution.length > 0 ? (
                <BarChart data={categoryDistribution} height={150} showValues={true} highlightLast={false} />
              ) : (
                <EmptyState title={strings.NoDataLabel} />
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default InsightsDashboard;
