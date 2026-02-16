# 3. Power Automate 관리자 Flow 설계 (Custom Build)

CoE Starter Kit 설치 없이, **필요한 기능만 가볍게 구현**하는 커스텀 Flow 설계 가이드입니다.

> 💡 **핵심 전략**: 무거운 데이터 동기화 Flow 대신 **Inventory API**를 사용하여 실시간으로 대상을 조회하고 액션을 수행합니다.

---

## 🎯 구현할 3가지 핵심 기능

| Flow | 목적 | 트리거 | 주요 액션 |
|------|------|--------|-----------|
| **앱 격리** | 보안 위협 앱 즉시 차단 | 캔버스 앱 (버튼) | `Set App Quarantine State` |
| **소유권 이전** | 퇴사자 리소스 정리 | 캔버스 앱 (버튼) | `Set App Owner` |
| **DLP 정책 수정** | 커넥터 차단/허용 변경 | 캔버스 앱 (버튼) | `Update Policy` |

---

## 🛠️ 공통 준비 사항

### 커넥터 연결
다음 커넥터들이 환경에 추가되어 있어야 합니다:
1. **Power Apps for Admins** (격리, 소유권 이전용)
2. **Power Platform for Admins V2** (DLP, Inventory 조회용)
3. **Office 365 Outlook** (알림 발송용)

---

## Flow 1: 앱 격리 (Quarantine App)

앱을 격리하면 사용자가 앱을 실행할 때 "사용할 수 없음" 메시지가 표시됩니다.

### Flow 설계
**이름**: `[Admin] Quarantine App`

```yaml
1. [Trigger] Power Apps (V2)
   - 입력: EnvironmentId (Text), AppId (Text), QuarantineState (Boolean), Reason (Text)

2. [Action] Set App Quarantine State (Power Apps for Admins)
   - Environment: @{triggerBody()['EnvironmentId']}
   - App: @{triggerBody()['AppId']}
   - Quarantine State: @{triggerBody()['QuarantineState']}

3. [Action] Get App Details (Power Apps for Admins)
   - Environment: @{triggerBody()['EnvironmentId']}
   - App: @{triggerBody()['AppId']}

4. [Condition] QuarantineState = true?
   - YES:
     - [Send Email] 소유자에게 "귀하의 앱이 격리되었습니다" 발송
     - 본문: 사유(@{triggerBody()['Reason']}) 포함
   - NO:
     - [Send Email] 소유자에게 "앱 격리가 해제되었습니다" 발송
```

---

## Flow 2: 퇴사자 앱 소유권 일괄 이전 (Transfer Ownership)

퇴사자의 모든 앱을 지정된 관리자(또는 새 담당자)에게 일괄 넘깁니다.

### Flow 설계
**이름**: `[Admin] Transfer All Apps`

```yaml
1. [Trigger] Power Apps (V2)
   - 입력: OldOwnerEmail (Text), NewOwnerObjectId (Text)

2. [Action] Query Resources (Power Platform for Admins V2)
   - 설명: Inventory API로 해당 소유자의 앱 목록만 빠르게 조회
   - Body:
     {
       "TableName": "PowerPlatformResources",
       "Clauses": [
         {
           "$type": "where",
           "FieldName": "properties.ownerEmail",
           "Operator": "==",
           "Values": ["@{triggerBody()['OldOwnerEmail']}"]
         },
         {
           "$type": "where",
           "FieldName": "type",
           "Operator": "==",
           "Values": ["'microsoft.powerapps/canvasapps'"]
         },
         {
           "$type": "project",
           "FieldList": ["name", "properties.displayName", "properties.environmentId"]
         }
       ]
     }

3. [Parse JSON] 위 응답 파싱

4. [Apply to each] 앱 목록 반복
   - [Action] Set App Owner (Power Apps for Admins)
     - Environment: @{items('Apply_to_each')?['properties.environmentId']}
     - App: @{items('Apply_to_each')?['name']}
     - Role: CanView (편집 권한)
     - New Owner: @{triggerBody()['NewOwnerObjectId']}

5. [Send Email] 실행 결과(이전된 앱 개수 등)를 관리자에게 발송
```

---

## Flow 3: DLP 정책 수정 (Modify DLP)

특정 커넥터를 Business(허용) 또는 Blocked(차단) 그룹으로 이동합니다.

### Flow 설계
**이름**: `[Admin] Update DLP Connector`

```yaml
1. [Trigger] Power Apps (V2)
   - 입력: PolicyId (Text), ConnectorId (Text), NewGroup (Text) 
     (예: 'Business', 'NonBusiness', 'Blocked')

2. [Action] Get DLP Policy (Power Platform for Admins V2)
   - Policy: @{triggerBody()['PolicyId']}

3. [Compose] 데이터 가공 (Modify JSON Logic)
   - 설명: 받아온 정책 JSON에서 `connectorGroups` 배열을 수정해야 합니다.
   - 팁: Power Automate의 표현식만으로는 복잡하므로, 
         Azure Functions를 호출하거나, 
         간단하게는 'Parse JSON' 후 조건문으로 배열을 재조립해야 합니다.
   - (간소화 버전): 특정 그룹에 커넥터 ID를 추가하는 API 호출

4. [Action] Update DLP Policy (Power Platform for Admins V2)
   - Policy: @{triggerBody()['PolicyId']}
   - Body: (수정된 정책 JSON)
```

> **Tip**: DLP 정책 수정은 JSON 조작이 까다롭습니다. 초기 버전에서는 **"정책 조회"** 기능만 먼저 구현하고, 수정은 Power Platform Admin Center 링크를 제공하는 것이 안전할 수 있습니다.

---

## ✅ 요약: 킷 없이 구현 시 장점

1. **가벼움**: 수천 개의 리소스를 매일 동기화하는 무거운 Flow가 필요 없습니다. Inventory API로 그때그때 조회합니다.
2. **커스텀 용이**: 우리 회사 로직(결재 프로세스 등)을 자유롭게 넣을 수 있습니다.
3. **비용 절감**: Dataverse 용량을 거의 차지하지 않습니다. (CoE Kit은 로그 데이터로 용량을 많이 씀)

