import { SPHttpClient, SPHttpClientResponse } from '@microsoft/sp-http';

export interface IDocumentItem {
  id: number;
  name: string;
  extension: string;
  serverRelativeUrl: string;
  modified: string;
  editor: string;
  size: number;
}

interface IDocumentListItemRaw {
  Id: number;
  FileLeafRef?: string;
  FileRef?: string;
  Modified: string;
  Editor?: { Title?: string };
  File?: { Length?: string | number };
}

export class DocumentService {
  private readonly _client: SPHttpClient;
  private readonly _webUrl: string;

  public constructor(client: SPHttpClient, webUrl: string) {
    this._client = client;
    this._webUrl = webUrl;
  }

  public async getDocuments(libraryTitle: string): Promise<IDocumentItem[]> {
    const safeTitle: string = encodeURIComponent(libraryTitle.replace(/'/g, "''"));
    const url: string =
      `${this._webUrl}/_api/web/lists/getByTitle('${safeTitle}')/items` +
      `?$select=Id,FileLeafRef,FileRef,Modified,Editor/Title,File/Length` +
      `&$expand=Editor,File&$filter=FSObjType eq 0&$orderby=Modified desc&$top=200`;

    const response: SPHttpClientResponse = await this._client.get(
      url,
      SPHttpClient.configurations.v1
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const json: { value?: IDocumentListItemRaw[] } = await response.json();
    return (json.value || []).map((item: IDocumentListItemRaw): IDocumentItem => {
      const name: string = item.FileLeafRef || '';
      const dotIndex: number = name.lastIndexOf('.');
      return {
        id: item.Id,
        name: name,
        extension: dotIndex >= 0 ? name.substring(dotIndex + 1).toLowerCase() : '',
        serverRelativeUrl: item.FileRef || '',
        modified: item.Modified,
        editor: (item.Editor && item.Editor.Title) || '',
        size: item.File && item.File.Length ? Number(item.File.Length) : 0
      };
    });
  }
}
