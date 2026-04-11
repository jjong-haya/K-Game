# word-judge Lambda

이 Lambda는 플레이어의 질문을 보고 O/X/? 판정과 안전한 보조 컨텍스트를 생성합니다.

## 구조

- `src/index.js`: 질문 판정, 응답 정규화, 정답 노출 방지
- `tests/index.test.js`: 판정 계약과 마스킹 테스트

## 지원 operation

- `word_judge`

## 실행

```bash
npm install
npm run check
npm test
```

## 배포 패키지

```bash
powershell Compress-Archive -Path src,tests,package.json,package-lock.json,README.md,node_modules -DestinationPath word-judge.zip -Force
```

## 환경 변수

```bash
AWS_REGION=ap-northeast-2
BEDROCK_MODEL_ID=amazon.nova-lite-v1:0
```
