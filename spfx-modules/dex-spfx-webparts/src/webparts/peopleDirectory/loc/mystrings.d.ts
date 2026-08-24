declare interface IPeopleDirectoryWebPartStrings {
  PropertyPaneDescription: string;
  BasicGroupName: string;
  TitleFieldLabel: string;
  PageSizeFieldLabel: string;
  DefaultTitle: string;
  HeaderSubtitle: string;
  SearchPlaceholder: string;
  AllDepartmentsLabel: string;
  RefreshLabel: string;
  CloseLabel: string;
  EmptyTitle: string;
  EmptyDescription: string;
  LoadErrorPrefix: string;
  DetailPanelTitle: string;
  DetailLoadingLabel: string;
  DetailLoadError: string;
  ContactSectionTitle: string;
  ManagerSectionTitle: string;
  DirectReportsSectionTitle: string;
}

declare module 'PeopleDirectoryWebPartStrings' {
  const strings: IPeopleDirectoryWebPartStrings;
  export = strings;
}
