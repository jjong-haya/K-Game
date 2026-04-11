# prompt-hint Lambda

이 Lambda는 현재 문제의 정답을 직접 노출하지 않으면서, 플레이어가 더 가까워지도록 힌트를 생성합니다.

## 구조

- `src/index.js`: 힌트 생성, 정답 마스킹, 응답 정규화
- `tests/index.test.js`: 마스킹과 힌트 계약 테스트

## 지원 operation

- `ai_hint`
- `similarity_feedback`

## 실행

```bash
npm install
npm run check
npm test
```

## 배포 패키지

```bash
powershell Compress-Archive -Path src,tests,package.json,package-lock.json,README.md,node_modules -DestinationPath prompt-hint.zip -Force
```

## 환경 변수

```bash
AWS_REGION=ap-northeast-2
BEDROCK_MODEL_ID=amazon.nova-lite-v1:0
```
