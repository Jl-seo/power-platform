# dex-spfx-webparts

기업 인트라넷 포털용 SharePoint Framework(SPFx) 웹파트 모음입니다.
Fluent UI 기반으로, 엔터프라이즈 디자인 시스템 패턴(PageHeader · Table · Search · Drawer(Panel) · Pagination · EmptyState · StatCard)을 따라 구현했습니다.

## 포함된 웹파트

| 웹파트 | 설명 | 데이터 소스 |
|---|---|---|
| **공지사항 (Notice Board)** | 고정 공지, 분류 필터, 검색, 페이지네이션, 상세 Panel | SharePoint 목록 |
| **문서 허브 (Document Hub)** | 카드/테이블 보기 전환, 검색, 사용 현황 StatCard | 문서 라이브러리 |
| **조직도/직원 검색 (People Directory)** | 직원 검색, 부서 필터, 상급자/직속 구성원 조회 | Microsoft Graph |
| **현황 대시보드 (Insights Dashboard)** | KPI 타일 4종 + 월별 문서 추이/파일 형식별/분류별 차트 | SharePoint 목록 + 문서 라이브러리 |

## 사전 준비

- Node.js **v22.14 이상 v23 미만** (SPFx 1.23)
- SharePoint Online 테넌트 및 앱 카탈로그

### 공지사항 목록 스키마

`공지사항`(또는 웹파트 속성에서 지정한 이름) 목록에 아래 열을 만듭니다.
`Body`/`Category`/`IsPinned` 열이 없어도 기본 필드만으로 동작합니다(자동 폴백).

| 열 이름(내부 이름) | 형식 | 용도 |
|---|---|---|
| `Title` | 한 줄 텍스트 (기본) | 공지 제목 |
| `Body` | 여러 줄 텍스트(서식 있는 텍스트) | 본문 |
| `Category` | 선택 항목 | 분류 (예: 일반/인사/시스템) |
| `IsPinned` | 예/아니요 | 상단 고정 여부 |

### Microsoft Graph 권한 (조직도/직원 검색)

`package-solution.json`에 `User.Read.All` 권한 요청이 포함되어 있습니다.
패키지 배포 후 **SharePoint 관리 센터 → 고급 → API 액세스**에서 요청을 승인해야 합니다.

## 개발

```bash
npm install
npm run start     # 로컬 개발 서버 (호스팅된 워크벤치에서 확인)
```

호스팅된 워크벤치: `https://<tenant>.sharepoint.com/_layouts/workbench.aspx`

## 빌드 및 배포

```bash
npm run build     # 테스트 + 프로덕션 번들 + .sppkg 패키징
```

생성된 `sharepoint/solution/dex-spfx-webparts.sppkg`를 테넌트 앱 카탈로그에 업로드한 뒤,
사이트에 앱을 추가하고 페이지에 웹파트를 배치합니다.

## 웹파트 속성

- **공지사항**: 웹파트 제목, 목록 이름(기본: `공지사항`), 페이지당 항목 수
- **문서 허브**: 웹파트 제목, 라이브러리 이름(기본: `문서`), 페이지당 항목 수, 기본 보기(카드/테이블)
- **조직도/직원 검색**: 웹파트 제목, 페이지당 인원 수
- **현황 대시보드**: 웹파트 제목, 공지 목록 이름, 라이브러리 이름, 추이 표시 개월 수(3~12)

## 참고

- 공지 본문(`Body`)은 서식 있는 텍스트를 그대로 렌더링합니다. 목록 편집 권한을 신뢰할 수 있는
  담당자로 제한하는 것을 권장합니다.
- 언어 리소스는 한국어(`ko-kr`)와 영어(`en-us`)를 제공하며, 사이트 언어에 따라 자동 적용됩니다.
