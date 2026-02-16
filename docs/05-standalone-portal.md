# 5. Standalone Portal 개발 가이드

Next.js와 FastAPI를 사용하여 구축하는 **독립형 CoE 거버넌스 포털**입니다.
PCF 제약 없이 자유롭게 UI를 구성하고, 로컬에서 빠르게 미리보기를 실행할 수 있습니다.

---

## 🏗️ 아키텍처

- **Frontend**: Next.js 14 (App Router) + Tailwind CSS
- **Backend**: FastAPI (Python)
- **Data Source**: Power Platform Inventory API

---

## 🚀 미리보기 실행 (Quick Start)

준비된 스크립트를 사용하여 환경을 설정하세요.

```bash
# 1. 설정 스크립트 실행
chmod +x setup-portal.sh
./setup-portal.sh

# 2. 백엔드 실행 (Terminal 1)
cd portal-app/backend
source venv/bin/activate
uvicorn main:app --reload
# http://localhost:8000/docs 에서 API 문서 확인 가능

# 3. 프론트엔드 실행 (Terminal 2)
cd portal-app/frontend
npm run dev -- -p 3001
# http://localhost:3001 에서 포털 접속
```

---

## 🔧 Backend (FastAPI)

`portal-app/backend/main.py`

- `/api/resources`: Inventory API를 호출하여 요약 정보를 반환
- 인증: Client Credentials Flow (서버 간 인증) 사용
- `.env` 파일에 `CLIENT_ID`, `CLIENT_SECRET`, `TENANT_ID` 설정 필요

---

## 🎨 Frontend (Next.js)

`portal-app/frontend/app/page.tsx`

- **Dashboard**: 리소스 현황 요약 카드
- **Tree View**: 계층형 리소스 트리 (Fluent UI 스타일)
- **Backend 연동**: `fetch('/api/resources')`로 데이터 조회
- **Mock Mode**: 백엔드 연결 실패 시 자동 Mock 데이터 표시 기능 내장

---

## 💡 활용 팁

이 독립형 포털은 **PCF 컴포넌트 개발 전 프로토타이핑**에 매우 유용합니다.
- 복잡한 KQL 쿼리를 백엔드에서 테스트
- UI/UX를 빠르게 개선
- 승인된 디자인을 나중에 PCF로 이식하거나, 그대로 웹앱으로 배포
