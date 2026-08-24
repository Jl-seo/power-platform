import { MSGraphClientV3 } from '@microsoft/sp-http';

export interface IPerson {
  id: string;
  displayName: string;
  jobTitle: string;
  department: string;
  mail: string;
  officeLocation: string;
  businessPhones: string[];
}

export interface IPersonDetail extends IPerson {
  manager?: IPerson;
  directReports: IPerson[];
}

interface IGraphUserRaw {
  id: string;
  displayName?: string;
  jobTitle?: string;
  department?: string;
  mail?: string;
  officeLocation?: string;
  businessPhones?: string[];
  manager?: IGraphUserRaw;
  directReports?: IGraphUserRaw[];
}

const USER_SELECT: string =
  'id,displayName,jobTitle,department,mail,officeLocation,businessPhones';

const toPerson = (raw: IGraphUserRaw): IPerson => ({
  id: raw.id,
  displayName: raw.displayName || '',
  jobTitle: raw.jobTitle || '',
  department: raw.department || '',
  mail: raw.mail || '',
  officeLocation: raw.officeLocation || '',
  businessPhones: raw.businessPhones || []
});

export class PeopleService {
  private readonly _client: MSGraphClientV3;

  public constructor(client: MSGraphClientV3) {
    this._client = client;
  }

  public async getPeople(query: string, top: number): Promise<IPerson[]> {
    const trimmed: string = query.replace(/["\\]/g, '').trim();

    let request = this._client
      .api('/users')
      .version('v1.0')
      .select(USER_SELECT)
      .top(top);

    if (trimmed) {
      request = request
        .header('ConsistencyLevel', 'eventual')
        .query({
          $search: `"displayName:${trimmed}" OR "mail:${trimmed}" OR "department:${trimmed}"`,
          $count: 'true'
        });
    } else {
      request = request.orderby('displayName');
    }

    const response: { value?: IGraphUserRaw[] } = await request.get();
    return (response.value || [])
      .filter((raw: IGraphUserRaw) => !!raw.displayName)
      .map(toPerson);
  }

  public async getPersonDetail(id: string): Promise<IPersonDetail> {
    const raw: IGraphUserRaw = await this._client
      .api(`/users/${id}`)
      .version('v1.0')
      .select(USER_SELECT)
      .expand(`manager($select=${USER_SELECT}),directReports($select=${USER_SELECT})`)
      .get();

    return {
      ...toPerson(raw),
      manager: raw.manager ? toPerson(raw.manager) : undefined,
      directReports: (raw.directReports || []).map(toPerson)
    };
  }
}
