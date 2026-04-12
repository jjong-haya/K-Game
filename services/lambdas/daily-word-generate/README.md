# daily-word-generate Lambda

## 역할

`daily-word-generate`는 **오늘의 단어를 자동 생성해서 RDS에 저장하는 전용 Lambda**입니다.

이 함수는 두 경로를 모두 지원하도록 설계했습니다.

- `EventBridge`가 매일 정해진 시간에 자동 호출
- 관리자 페이지에서 “자동 생성 / 다시 생성” 버튼으로 수동 호출

## 왜 새 Lambda를 만들었는가

가장 큰 고민은 아래 두 선택지였습니다.

1. 기존 `prompt-engine`에 operation을 더 붙인다.
2. `daily-word-generate`를 별도 Lambda로 만든다.

최종적으로는 **2번**을 선택했습니다.

이유는 아래와 같습니다.

- `prompt-engine`은 실시간 질문 응답용 Lambda입니다.
- `daily-word-generate`는 배치성 작업이고, RDS 저장 책임까지 가집니다.
- 두 책임을 한 함수에 넣으면 실시간 Lambda가 무거워지고 설명도 어려워집니다.
- `EventBridge -> Lambda -> RDS` 흐름을 명확히 보여주는 편이 운영 설명과 과제 발표 모두에 유리합니다.

즉, 이 Lambda는 “서버리스로 분리 가능한 배치 작업”을 따로 떼어낸 결과입니다.

## 이 Lambda가 하는 일

1. 날짜와 카테고리를 확정합니다.
2. Bedrock에 오늘의 단어/힌트/동의어 생성을 요청합니다.
3. 같은 날짜 데이터가 이미 있는지 확인합니다.
4. `overwrite` 정책에 따라 재사용, 충돌, 덮어쓰기를 결정합니다.
5. `daily_word_challenges`에 INSERT 또는 UPDATE 합니다.
6. `daily_word_synonyms`를 교체합니다.
7. 필요하면 `daily_word_ai_hints`, `participants`를 비워 진행 데이터를 정리합니다.

## RDS와 왜 직접 연결했는가

이 Lambda는 단순히 텍스트만 생성하는 함수가 아니라, **매일 자동 생성 배치를 끝까지 완료하는 함수**로 두고 싶었습니다.

그래서 아래 구조를 선택했습니다.

- EventBridge가 함수 호출
- Lambda가 AI 생성
- Lambda가 RDS 저장

이 구조 덕분에 “서버리스로 가능한 부분은 최대한 서버리스로 뺐다”는 설명이 가능합니다.

## 입력 / 출력 개요

- 입력
  - `operation: "daily_word_generate"`
  - `challengeDate`
  - `overwrite`
  - `categoryId` 또는 `categorySlug`
  - `difficulty` (선택)
  - `extraInstruction` (선택)

- 출력
  - `ok`
  - `challengeDate`
  - `created`
  - `reused`
  - `category`
  - `challenge`

## 압축해서 올릴 파일

- `src/`
- `tests/`
- `package.json`
- `package-lock.json`
- `README.md`
- `node_modules/`

## zip 생성 방법

```bash
npm install
npm run check
npm test
npm run zip
```

생성 결과:

- `daily-word-generate.zip`

## AWS에 올리는 방법

### 방법 1. PowerShell 스크립트 사용

```powershell
.\infra\scripts\deploy-lambdas.ps1 `
  -FunctionName "<DAILY_WORD_GENERATE_FUNCTION_NAME>" `
  -LambdaDir "services/lambdas/daily-word-generate" `
  -Region "ap-northeast-2"
```

### 방법 2. 콘솔에서 직접 업로드

1. Lambda 함수 생성
2. 런타임을 Node.js로 선택
3. `daily-word-generate.zip` 업로드
4. 환경변수 입력
5. 필요한 IAM/VPC 설정 확인 후 Deploy

## 배포 전 체크

- `AWS_REGION`
- `APP_TIMEZONE`
- `BEDROCK_MODEL_ID`
- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- Bedrock 호출 권한
- RDS 접근 권한 / 네트워크 연결

## 환경변수 예시

- [.env.example](./.env.example)

## 주의사항

- 날짜 중복 생성은 서비스 계층에서 다시 읽어 복구하도록 설계되어 있어도, 운영에서는 스케줄과 관리자 수동 실행 정책을 함께 정리하는 편이 좋습니다.
- 이 Lambda를 RDS에 붙이려면 VPC, 보안그룹, 자격증명 설정이 필요합니다.
- 프로덕션에서는 EventBridge 스케줄과 함께 쓰고, 관리자 버튼에서는 같은 Lambda를 재사용하는 구조를 권장합니다.
