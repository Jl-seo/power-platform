import { SPHttpClient, SPHttpClientResponse } from '@microsoft/sp-http';

export interface INotice {
  id: number;
  title: string;
  body: string;
  category: string;
  isPinned: boolean;
  created: string;
  author: string;
}

interface INoticeListItemRaw {
  Id: number;
  Title?: string;
  Body?: string;
  Category?: string;
  IsPinned?: boolean;
  Created: string;
  Author?: { Title?: string };
}

const FULL_QUERY: string =
  '$select=Id,Title,Body,Category,IsPinned,Created,Author/Title&$expand=Author';
const MINIMAL_QUERY: string = '$select=Id,Title,Created,Author/Title&$expand=Author';

export class NoticeService {
  private readonly _client: SPHttpClient;
  private readonly _webUrl: string;

  public constructor(client: SPHttpClient, webUrl: string) {
    this._client = client;
    this._webUrl = webUrl;
  }

  /**
   * Loads notices from the configured list. Falls back to a minimal field set
   * when the list does not have the optional columns (Body, Category, IsPinned).
   */
  public async getNotices(listTitle: string): Promise<INotice[]> {
    try {
      return await this._fetchItems(listTitle, FULL_QUERY);
    } catch (fullError) {
      try {
        return await this._fetchItems(listTitle, MINIMAL_QUERY);
      } catch {
        throw fullError;
      }
    }
  }

  private async _fetchItems(listTitle: string, query: string): Promise<INotice[]> {
    const safeTitle: string = encodeURIComponent(listTitle.replace(/'/g, "''"));
    const url: string =
      `${this._webUrl}/_api/web/lists/getByTitle('${safeTitle}')/items` +
      `?${query}&$orderby=Created desc&$top=200`;

    const response: SPHttpClientResponse = await this._client.get(
      url,
      SPHttpClient.configurations.v1
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const json: { value?: INoticeListItemRaw[] } = await response.json();
    return (json.value || []).map((item: INoticeListItemRaw): INotice => ({
      id: item.Id,
      title: item.Title || '(제목 없음)',
      body: item.Body || '',
      category: item.Category || '',
      isPinned: item.IsPinned === true,
      created: item.Created,
      author: (item.Author && item.Author.Title) || ''
    }));
  }
}
