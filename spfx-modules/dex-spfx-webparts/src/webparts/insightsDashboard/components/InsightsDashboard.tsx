import * as React from 'react';
import styles from './InsightsDashboard.module.scss';
import type { IInsightsDashboardProps } from './IInsightsDashboardProps';
import { NoticeService, INotice } from '../../noticeBoard/services/NoticeService';
import { DocumentService, IDocumentItem } from '../../documentHub/services/DocumentService';
import { PageHeader } from '../../../common/components/PageHeader';
import { StatCard } from '../../../common/components/StatCard';
import { EmptyState } from '../../../common/components/EmptyState';
import { ColumnChart } from '../../../common/components/charts/ColumnChart';
import { HBarChart } from '../../../common/components/charts/HBarChart';
import { IChartDatum } from '../../../common/components/charts/ChartTypes';
import { formatFileSize, isWithinDays } from '../../../common/format';
import * as strings from 'InsightsDashboardWebPartStrings';
import {
  IconButton,
  MessageBar,
  MessageBarType,
  Shimmer
} from '@fluentui/react';

const TOP_TYPES: number = 5;

const monthKey = (d: Date): string => `${d.getFullYear()}-${d.getMonth()}`;

const buildMonthlyTrend = (documents: IDocumentItem[], monthsBack: number): IChartDatum[] => {
  const now: Date = new Date();
  const buckets: IChartDatum[] = [];
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

const buildTypeDistribution = (documents: IDocumentItem[]): IChartDatum[] => {
  const counts: { [ext: string]: number } = {};
  documents.forEach((doc: IDocumentItem) => {
    const ext: string = doc.extension ? doc.extension.toUpperCase() : strings.OtherLabel;
    counts[ext] = (counts[ext] || 0) + 1;
  });

  const sorted: IChartDatum[] = Object.keys(counts)
    .map((ext: string): IChartDatum => ({ label: ext, value: counts[ext] }))
    .sort((a: IChartDatum, b: IChartDatum) => b.value - a.value);

  if (sorted.length <= TOP_TYPES + 1) {
    return sorted;
  }
  const top: IChartDatum[] = sorted.slice(0, TOP_TYPES);
  const otherTotal: number = sorted
    .slice(TOP_TYPES)
    .reduce((sum: number, d: IChartDatum) => sum + d.value, 0);
  top.push({ label: strings.OtherLabel, value: otherTotal });
  return top;
};

const buildCategoryDistribution = (notices: INotice[]): IChartDatum[] => {
  const counts: { [category: string]: number } = {};
  notices.forEach((n: INotice) => {
    const category: string = n.category || strings.UncategorizedLabel;
    counts[category] = (counts[category] || 0) + 1;
  });
  return Object.keys(counts)
    .map((category: string): IChartDatum => ({ label: category, value: counts[category] }))
    .sort((a: IChartDatum, b: IChartDatum) => b.value - a.value);
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

  const monthlyTrend: IChartDatum[] = React.useMemo(
    () => buildMonthlyTrend(documents, monthsBack),
    [documents, monthsBack]
  );

  const typeDistribution: IChartDatum[] = React.useMemo(
    () => buildTypeDistribution(documents),
    [documents]
  );

  const categoryDistribution: IChartDatum[] = React.useMemo(
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
      <PageHeader title={props.title || strings.DefaultTitle} subtitle={`${listTitle} · ${libraryTitle}`}>
        <IconButton
          iconProps={{ iconName: 'Refresh' }}
          title={strings.RefreshLabel}
          ariaLabel={strings.RefreshLabel}
          onClick={() => { load().catch(() => { /* handled per-source in load */ }); }}
        />
      </PageHeader>

      {loading ? (
        <div>
          <Shimmer style={{ marginBottom: 10 }} />
          <Shimmer style={{ marginBottom: 10 }} width='90%' />
          <Shimmer width='80%' />
        </div>
      ) : (
        <div>
          {noticeError ? (
            <MessageBar className={styles.sectionError} messageBarType={MessageBarType.warning}>
              {noticeError}
            </MessageBar>
          ) : undefined}
          {documentError ? (
            <MessageBar className={styles.sectionError} messageBarType={MessageBarType.warning}>
              {documentError}
            </MessageBar>
          ) : undefined}

          <div className={styles.statRow}>
            <StatCard iconName='DocumentSet' label={strings.StatTotalDocs} value={`${documents.length}`} />
            <StatCard iconName='Recent' label={strings.StatRecentDocs} value={`${recentDocs}`} />
            <StatCard iconName='Megaphone' label={strings.StatRecentNotices} value={`${recentNotices}`} />
            <StatCard iconName='Database' label={strings.StatTotalSize} value={formatFileSize(totalSize)} />
          </div>

          <div className={styles.chartGrid}>
            <div className={styles.chartCard}>
              <span className={styles.chartTitle}>{strings.TrendChartTitle}</span>
              <span className={styles.chartSubtitle}>{strings.TrendChartSubtitle}</span>
              {documents.length > 0 ? (
                <ColumnChart data={monthlyTrend} ariaLabel={strings.TrendChartTitle} />
              ) : (
                <EmptyState iconName='BarChartVertical' title={strings.NoDataLabel} />
              )}
            </div>

            <div className={styles.chartCard}>
              <span className={styles.chartTitle}>{strings.TypeChartTitle}</span>
              <span className={styles.chartSubtitle}>{strings.TypeChartSubtitle}</span>
              {typeDistribution.length > 0 ? (
                <HBarChart data={typeDistribution} ariaLabel={strings.TypeChartTitle} />
              ) : (
                <EmptyState iconName='BarChartHorizontal' title={strings.NoDataLabel} />
              )}
            </div>

            <div className={styles.chartCard}>
              <span className={styles.chartTitle}>{strings.CategoryChartTitle}</span>
              <span className={styles.chartSubtitle}>{strings.CategoryChartSubtitle}</span>
              {categoryDistribution.length > 0 ? (
                <HBarChart data={categoryDistribution} ariaLabel={strings.CategoryChartTitle} />
              ) : (
                <EmptyState iconName='BarChartHorizontal' title={strings.NoDataLabel} />
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default InsightsDashboard;
