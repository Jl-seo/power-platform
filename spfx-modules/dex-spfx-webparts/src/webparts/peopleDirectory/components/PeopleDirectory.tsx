import * as React from 'react';
import styles from './PeopleDirectory.module.scss';
import type { IPeopleDirectoryProps } from './IPeopleDirectoryProps';
import { PeopleService, IPerson, IPersonDetail } from '../services/PeopleService';
import {
  Alert,
  Avatar,
  Chip,
  EmptyState,
  IOrgNode,
  OrgChart,
  PageHeader,
  Skeleton
} from '../../../common/dex';
import { Pagination } from '../../../common/components/Pagination';
import * as strings from 'PeopleDirectoryWebPartStrings';
import { MSGraphClientV3 } from '@microsoft/sp-http';
import {
  SearchBox,
  Dropdown,
  IDropdownOption,
  IconButton,
  Icon,
  Panel,
  PanelType,
  Spinner,
  SpinnerSize,
  Link
} from '@fluentui/react';

const ALL_DEPARTMENTS: string = '__all__';
const FETCH_TOP: number = 100;

const PeopleDirectory: React.FC<IPeopleDirectoryProps> = (props: IPeopleDirectoryProps) => {
  const { msGraphClientFactory, pageSize } = props;

  const [people, setPeople] = React.useState<IPerson[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | undefined>(undefined);
  const [query, setQuery] = React.useState<string>('');
  const [department, setDepartment] = React.useState<string>(ALL_DEPARTMENTS);
  const [page, setPage] = React.useState<number>(1);
  const [detail, setDetail] = React.useState<IPersonDetail | undefined>(undefined);
  const [detailLoading, setDetailLoading] = React.useState<boolean>(false);
  const [panelOpen, setPanelOpen] = React.useState<boolean>(false);

  const servicePromiseRef = React.useRef<Promise<PeopleService> | undefined>(undefined);

  const getService = React.useCallback((): Promise<PeopleService> => {
    if (!servicePromiseRef.current) {
      servicePromiseRef.current = msGraphClientFactory
        .getClient('3')
        .then((client: MSGraphClientV3) => new PeopleService(client));
    }
    return servicePromiseRef.current;
  }, [msGraphClientFactory]);

  const load = React.useCallback(async (searchText: string): Promise<void> => {
    setLoading(true);
    setError(undefined);
    try {
      const service: PeopleService = await getService();
      const items: IPerson[] = await service.getPeople(searchText, FETCH_TOP);
      setPeople(items);
    } catch (e) {
      setPeople([]);
      setError(`${strings.LoadErrorPrefix} (${e instanceof Error ? e.message : e})`);
    } finally {
      setLoading(false);
      setPage(1);
    }
  }, [getService]);

  React.useEffect(() => {
    load('').catch(() => { /* handled in load */ });
  }, [load]);

  const openDetail = React.useCallback((personId: string): void => {
    setPanelOpen(true);
    setDetailLoading(true);
    setDetail(undefined);
    getService()
      .then((service: PeopleService) => service.getPersonDetail(personId))
      .then((personDetail: IPersonDetail) => {
        setDetail(personDetail);
        setDetailLoading(false);
      })
      .catch(() => {
        setDetail(undefined);
        setDetailLoading(false);
      });
  }, [getService]);

  const departments: IDropdownOption[] = React.useMemo(() => {
    const seen: { [key: string]: boolean } = {};
    const options: IDropdownOption[] = [{ key: ALL_DEPARTMENTS, text: strings.AllDepartmentsLabel }];
    people.forEach((p: IPerson) => {
      if (p.department && !seen[p.department]) {
        seen[p.department] = true;
        options.push({ key: p.department, text: p.department });
      }
    });
    return options;
  }, [people]);

  const filtered: IPerson[] = React.useMemo(() => {
    if (department === ALL_DEPARTMENTS) {
      return people;
    }
    return people.filter((p: IPerson) => p.department === department);
  }, [people, department]);

  const paged: IPerson[] = React.useMemo(() => {
    const start: number = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  // Manager → selected person → direct reports, rendered with the DEX OrgChart.
  const orgRoot: IOrgNode | undefined = React.useMemo(() => {
    if (!detail) {
      return undefined;
    }
    const selfNode: IOrgNode = {
      name: detail.displayName,
      title: detail.jobTitle,
      tone: 'brand',
      children: detail.directReports.map((p: IPerson): IOrgNode => ({
        name: p.displayName,
        title: p.jobTitle,
        tone: 'neutral',
        onClick: () => openDetail(p.id)
      }))
    };
    if (detail.manager) {
      const manager: IPerson = detail.manager;
      return {
        name: manager.displayName,
        title: manager.jobTitle,
        tone: 'light',
        onClick: () => openDetail(manager.id),
        children: [selfNode]
      };
    }
    return selfNode;
  }, [detail, openDetail]);

  return (
    <section className={styles.peopleDirectory}>
      <PageHeader
        title={props.title || strings.DefaultTitle}
        subtitle={strings.HeaderSubtitle}
        actions={(
          <IconButton
            iconProps={{ iconName: 'Refresh' }}
            title={strings.RefreshLabel}
            ariaLabel={strings.RefreshLabel}
            onClick={() => { load(query).catch(() => { /* handled in load */ }); }}
          />
        )}
      />

      <div className={styles.toolbar}>
        <SearchBox
          className={styles.searchBox}
          placeholder={strings.SearchPlaceholder}
          value={query}
          onChange={(_ev?: React.ChangeEvent<HTMLInputElement>, value?: string) => setQuery(value || '')}
          onSearch={(value: string) => { load(value).catch(() => { /* handled in load */ }); }}
          onClear={() => {
            setQuery('');
            load('').catch(() => { /* handled in load */ });
          }}
        />
        {departments.length > 1 ? (
          <Dropdown
            options={departments}
            selectedKey={department}
            styles={{ dropdown: { minWidth: 160 } }}
            onChange={(_ev: React.FormEvent<HTMLDivElement>, option?: IDropdownOption) => {
              if (option) {
                setDepartment(option.key as string);
                setPage(1);
              }
            }}
          />
        ) : undefined}
      </div>

      {error ? (
        <Alert tone='danger' title={strings.LoadErrorTitle}>{error}</Alert>
      ) : undefined}

      {loading ? <Skeleton lines={4} /> : undefined}

      {!loading && !error && filtered.length === 0 ? (
        <EmptyState title={strings.EmptyTitle} description={strings.EmptyDescription} />
      ) : undefined}

      {!loading && !error && filtered.length > 0 ? (
        <div>
          <div className={styles.personGrid}>
            {paged.map((person: IPerson) => (
              <div
                key={person.id}
                className={styles.personCard}
                role='button'
                tabIndex={0}
                onClick={() => openDetail(person.id)}
                onKeyDown={(ev: React.KeyboardEvent<HTMLDivElement>) => {
                  if (ev.key === 'Enter' || ev.key === ' ') {
                    openDetail(person.id);
                  }
                }}
              >
                <div className={styles.personIdentity}>
                  <Avatar name={person.displayName} size={40} />
                  <div className={styles.personText}>
                    <span className={styles.personName}>{person.displayName}</span>
                    {person.jobTitle ? <span className={styles.personTitle}>{person.jobTitle}</span> : undefined}
                  </div>
                </div>
                {person.department ? <Chip tone='brand'>{person.department}</Chip> : undefined}
                {person.mail ? (
                  <span className={styles.personCardMeta}>
                    <Icon iconName='Mail' /> {person.mail}
                  </span>
                ) : undefined}
              </div>
            ))}
          </div>
          <Pagination
            currentPage={page}
            totalItems={filtered.length}
            pageSize={pageSize}
            onPageChange={setPage}
          />
        </div>
      ) : undefined}

      <Panel
        isOpen={panelOpen}
        type={PanelType.medium}
        headerText={detail ? detail.displayName : strings.DetailPanelTitle}
        onDismiss={() => setPanelOpen(false)}
        closeButtonAriaLabel={strings.CloseLabel}
        isLightDismiss={true}
      >
        {detailLoading ? (
          <Spinner size={SpinnerSize.large} label={strings.DetailLoadingLabel} />
        ) : undefined}

        {!detailLoading && detail ? (
          <div>
            <div className={styles.personIdentity}>
              <Avatar name={detail.displayName} size={64} />
              <div className={styles.personText}>
                <span className={styles.personName}>{detail.displayName}</span>
                {detail.jobTitle ? <span className={styles.personTitle}>{detail.jobTitle}</span> : undefined}
                {detail.department ? <Chip tone='brand' style={{ alignSelf: 'flex-start', marginTop: 4 }}>{detail.department}</Chip> : undefined}
              </div>
            </div>

            <div className={styles.panelSection}>
              <div className={styles.panelSectionTitle}>{strings.ContactSectionTitle}</div>
              {detail.mail ? (
                <div className={styles.contactRow}>
                  <Icon iconName='Mail' className={styles.contactIcon} />
                  <Link href={`mailto:${detail.mail}`}>{detail.mail}</Link>
                </div>
              ) : undefined}
              {detail.businessPhones.length > 0 ? (
                <div className={styles.contactRow}>
                  <Icon iconName='Phone' className={styles.contactIcon} />
                  <span>{detail.businessPhones.join(', ')}</span>
                </div>
              ) : undefined}
              {detail.officeLocation ? (
                <div className={styles.contactRow}>
                  <Icon iconName='POI' className={styles.contactIcon} />
                  <span>{detail.officeLocation}</span>
                </div>
              ) : undefined}
            </div>

            {orgRoot && (detail.manager || detail.directReports.length > 0) ? (
              <div className={styles.panelSection}>
                <div className={styles.panelSectionTitle}>{strings.OrgSectionTitle}</div>
                <OrgChart root={orgRoot} />
              </div>
            ) : undefined}
          </div>
        ) : undefined}

        {!detailLoading && !detail ? (
          <Alert tone='warning'>{strings.DetailLoadError}</Alert>
        ) : undefined}
      </Panel>
    </section>
  );
};

export default PeopleDirectory;
