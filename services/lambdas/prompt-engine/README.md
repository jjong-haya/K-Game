# prompt-engine Lambda

## 개요

`prompt-engine`은 한국어 스무고개 게임에서 질문 1개를 받아 한 번에 판정과 캐릭터 응답을 생성하는 Lambda입니다.

현재 이 Lambda는 `question_answer`를 **단일 단계(single-step)** 로 처리합니다.  
예전처럼 판정과 캐릭터 반응을 2단계로 나누지 않고, 한 번의 모델 호출로 아래 정보를 모두 만듭니다.

- `verdict`
- `chatReply`
- `characterLine`
- `innerThought`
- `emotion`

추가로 `raw_prompt_lab` operation도 유지하고 있어서, AI Lab 페이지에서 프롬프트를 그대로 보내는 테스트 용도로 계속 사용할 수 있습니다.

## 핵심 원칙

이 Lambda의 `question_answer` 프롬프트는 코드 안에 **고정 문자열로 들어 있습니다**.

- 프롬프트 문구 자체는 임의로 바꾸지 않습니다.
- 서버가 매 요청마다 바꿔 넣는 값은 `hiddenAnswer`, `userQuestion` 두 개뿐입니다.
- 카테고리, 힌트, 보조 문장 등을 프롬프트에 추가하지 않습니다.

즉, 실제 요청 시 아래 두 값만 주입됩니다.

- `hiddenAnswer`
- `userQuestion`

## 질문 판정 흐름

`question_answer`는 아래 순서로 동작합니다.

1. 서버가 `hiddenAnswer`와 `userQuestion`을 Lambda에 전달합니다.
2. Lambda는 고정 프롬프트 템플릿에 두 값만 주입해 Bedrock에 보냅니다.
3. 모델은 반드시 JSON만 반환해야 합니다.
4. Lambda는 응답 JSON을 파싱하고 최소 필드 검증을 합니다.
5. 서버는 `chatReply`, `characterLine`, `innerThought` 안에 정답이 섞였는지 다시 검사합니다.
6. 정답 누출이 감지되면 서버가 같은 Lambda를 다시 호출합니다.

중요한 점은, **정답 누출 재시도 책임은 서버에 있고 Lambda는 결과 생성과 형식 검증에 집중한다**는 점입니다.

## 지원 operation

### 1. `question_answer`

질문 1개를 판정하고 캐릭터 응답까지 한 번에 생성합니다.

요청 payload:

```json
{
  "operation": "question_answer",
  "hiddenAnswer": "오토스케일링",
  "userQuestion": "먹을 수 있는 거야?"
}
```

응답 payload:

```json
{
  "ok": true,
  "operation": "question_answer",
  "date": "2026-04-13",
  "chatReply": "아니, 그건 아냐. 아직 한참 멀었어.",
  "characterLine": "진짜 맞춰보려고 애쓰네. 😅",
  "innerThought": "아직 정답과는 거리가 많이 멀다.",
  "verdict": "X",
  "emotion": "🙄",
  "message": "아니, 그건 아냐. 아직 한참 멀었어.",
  "friendReply": "진짜 맞춰보려고 애쓰네. 😅",
  "tag": "X",
  "answer": "X",
  "reactionLine": "진짜 맞춰보려고 애쓰네. 😅",
  "reactionEmoji": "🙄"
}
```

설명:

- `chatReply`, `characterLine`, `innerThought`, `verdict`, `emotion`이 현재 주 응답입니다.
- `message`, `friendReply`, `tag`, `answer`, `reactionLine`, `reactionEmoji`는 서버의 기존 호환성을 위해 같이 내려갑니다.

### 2. `raw_prompt_lab`

입력 프롬프트를 가공 없이 그대로 Bedrock에 전달하고, 결과 텍스트를 그대로 돌려줍니다.

요청 payload:

```json
{
  "operation": "raw_prompt_lab",
  "input": "이 프롬프트를 그대로 보내"
}
```

응답 payload:

```json
{
  "ok": true,
  "operation": "raw_prompt_lab",
  "date": "2026-04-13",
  "output": "모델이 반환한 원문"
}
```

## 프롬프트 관리 원칙

`question_answer` 프롬프트는 [src/index.js](./src/index.js)에 있는 `QUESTION_PROMPT_TEMPLATE`를 사용합니다.

이 프롬프트는 다음 전제를 갖습니다.

- 한국어 스무고개 게임용이다.
- `hiddenAnswer`와 `userQuestion`이 그대로 들어간다.
- 판정 결과는 `O`, `X`, `?` 중 하나다.
- 답을 직접 말하거나 힌트를 흘리면 안 된다.
- JSON 외의 텍스트를 출력하면 안 된다.

프롬프트를 바꿔야 할 일이 있더라도, 서버 쪽 보정 대신 여기의 템플릿을 직접 수정해야 합니다.

## 서버와의 역할 분리

이 Lambda와 API 서버의 책임은 아래처럼 나뉩니다.

### Lambda 책임

- 고정 프롬프트 구성
- Bedrock 호출
- JSON 파싱
- 최소 필드 검증
- HTTP/Lambda 공용 응답 래핑

### API 서버 책임

- `hiddenAnswer`, `userQuestion` 전달
- 정답 누출 감지
- 정답이 응답 텍스트에 포함되면 재호출
- 기존 UI 저장 포맷(`friendReply`, avatar reaction 등)과의 호환 유지

## 파일 구조

- `index.js`
  - 루트 shim 파일
  - `src/index.js`를 Lambda handler 진입점으로 연결합니다.
- `src/index.js`
  - 실제 Lambda 구현
- `tests/index.test.js`
  - 프롬프트 주입, 출력 정규화, 기본 핸들러 테스트
- `package.json`
  - check/test/zip 스크립트 정의

## 배포에 포함해야 하는 파일

이 Lambda는 ZIP 루트에 아래 파일이 들어가야 합니다.

- `index.js`
- `src/`
- `tests/`
- `package.json`
- `package-lock.json`
- `README.md`
- `node_modules/`

특히 AWS Lambda Handler가 `index.handler`라면, **ZIP 루트의 `index.js`가 반드시 포함되어야 합니다.**

이 파일이 빠지면 CloudWatch에 아래와 비슷한 에러가 납니다.

```text
Runtime.ImportModuleError: Error: Cannot find module 'index'
```

## 로컬 확인

```bash
npm install
npm run check
npm test
```

ZIP 생성:

```bash
npm run zip
```

생성 결과:

- `prompt-engine.zip`

## AWS 업로드

### 방법 1. 스크립트 사용

```powershell
.\infra\scripts\deploy-lambdas.ps1 `
  -FunctionName "<PROMPT_ENGINE_FUNCTION_NAME>" `
  -LambdaDir "services/lambdas/prompt-engine" `
  -Region "us-east-1"
```

### 방법 2. 콘솔 업로드

1. AWS Lambda 콘솔에서 대상 함수 선택
2. `Upload from -> .zip file`
3. `prompt-engine.zip` 업로드
4. Handler가 `index.handler`인지 확인
5. Deploy

## 필수 환경 변수

- `AWS_REGION`
- `BEDROCK_MODEL_ID`

기본 모델 ID는 코드에서 `amazon.nova-lite-v1:0`를 사용합니다.

## 테스트 포인트

배포 후 최소한 아래를 확인하는 것을 권장합니다.

1. `question_answer` 호출 시 JSON 형식이 깨지지 않는지
2. `chatReply`, `characterLine`, `innerThought`가 모두 오는지
3. `verdict`가 `O`, `X`, `?` 중 하나인지
4. 정답이 응답 텍스트에 그대로 노출되지 않는지
5. `raw_prompt_lab`가 여전히 동작하는지

## 참고

- 구현 파일: [src/index.js](./src/index.js)
- 테스트 파일: [tests/index.test.js](./tests/index.test.js)
- 예시 환경 변수: [.env.example](./.env.example)
