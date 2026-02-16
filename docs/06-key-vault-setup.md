# 6. Azure Key Vault 보안 설정 가이드

Client Secret을 안전하게 관리하기 위해 Azure Key Vault를 연동합니다.

---

## 🔐 Key Vault 생성 및 설정

### 1. 리소스 생성

1. Azure Portal → **Key Vaults** 검색 → **+ 만들기**
2. **리소스 그룹**: 기존 그룹 선택 또는 생성
3. **Key Vault 이름**: `kv-coe-portal-dev` (고유한 이름)
4. **가격 책정 계층**: 표준 (Standard)
5. **검토 및 만들기**

### 2. 시크릿(Secret) 등록

생성된 Key Vault → **비밀(Secrets)** → **+ 생성/가져오기**

| 이름 | 값 | 설명 |
|------|----|------|
| `TENANT-ID` | `xxxxxxxx-xxxx...` | Directory ID |
| `CLIENT-ID` | `xxxxxxxx-xxxx...` | Application ID |
| `CLIENT-SECRET` | `~xxxxxxxxx...` | Client Secret 값 |

---

## 🤝 액세스 정책 설정 (Access Policy)

Entra ID 앱(Service Principal)이 Key Vault를 읽을 수 있도록 권한을 부여해야 합니다.

1. Key Vault → **액세스 정책** (또는 RBAC)
2. **+ 액세스 정책 만들기**
3. **권한**:
   - 비밀 권한(Secret Permissions): **가져오기(Get)**, **나열(List)**
4. **보안 주체 선택**:
   - `PowerPlatform-CoE-Portal` (등록한 앱 이름 검색)
5. **추가** 및 **저장**

> **로컬 개발자 접근**: 본인 계정(개발자)도 동일하게 `Get`, `List` 권한을 추가해야 로컬에서 `DefaultAzureCredential`로 접근 가능합니다.

---

## 💻 Backend 설정

`portal-app/backend/.env` 파일을 수정하여 Key Vault URL만 남깁니다.

```bash
# Key Vault URL (필수)
KEY_VAULT_URL=https://kv-coe-portal-dev.vault.azure.net/

# 로컬 개발용 Fallback (Key Vault 연동 전까지만 사용)
# TENANT_ID=...
# CLIENT_ID=...
# CLIENT_SECRET=...
```

### 작동 원리 (`DefaultAzureCredential`)

1. **배포 환경**: Managed Identity를 자동으로 감지하여 인증
2. **로컬 환경**: Visual Studio Code, Azure CLI (`az login`), 또는 환경 변수 통해 로그인된 개발자 계정 사용

---

## ✅ 체크리스트

- [ ] Azure Key Vault 생성 완료
- [ ] 시크릿 3개(`TENANT-ID`, `CLIENT-ID`, `CLIENT-SECRET`) 등록 완료
- [ ] 앱(`PowerPlatform-CoE-Portal`)에 `Get/List` 권한 부여
- [ ] 개발자 본인 계정에 `Get/List` 권한 부여
- [ ] 백엔드 `.env`에 `KEY_VAULT_URL` 설정
