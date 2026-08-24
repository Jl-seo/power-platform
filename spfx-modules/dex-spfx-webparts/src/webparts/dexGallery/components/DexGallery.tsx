import * as React from 'react';
import styles from './DexGallery.module.scss';
import type { IDexGalleryProps } from './IDexGalleryProps';
import {
  Alert,
  Avatar,
  AvatarGroup,
  Badge,
  BadgeTone,
  BarChart,
  Card,
  Chip,
  ChipTone,
  Donut,
  EmptyState,
  OrgChart,
  PageHeader,
  Progress,
  ProgressRing,
  Skeleton,
  StatCard,
  Steps,
  Tabs,
  Timeline
} from '../../../common/dex';

const BADGE_TONES: BadgeTone[] = ['brand', 'neutral', 'success', 'warning', 'danger', 'purple', 'teal', 'orange'];
const CHIP_TONES: ChipTone[] = ['brand', 'neutral', 'purple', 'teal', 'pink', 'orange'];

const SAMPLE_BARS = [
  { label: '3월', value: 12 }, { label: '4월', value: 31 }, { label: '5월', value: 8 },
  { label: '6월', value: 24 }, { label: '7월', value: 47 }, { label: '8월', value: 19 }
];

const SAMPLE_DONUT = [
  { label: 'DOCX', value: 128 }, { label: 'XLSX', value: 96 }, { label: 'PPTX', value: 54 },
  { label: 'PDF', value: 41 }, { label: '기타', value: 21 }
];

const DexGallery: React.FC<IDexGalleryProps> = (props: IDexGalleryProps) => {
  const [tab, setTab] = React.useState<string>('all');

  return (
    <section className={styles.dexGallery}>
      <PageHeader
        title={props.title}
        subtitle='DigitalExpertsConsulting/design-system 포팅 컴포넌트 18종'
        tabs={(
          <Tabs
            items={[
              { id: 'all', label: '전체', count: 18 },
              { id: 'data', label: '데이터 표시' },
              { id: 'feedback', label: '피드백' }
            ]}
            active={tab}
            onChange={setTab}
          />
        )}
      />

      <div className={styles.grid}>
        {(tab === 'all' || tab === 'data') ? (
          <React.Fragment>
            <div className={styles.fullWidth}>
              <div className={styles.statRow}>
                <StatCard label='월 처리 건수' value={1284} unit='건' delta='12%' sparkline={[12, 31, 8, 24, 47, 19]} />
                <StatCard label='SLA 준수율' value='98.2' unit='%' delta='0.4%' />
                <StatCard label='미결 건수' value={37} unit='건' delta='5건' deltaPositive={false} />
              </div>
            </div>

            <Card title='BarChart' subtitle='highlight-last 패턴' padding={20}>
              <BarChart data={SAMPLE_BARS} height={140} showValues={true} />
            </Card>

            <Card title='Donut' subtitle='chart-1~6 시퀀스' padding={20}>
              <Donut data={SAMPLE_DONUT} size={140} thickness={20} centerValue='340' centerLabel='전체' />
            </Card>

            <Card title='Progress · ProgressRing' padding={20}>
              <div className={styles.stack}>
                <Progress value={72} showLabel={true} />
                <Progress value={45} tone='teal' showLabel={true} />
                <Progress value={18} tone='danger' showLabel={true} />
                <div className={styles.row}>
                  <ProgressRing value={72} label='진행률' />
                  <ProgressRing value={94} tone='success' label='완료율' />
                </div>
              </div>
            </Card>

            <Card title='Timeline' padding={20}>
              <Timeline items={[
                { title: '배포 완료', time: '오늘 14:20', description: 'v2.4.0 프로덕션 반영', tone: 'success' },
                { title: '검토 요청', time: '오늘 11:05', description: '보안팀 리뷰 대기', tone: 'warning' },
                { title: '개발 착수', time: '어제', tone: 'neutral' }
              ]} />
            </Card>

            <Card title='OrgChart' padding={20}>
              <OrgChart root={{
                name: '김본부장', title: '경영지원본부', tone: 'light',
                children: [{
                  name: '박팀장', title: '인사팀', tone: 'brand',
                  children: [
                    { name: '이대리', title: '채용' },
                    { name: '최주임', title: '급여' }
                  ]
                }]
              }} />
            </Card>

            <Card title='Avatar · AvatarGroup' padding={20}>
              <div className={styles.stack}>
                <div className={styles.row}>
                  <Avatar name='김지훈' size={44} />
                  <Avatar name='박서연' size={44} />
                  <Avatar name='이민준' size={44} />
                  <Avatar name='Choi Ara' size={44} />
                </div>
                <AvatarGroup names={['김지훈', '박서연', '이민준', '최아라', '정하늘', '한결']} max={4} />
              </div>
            </Card>

            <Card title='Steps' padding={20}>
              <Steps items={['요청', '검토', '승인', '완료']} current={2} />
            </Card>
          </React.Fragment>
        ) : undefined}

        {(tab === 'all' || tab === 'feedback') ? (
          <React.Fragment>
            <Card title='Badge · Chip' padding={20}>
              <div className={styles.stack}>
                <div className={styles.row}>
                  {BADGE_TONES.map((tone: BadgeTone) => <Badge key={tone} tone={tone}>{tone}</Badge>)}
                </div>
                <div className={styles.row}>
                  <Badge tone='brand' solid={true}>solid</Badge>
                  <Badge tone='danger' dot={true}>dot</Badge>
                </div>
                <div className={styles.row}>
                  {CHIP_TONES.map((tone: ChipTone) => <Chip key={tone} tone={tone}>{tone}</Chip>)}
                </div>
              </div>
            </Card>

            <Card title='Alert' padding={20}>
              <div className={styles.stack}>
                <Alert tone='info' title='안내'>새 버전이 배포되었습니다.</Alert>
                <Alert tone='success' title='성공'>변경 사항이 저장되었습니다.</Alert>
                <Alert tone='warning' title='주의'>저장 공간이 90%를 초과했습니다.</Alert>
                <Alert tone='danger' title='오류'>목록을 불러오지 못했습니다.</Alert>
              </div>
            </Card>

            <Card title='Skeleton' padding={20}>
              <div className={styles.stack}>
                <div className={styles.row}>
                  <Skeleton variant='circle' size={40} />
                  <Skeleton lines={2} style={{ flex: 1 }} />
                </div>
                <Skeleton variant='rect' height={60} />
              </div>
            </Card>

            <Card title='EmptyState' padding={0} bodyStyle={{ padding: 0 }}>
              <EmptyState title='아직 항목이 없습니다' description='첫 항목을 추가하면 여기에 표시됩니다.' />
            </Card>
          </React.Fragment>
        ) : undefined}
      </div>
    </section>
  );
};

export default DexGallery;
