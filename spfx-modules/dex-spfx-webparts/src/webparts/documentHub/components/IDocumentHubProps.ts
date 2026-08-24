import { SPHttpClient } from '@microsoft/sp-http';

export type DocumentHubView = 'card' | 'table';

export interface IDocumentHubProps {
  title: string;
  libraryTitle: string;
  pageSize: number;
  defaultView: DocumentHubView;
  webUrl: string;
  spHttpClient: SPHttpClient;
}
