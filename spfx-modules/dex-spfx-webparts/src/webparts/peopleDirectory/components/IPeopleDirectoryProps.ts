import { MSGraphClientFactory } from '@microsoft/sp-http';

export interface IPeopleDirectoryProps {
  title: string;
  pageSize: number;
  msGraphClientFactory: MSGraphClientFactory;
}
