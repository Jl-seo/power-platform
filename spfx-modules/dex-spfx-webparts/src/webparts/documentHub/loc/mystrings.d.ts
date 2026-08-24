declare interface IDocumentHubWebPartStrings {
  PropertyPaneDescription: string;
  BasicGroupName: string;
  TitleFieldLabel: string;
  LibraryTitleFieldLabel: string;
  LibraryTitleFieldDescription: string;
  PageSizeFieldLabel: string;
  DefaultViewFieldLabel: string;
  DefaultTitle: string;
  DefaultLibraryTitle: string;
  SearchPlaceholder: string;
  CardViewLabel: string;
  TableViewLabel: string;
  RefreshLabel: string;
  ColumnName: string;
  ColumnModified: string;
  ColumnEditor: string;
  ColumnSize: string;
  StatTotalDocs: string;
  StatRecentDocs: string;
  StatTotalSize: string;
  EmptyTitle: string;
  EmptyDescription: string;
  LoadErrorTitle: string;
  LoadErrorPrefix: string;
}

declare module 'DocumentHubWebPartStrings' {
  const strings: IDocumentHubWebPartStrings;
  export = strings;
}
