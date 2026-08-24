declare interface IInsightsDashboardWebPartStrings {
  PropertyPaneDescription: string;
  BasicGroupName: string;
  TitleFieldLabel: string;
  ListTitleFieldLabel: string;
  LibraryTitleFieldLabel: string;
  MonthsBackFieldLabel: string;
  DefaultTitle: string;
  DefaultListTitle: string;
  DefaultLibraryTitle: string;
  RefreshLabel: string;
  StatTotalDocs: string;
  StatRecentDocs: string;
  StatRecentNotices: string;
  StatTotalSize: string;
  TrendChartTitle: string;
  TrendChartSubtitle: string;
  TypeChartTitle: string;
  TypeChartSubtitle: string;
  CategoryChartTitle: string;
  CategoryChartSubtitle: string;
  MonthSuffix: string;
  OtherLabel: string;
  UncategorizedLabel: string;
  LoadErrorTitle: string;
  CountUnit: string;
  DonutCenterLabel: string;
  NoDataLabel: string;
  NoticeLoadErrorPrefix: string;
  DocumentLoadErrorPrefix: string;
}

declare module 'InsightsDashboardWebPartStrings' {
  const strings: IInsightsDashboardWebPartStrings;
  export = strings;
}
