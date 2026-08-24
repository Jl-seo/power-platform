import { SPHttpClient } from '@microsoft/sp-http';

export interface INoticeBoardProps {
  title: string;
  listTitle: string;
  pageSize: number;
  webUrl: string;
  spHttpClient: SPHttpClient;
}
