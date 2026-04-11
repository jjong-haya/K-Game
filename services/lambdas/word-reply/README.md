# word-reply Lambda

이 Lambda는 `word_judge` 결과를 받아 UI에 보여줄 최종 문장과 감정 상태를 생성합니다.

## 구조

- `src/index.js`: 응답 생성, 감정 상태 정규화, 안전한 문자열 보정
- `tests/index.test.js`: 응답 계약과 빈 입력 실패 테스트

## 지원 operation

- `word_reply`

## 실행

```bash
npm install
npm run check
npm test
```

## 배포 패키지

```bash
powershell Compress-Archive -Path src,tests,package.json,package-lock.json,README.md,node_modules -DestinationPath word-reply.zip -Force
```

## 환경 변수

```bash
AWS_REGION=ap-northeast-2
BEDROCK_MODEL_ID=amazon.nova-lite-v1:0
```
