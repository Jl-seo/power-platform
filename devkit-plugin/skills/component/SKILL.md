---
name: component
description: |
  *"별점 부품 만들어줘"*, *"색상 선택 부품"*, *"드래그 정렬 부품"*처럼 재사용
  가능한 화면 부품(custom component) 의도가 감지되면 자동 발동.
  PCF 표준(manifest + index.ts) 형식의 스캐폴드를 생성하고, 사용자가 원하면
  Power Platform CLI(pac)로 빌드·배포까지 진행한다.
user-invocable: false
disable-model-invocation: false
allowed-tools:
  - Read
  - Write
  - Bash
  - mcp__devkit-ir-service__patch_ir
---

# component — 재사용 화면 부품 만들기 (PCF 표준)

## 흐름

1. 사용자 의도에서 부품 이름과 입력/출력 속성을 추정 + 모호한 부분은 `clarify`로 1~2개 질문.
2. `components/<id>/` 아래 파일 생성:
   - `manifest.xml` (속성·이벤트 메타)
   - `index.ts` (init / updateView / getOutputs / destroy 라이프사이클)
   - `ControlManifest.Input.xml`
   - `style.css`
   - `strings/ko.resx`(다국어 한국어)
   - `preview.png` (자리만, 이후 실제 캡처)
3. IR `components` 배열에 등록.
4. (선택) Power Platform CLI(`pac`) 설치돼 있으면 `pac pcf push`로 빌드·배포까지 한 번에. 미설치면 설치 가이드 한 줄 안내.
5. 사내 컴포넌트 화이트리스트 등록은 관리자(Admin Console) 승인 필요 — 자동 알림.

## pac CLI 자동 실행

```bash
if command -v pac >/dev/null 2>&1; then
  cd "components/<id>"
  pac pcf push --publisher-prefix "<사내 prefix>"
else
  echo "pac CLI 미설치 — 설치 가이드: https://aka.ms/PowerPlatformCLI"
fi
```

미설치 시 사용자에게: *"부품 파일은 만들었어요. 실서비스에 올리려면 Power Platform CLI 설치가 필요해요."*

## 사용자 화면 용어 정책

`${CLAUDE_PLUGIN_ROOT}/references/glossary.md`. *PCF / manifest / lifecycle / publisher prefix* 같은 단어 노출 금지. *부품 / 메타 / 라이프사이클(생성-갱신-종료)* 정도로 풀어 쓴다.

## 출력 메시지 (사용자에게 보여줄 말)

```
🧩 화면 부품 만들었어요: <부품 이름>

미리보기:
  • 받는 값: <input 속성 한 줄로>
  • 내보내는 값: <output 한 줄로>

사내 카탈로그에 올리려면 관리자 승인이 필요해요. 신청 알림을 보냈어요.
실서비스 배포는 다음 명령으로:
  cd components/<id> && pac pcf push --publisher-prefix <prefix>
```
