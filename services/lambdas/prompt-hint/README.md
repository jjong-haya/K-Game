# prompt-hint Lambda

## 역할

`prompt-hint`는 오늘의 단어 플레이 중 사용자가 막혔을 때, 현재 추측 상태를 보고 **짧은 AI 힌트**를 생성하는 Lambda입니다.

## 왜 따로 분리했는가

- 힌트 생성은 질문 판정/응답과 프롬프트 목적이 다릅니다.
- 같은 함수에 묶으면 실시간 질문 응답과 힌트 개선 작업이 섞입니다.
- 힌트 품질을 따로 조정하거나 교체하기 쉽게 분리했습니다.

## 입력 / 출력 개요

- 입력
  - `operation: "ai_hint"`
  - `requestKind`
  - `answer`
  - `category`
  - `highestGuess`
  - `hintUsageState`
  - `previousHints`
- 출력
  - `message`
  - `category`
  - `proximityScore`

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

- `prompt-hint.zip`

## AWS에 올리는 방법

```powershell
.\infra\scripts\deploy-lambdas.ps1 `
  -FunctionName "<PROMPT_HINT_FUNCTION_NAME>" `
  -LambdaDir "services/lambdas/prompt-hint" `
  -Region "ap-northeast-2"
```

또는 콘솔에서 `prompt-hint.zip`을 직접 업로드하면 됩니다.

## 배포 전 체크

- `AWS_REGION`
- `BEDROCK_MODEL_ID`
- Bedrock 호출 권한
- 로컬 테스트 통과
- 입력 payload 형식 확인
