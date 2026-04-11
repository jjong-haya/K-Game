# prompt-engine Lambda

이 Lambda는 프롬프트 모드에서 Bedrock 기반으로 질문 판정과 캐릭터 반응을 생성합니다.

## 구조

- `src/index.js`: Lambda 핸들러와 Bedrock 호출, 응답 정규화
- `tests/index.test.js`: 마스킹과 응답 계약 테스트

## 지원 operation

- `question_answer`

## 실행

```bash
npm install
npm run check
npm test
```

## 배포 패키지

```bash
powershell Compress-Archive -Path src,tests,package.json,package-lock.json,README.md,node_modules -DestinationPath prompt-engine.zip -Force
```

## 환경 변수

```bash
AWS_REGION=ap-northeast-2
BEDROCK_MODEL_ID=amazon.nova-lite-v1:0
```
