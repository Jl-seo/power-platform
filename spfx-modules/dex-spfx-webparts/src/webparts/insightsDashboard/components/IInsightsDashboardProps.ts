import { SPHttpClient } from '@microsoft/sp-http';

export interface IInsightsDashboardProps {
  title: string;
  listTitle: string;
  libraryTitle: string;
  monthsBack: number;
  webUrl: string;
  spHttpClient: SPHttpClient;
}
