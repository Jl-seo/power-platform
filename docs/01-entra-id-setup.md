# 1. Entra ID 앱 등록 및 OAuth 2.0 설정 가이드

Power Platform Inventory API 및 Admin API를 호출하기 위한 인증 설정 가이드입니다.

---

## 📋 Prerequisites

- Azure 구독 및 Microsoft Entra ID 접근 권한
- Power Platform Administrator 또는 Global Administrator 역할
- Power Apps 환경 접근 권한

---

## Step 1: Entra ID 앱 등록

### 1.1 Azure Portal에서 앱 만들기

1. [Azure Portal](https://portal.azure.com) → **Microsoft Entra ID** → **앱 등록**
2. **+ 새 등록** 클릭
3. 설정값 입력:

| 항목 | 값 |
|------|-----|
| 이름 | `PowerPlatform-CoE-Portal` |
| 지원되는 계정 유형 | **이 조직 디렉터리의 계정만** (단일 테넌트) |
| 리디렉션 URI | `https://global.consent.azure-apim.net/redirect` |

4. **등록** 클릭

### 1.2 필수 정보 기록

등록 완료 후 **개요** 페이지에서 다음 값을 복사하세요:

```text
Application (Client) ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
Directory (Tenant) ID:   xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

### 1.3 Client Secret 생성

1. **인증서 및 비밀** → **+ 새 클라이언트 암호**
2. 설명: `CoE-Portal-Secret`, 만료: **24개월**
3. **추가** 후 **값**을 즉시 복사 (다시 볼 수 없음!)

---

## Step 2: API 권한 설정

### 권한 유형 비교

| 유형 | 사용 시나리오 | 인증 방식 |
|------|--------------|----------|
| **위임된 권한 (Delegated)** | 사용자 대신 API 호출 | 사용자 로그인 필요 |
| **애플리케이션 권한 (Application)** | 백그라운드 서비스, 스케줄 작업 | Client Credentials |

---

### ✅ 필수 권한 (현재 등록됨)

**API 권한** → **+ 권한 추가** → 다음 권한 추가:

#### Dynamics CRM
```yaml
API: Dynamics CRM
권한:
  - user_impersonation (Delegated) ✅ → 환경 관리, Dataverse 접근
```

#### Microsoft Graph
```yaml
API: Microsoft Graph
권한:
  - User.Read (Delegated) ✅ → 로그인 사용자 정보
  - Directory.Read.All (Application) ✅ → 사용자/그룹 조회 (퇴사자 앱 이전용)
```

#### Power Platform API
```yaml
API: Power Platform API
권한:
  - ResourceQuery.Resources.Read (Delegated) ✅ → Inventory API 조회
  - CopilotStudio.MinimalBot.Read (Delegated) ✅ → Copilot 봇 조회
  - CopilotStudio.MinimalBot.ReadWrite (Delegated) ✅ → Copilot 봇 관리
```

---

### 🔧 추가 권장 권한 (CoE 전체 기능용)

#### Power Platform API - 추가 권한
```yaml
API: Power Platform API
추가 권한:
  - Licensing.BillingPolicies.Read (Delegated) → 라이선스/청구 정책 조회
  - Licensing.BillingPolicies.ReadWrite (Delegated) → 청구 정책 수정
  - Connectors.Read (Delegated) → 커넥터 정보 조회
  - Environment.Read (Delegated) → 환경 상세 정보 조회
```

#### Microsoft Graph - 추가 권한
```yaml
API: Microsoft Graph
추가 권한:
  # 사용자/그룹 관리
  - User.Read.All (Delegated) → 전체 사용자 정보 조회
  - Group.Read.All (Delegated) → 그룹 멤버십 조회 (앱 공유 분석)
  - GroupMember.Read.All (Application) → 백그라운드 그룹 분석
  
  # 팀즈 통합 (선택)
  - Team.ReadBasic.All (Delegated) → Teams 환경 연동
  - Channel.ReadBasic.All (Delegated) → Teams 채널 정보
  
  # 감사 로그 (고급)
  - AuditLog.Read.All (Application) → 감사 로그 분석 (Admin 전용)
  
  # 이메일 알림
  - Mail.Send (Delegated) → 거버넌스 알림 이메일 발송
```

#### Azure Service Management (선택)
```yaml
API: Azure Service Management
권한:
  - user_impersonation (Delegated) → Azure 리소스 연동 (Azure 자동화 연계 시)
```

---

### 📊 시나리오별 권장 권한 조합

| 시나리오 | 필요 권한 |
|----------|----------|
| **기본 Inventory 조회** | ResourceQuery.Resources.Read ✅ |
| **Copilot 봇 관리** | CopilotStudio.MinimalBot.* ✅ |
| **퇴사자 앱 이전** | Directory.Read.All ✅ + User.Read.All |
| **그룹 공유 분석** | Group.Read.All |
| **라이선스 관리** | Licensing.BillingPolicies.* |
| **감사 로그 조회** | AuditLog.Read.All (Application) |
| **Teams 환경 통합** | Team.ReadBasic.All + Channel.ReadBasic.All |
| **이메일 알림** | Mail.Send |

---

### ⚠️ 주의사항

> **Application 권한 vs Delegated 권한**
> - `Application` 권한은 백그라운드 서비스용 (Power Automate 스케줄 Flow)
> - `Delegated` 권한은 사용자 컨텍스트 필요 (Canvas App에서 호출)
> - 같은 권한이 두 타입으로 있다면 **용도에 맞게 선택**

### 관리자 동의

모든 권한 추가 후 **"[테넌트명]에 대한 관리자 동의 허용"** 버튼 클릭

> ⚠️ **중요**: Application 권한은 반드시 관리자 동의가 필요합니다.

---

## Step 3: Power Apps 커스텀 커넥터 OAuth 2.0 설정

### 3.1 커스텀 커넥터 생성

1. [make.powerapps.com](https://make.powerapps.com) → **데이터** → **커스텀 커넥터**
2. **+ 새 커스텀 커넥터** → **빈 페이지에서 만들기**

### 3.2 일반 정보

```yaml
커넥터 이름: PowerPlatform-Inventory-API
호스트: api.powerplatform.com
기준 URL: /
```

### 3.3 보안 탭 설정

```yaml
인증 유형: OAuth 2.0
ID 공급자: Azure Active Directory

# OAuth 2.0 설정값
Client ID: <Application (Client) ID>
Client Secret: <생성한 비밀 값>
Authorization URL: https://login.microsoftonline.com/<Tenant-ID>/oauth2/v2.0/authorize
Token URL: https://login.microsoftonline.com/<Tenant-ID>/oauth2/v2.0/token
Refresh URL: https://login.microsoftonline.com/<Tenant-ID>/oauth2/v2.0/token
Scope: https://api.powerplatform.com/.default

# 리디렉션 URL (자동 생성됨)
Redirect URL: https://global.consent.azure-apim.net/redirect
```

### 3.4 작업 정의

**정의** 탭에서 새 작업 추가:

#### Query Resources 작업

```yaml
Operation ID: QueryResources
요약: Power Platform 리소스 조회
설명: KQL 쿼리로 전사 리소스 조회

요청:
  Method: POST
  URL: /resourcequery/resources/query
  쿼리 매개변수:
    - api-version: 2024-10-01 (기본값)
  
  본문:
    Content-Type: application/json
    샘플:
      {
        "TableName": "PowerPlatformResources",
        "Clauses": []
      }
```

### 3.5 커넥터 테스트

1. **커넥터 만들기** 클릭
2. **테스트** 탭 → **+ 새 연결** 
3. 인증 팝업에서 로그인
4. 샘플 요청으로 테스트:

```json
{
  "TableName": "PowerPlatformResources",
  "Clauses": [
    {
      "$type": "count"
    }
  ]
}
```

---

## Step 4: Power Automate에서 사용

### CoE Starter Kit 커넥터 활용 (권장)

CoE Starter Kit은 이미 **Power Platform for Admins V2** 커넥터를 제공합니다.

```yaml
커넥터: Power Platform for Admins V2
액션: Query Power Platform resources
→ 커스텀 커넥터 없이 Inventory API 직접 호출 가능!
```

### 언제 커스텀 커넥터가 필요한가?

| 시나리오 | 권장 방식 |
|----------|----------|
| 기본 Inventory 조회 | Power Platform for Admins V2 커넥터 |
| Canvas App에서 직접 호출 | 커스텀 커넥터 필요 |
| 특수한 KQL 쿼리 구조 | 커스텀 커넥터 권장 |
| PCF 컴포넌트 연동 | 커스텀 커넥터 필요 |

---

## 🔗 참고 문서

- [inventory-api.md](file:///Users/seojeonglee/power-platform/power-platform/admin/inventory-api.md) - Inventory API 공식 문서
- [governance-components.md](file:///Users/seojeonglee/power-platform/power-platform/guidance/coe/governance-components.md) - CoE Starter Kit 거버넌스 컴포넌트
- [Power Platform for Admins V2](https://learn.microsoft.com/connectors/powerplatformforadmins/) - 기본 Admin 커넥터

---

## ✅ 체크리스트

- [ ] Entra ID 앱 등록 완료
- [ ] Client ID / Tenant ID / Secret 기록
- [ ] API 권한 추가 및 관리자 동의
- [ ] (선택) 커스텀 커넥터 생성 및 테스트
- [ ] Power Automate 연결 테스트
