import * as React from 'react';
import styles from './PeopleDirectory.module.scss';
import type { IPeopleDirectoryProps } from './IPeopleDirectoryProps';
import { PeopleService, IPerson, IPersonDetail } from '../services/PeopleService';
import { PageHeader } from '../../../common/components/PageHeader';
import { EmptyState } from '../../../common/components/EmptyState';
import { Pagination } from '../../../common/components/Pagination';
import * as strings from 'PeopleDirectoryWebPartStrings';
import { MSGraphClientV3 } from '@microsoft/sp-http';
import {
  SearchBox,
  Dropdown,
  IDropdownOption,
  IconButton,
  Icon,
  MessageBar,
  MessageBarType,
  Shimmer,
  Panel,
  PanelType,
  Persona,
  PersonaSize,
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

  const renderOrgPerson = (person: IPerson): React.ReactElement => (
    <div
      key={person.id}
      className={styles.orgPerson}
      role='button'
      tabIndex={0}
      onClick={() => openDetail(person.id)}
      onKeyDown={(ev: React.KeyboardEvent<HTMLDivElement>) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          openDetail(person.id);
        }
      }}
    >
      <Persona
        text={person.displayName}
        secondaryText={person.jobTitle}
        size={PersonaSize.size32}
      />
    </div>
  );

  return (
    <section className={styles.peopleDirectory}>
      <PageHeader title={props.title || strings.DefaultTitle} subtitle={strings.HeaderSubtitle}>
        <IconButton
          iconProps={{ iconName: 'Refresh' }}
          title={strings.RefreshLabel}
          ariaLabel={strings.RefreshLabel}
          onClick={() => { load(query).catch(() => { /* handled in load */ }); }}
        />
      </PageHeader>

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
        <MessageBar messageBarType={MessageBarType.error}>{error}</MessageBar>
      ) : undefined}

      {loading ? (
        <div>
          <Shimmer style={{ marginBottom: 10 }} />
          <Shimmer style={{ marginBottom: 10 }} width='90%' />
          <Shimmer width='80%' />
        </div>
      ) : undefined}

      {!loading && !error && filtered.length === 0 ? (
        <EmptyState
          iconName='People'
          title={strings.EmptyTitle}
          description={strings.EmptyDescription}
        />
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
                <Persona
                  text={person.displayName}
                  secondaryText={person.jobTitle}
                  size={PersonaSize.size40}
                />
                {person.department ? (
                  <span className={styles.departmentChip}>{person.department}</span>
                ) : undefined}
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
            <Persona
              text={detail.displayName}
              secondaryText={detail.jobTitle}
              tertiaryText={detail.department}
              size={PersonaSize.size72}
            />

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

            {detail.manager ? (
              <div className={styles.panelSection}>
                <div className={styles.panelSectionTitle}>{strings.ManagerSectionTitle}</div>
                {renderOrgPerson(detail.manager)}
              </div>
            ) : undefined}

            {detail.directReports.length > 0 ? (
              <div className={styles.panelSection}>
                <div className={styles.panelSectionTitle}>
                  {strings.DirectReportsSectionTitle} ({detail.directReports.length})
                </div>
                {detail.directReports.map(renderOrgPerson)}
              </div>
            ) : undefined}
          </div>
        ) : undefined}

        {!detailLoading && !detail ? (
          <MessageBar messageBarType={MessageBarType.warning}>
            {strings.DetailLoadError}
          </MessageBar>
        ) : undefined}
      </Panel>
    </section>
  );
};

export default PeopleDirectory;
