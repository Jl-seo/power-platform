declare interface INoticeBoardWebPartStrings {
  PropertyPaneDescription: string;
  BasicGroupName: string;
  TitleFieldLabel: string;
  ListTitleFieldLabel: string;
  ListTitleFieldDescription: string;
  PageSizeFieldLabel: string;
  DefaultTitle: string;
  DefaultListTitle: string;
  SearchPlaceholder: string;
  AllCategoriesLabel: string;
  RefreshLabel: string;
  CloseLabel: string;
  EmptyTitle: string;
  EmptyDescription: string;
  NoBodyLabel: string;
  LoadErrorPrefix: string;
}

declare module 'NoticeBoardWebPartStrings' {
  const strings: INoticeBoardWebPartStrings;
  export = strings;
}
