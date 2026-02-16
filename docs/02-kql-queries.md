# 2. Power Platform Inventory API KQL 쿼리 가이드

Power Platform 리소스를 조회하기 위한 KQL 쿼리 예제 모음입니다.

> 📖 **참고**: [inventory-api.md](file:///Users/seojeonglee/power-platform/power-platform/admin/inventory-api.md)

---

## API 엔드포인트

```http
POST https://api.powerplatform.com/resourcequery/resources/query?api-version=2024-10-01
Authorization: Bearer <access_token>
Content-Type: application/json
```

---

## 지원 리소스 타입

| 리소스 | type 값 |
|--------|---------|
| Canvas Apps | `microsoft.powerapps/canvasapps` |
| Model-Driven Apps | `microsoft.powerapps/modeldrivenapps` |
| Cloud Flows | `microsoft.powerautomate/cloudflows` |
| Copilot Agents | `microsoft.copilotstudio/agents` |
| Agent Flows | `microsoft.powerautomate/agentflows` |
| Code Apps (Vibe) | `microsoft.powerapps/codeapps` |
| Environments | `microsoft.powerplatform/environments` |

---

## 쿼리 예제

### 1. 전체 리소스 수 조회

```json
{
  "TableName": "PowerPlatformResources",
  "Clauses": [
    { "$type": "count" }
  ]
}
```

### 2. 리소스 타입별 개수 집계

```json
{
  "TableName": "PowerPlatformResources",
  "Clauses": [
    {
      "$type": "summarize",
      "SummarizeClauseExpression": {
        "OperatorName": "count",
        "OperatorFieldName": "resourceCount",
        "FieldList": ["type", "location"]
      }
    },
    {
      "$type": "orderby",
      "FieldNamesAscDesc": { "resourceCount": "desc" }
    }
  ]
}
```

### 3. 환경별 리소스 분포

```json
{
  "TableName": "PowerPlatformResources",
  "Clauses": [
    {
      "$type": "extend",
      "FieldName": "environmentId",
      "Expression": "tostring(properties.environmentId)"
    },
    {
      "$type": "summarize",
      "SummarizeClauseExpression": {
        "OperatorName": "count",
        "OperatorFieldName": "resourceCount",
        "FieldList": ["environmentId"]
      }
    },
    {
      "$type": "orderby",
      "FieldNamesAscDesc": { "resourceCount": "desc" }
    }
  ]
}
```

### 4. 최근 7일 내 생성된 리소스

```json
{
  "TableName": "PowerPlatformResources",
  "Clauses": [
    {
      "$type": "extend",
      "FieldName": "createdAt",
      "Expression": "todatetime(properties.createdAt)"
    },
    {
      "$type": "where",
      "FieldName": "createdAt",
      "Operator": ">=",
      "Values": ["ago(7d)"]
    },
    {
      "$type": "project",
      "FieldList": [
        "name", "type",
        "properties.displayName",
        "properties.environmentId",
        "properties.ownerId",
        "properties.createdAt"
      ]
    },
    {
      "$type": "orderby",
      "FieldNamesAscDesc": { "createdAt": "desc" }
    }
  ]
}
```

### 5. 특정 사용자 소유 리소스 조회

```json
{
  "TableName": "PowerPlatformResources",
  "Clauses": [
    {
      "$type": "extend",
      "FieldName": "ownerId",
      "Expression": "tostring(properties.ownerId)"
    },
    {
      "$type": "where",
      "FieldName": "ownerId",
      "Operator": "==",
      "Values": ["<USER-OBJECT-ID>"]
    },
    {
      "$type": "project",
      "FieldList": [
        "name", "type",
        "properties.displayName",
        "properties.environmentId",
        "properties.createdAt"
      ]
    }
  ]
}
```

### 6. Canvas Apps + 환경 정보 JOIN (PPAC 기본 패턴)

```json
{
  "Options": { "Top": 1000, "Skip": 0 },
  "TableName": "PowerPlatformResources",
  "Clauses": [
    {
      "$type": "extend",
      "FieldName": "joinKey",
      "Expression": "tolower(tostring(properties.environmentId))"
    },
    {
      "$type": "join",
      "JoinKind": "leftouter",
      "RightTable": {
        "TableName": "PowerPlatformResources",
        "Clauses": [
          {
            "$type": "where",
            "FieldName": "type",
            "Operator": "==",
            "Values": ["'microsoft.powerplatform/environments'"]
          },
          {
            "$type": "project",
            "FieldList": [
              "joinKey = tolower(name)",
              "environmentName = properties.displayName",
              "environmentType = properties.environmentType"
            ]
          }
        ]
      },
      "LeftColumnName": "joinKey",
      "RightColumnName": "joinKey"
    },
    {
      "$type": "where",
      "FieldName": "type",
      "Operator": "in~",
      "Values": [
        "'microsoft.powerapps/canvasapps'",
        "'microsoft.powerapps/modeldrivenapps'",
        "'microsoft.powerautomate/cloudflows'",
        "'microsoft.copilotstudio/agents'"
      ]
    }
  ]
}
```

---

## Power Apps에서 응답 파싱

### ClearCollect 패턴

```powerfx
ClearCollect(
    colResources,
    ForAll(
        Table(ParseJSON(InventoryConnector.QueryResources(varQueryBody).data)),
        {
            Name: Text(ThisRecord.name),
            Type: Text(ThisRecord.type),
            DisplayName: Text(ThisRecord.properties.displayName),
            EnvironmentId: Text(ThisRecord.properties.environmentId),
            CreatedAt: DateTimeValue(ThisRecord.properties.createdAt)
        }
    )
)
```

---

## 응답 형식

```json
{
  "totalRecords": 1250,
  "count": 50,
  "resultTruncated": 1,
  "skipToken": "...",
  "data": [
    {
      "name": "app-guid",
      "type": "microsoft.powerapps/canvasapps",
      "properties": {
        "displayName": "My App",
        "environmentId": "env-guid",
        "ownerId": "user-guid",
        "createdAt": "2026-01-15T10:30:00Z"
      }
    }
  ]
}
```

---

## ✅ 활용 시나리오

| 시나리오 | 권장 쿼리 |
|----------|----------|
| 거버넌스 대시보드 | 예제 2, 3 (집계) |
| 신규 리소스 모니터링 | 예제 4 |
| 퇴사자 리소스 정리 | 예제 5 |
| 상세 리소스 목록 | 예제 6 (JOIN) |
