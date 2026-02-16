# 4. PCF 컴포넌트 개발 가이드

Power Apps Component Framework(PCF)를 사용한 리소스 트리 뷰 컴포넌트 개발 가이드입니다.

---

## 🚀 Quick Start

### 1. PAC CLI 설치

```bash
# PAC CLI 설치 (Node.js 필수)
npm install -g @microsoft/pac

# 설치 확인
pac --version
```

### 2. 프로젝트 생성

```bash
# 프로젝트 폴더 생성
mkdir ResourceTreeView && cd ResourceTreeView

# PCF 프로젝트 초기화 (React 템플릿)
pac pcf init \
  --namespace CoEPortal \
  --name ResourceTreeView \
  --template field \
  --framework react \
  --run-npm-install

# FluentUI 설치
npm install @fluentui/react-components @fluentui/react-icons
```

---

## 📁 프로젝트 구조

```
ResourceTreeView/
├── ControlManifest.Input.xml    # 컴포넌트 매니페스트
├── index.ts                     # 컨트롤 진입점
├── components/
│   └── ResourceTreeView.tsx     # React 컴포넌트
├── generated/
│   └── ManifestTypes.d.ts       # 자동 생성 타입
├── package.json
└── tsconfig.json
```

---

## 🔧 핵심 파일 설명

### ControlManifest.Input.xml

```xml
<!-- 입력: 환경 데이터 (JSON) -->
<property name="environmentData" 
          of-type="Multiple" 
          usage="input" 
          required="true" />

<!-- 출력: 선택된 리소스 -->
<property name="selectedResourceId" 
          of-type="SingleLine.Text" 
          usage="output" />

<!-- Platform Libraries (React 18 + Fluent 9) -->
<platform-library name="React" version="18.2.0" />
<platform-library name="Fluent" version="9.46.2" />
```

### 입력 데이터 형식 (JSON)

```json
[
  {
    "id": "env-guid",
    "name": "Production Environment",
    "type": "Production",
    "apps": [
      { "id": "app-1", "name": "Sales App", "status": "active" },
      { "id": "app-2", "name": "HR Portal", "status": "quarantined" }
    ],
    "flows": [
      { "id": "flow-1", "name": "Approval Flow", "status": "active" }
    ],
    "bots": [
      { "id": "bot-1", "name": "HR Bot", "status": "inactive" }
    ]
  }
]
```

---

## 🎨 UI 컴포넌트 특징

### 상태 표시

| 상태 | 색상 | 의미 |
|------|------|------|
| 🟢 Active | Green | 정상 운영 중 |
| ⚪ Inactive | Gray | 비활성 |
| 🔴 Quarantined | Red | 격리됨 (비준수) |

### 환경 타입 뱃지

| 타입 | 색상 |
|------|------|
| Production | Blue (Brand) |
| Sandbox | Gray |
| Developer | Green |
| Teams | Yellow |

---

## 🔨 빌드 및 테스트

### 로컬 테스트

```bash
# 빌드 및 워치 모드
npm start watch

# 테스트 하네스 열림: https://localhost:8181
```

### 프로덕션 빌드

```bash
npm run build
```

---

## 📦 솔루션 패키징

### 1. 솔루션 초기화

```bash
# 상위 폴더로 이동
cd ..

# 솔루션 프로젝트 생성
pac solution init \
  --publisher-name CoEPortal \
  --publisher-prefix coe

# PCF 컴포넌트 참조 추가
pac solution add-reference --path ./ResourceTreeView
```

### 2. 빌드

```bash
# MSBuild 또는 dotnet 사용
msbuild /t:build /restore

# 또는
dotnet build
```

### 3. Power Platform 배포

```bash
# 솔루션 가져오기
pac solution import --path ./bin/Debug/CoEPortal.zip

# 또는 Power Apps maker portal에서 수동 가져오기
```

---

## 🔗 Power Apps 연동

### Canvas App에서 사용

1. **컴포넌트 추가**: 삽입 → 컴포넌트 가져오기 → 코드
2. **데이터 바인딩**:

```powerfx
// Inventory API 데이터를 JSON으로 변환하여 전달
ResourceTreeView.environmentData: JSON(colEnvironmentData)

// 선택된 리소스 처리
If(!IsBlank(ResourceTreeView.selectedResourceId),
    Navigate(ResourceDetailScreen, ScreenTransition.Fade)
)
```

---

## ✅ 체크리스트

- [x] PAC CLI 설치
- [x] 프로젝트 초기화
- [x] FluentUI 설치
- [ ] 로컬 테스트 완료
- [ ] 솔루션 패키징
- [ ] Power Apps 배포

---

## 🔗 참고 문서

- [PCF 공식 문서](https://learn.microsoft.com/power-apps/developer/component-framework/overview)
- [FluentUI React Components](https://react.fluentui.dev/)
- [Platform Libraries](https://learn.microsoft.com/power-apps/developer/component-framework/react-controls-platform-libraries)
