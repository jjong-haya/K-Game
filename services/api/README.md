# API Service

`services/api`는 K-Game의 중앙 API 서버입니다.

## 역할

- 인증과 세션 쿠키 발급, 사용자 권한 검증
- `Daily Word`, `Prompt Room`, `Proposal`, `Admin` API 제공
- MySQL 읽기/쓰기와 게임 상태 조립
- AWS Lambda 호출 어댑터 제공

## 실행

```bash
npm install
npm run migrate
npm start
```

## 주요 구조

- `src/app`
  - Express 앱 조립과 공통 설정
- `src/routes`
  - 도메인별 라우트 등록
- `src/modules`
  - 인증, 게임, 공통 도메인 로직
- `src/integrations`
  - AWS Lambda와 외부 서비스 연동
- `src/db`
  - DB 연결 진입점
- `sql`
  - 스키마와 초기 데이터

## 환경 변수

- 서버/공통
  - `PORT`
  - `CORS_ORIGIN`
  - `APP_TIMEZONE`
- DB
  - `DB_HOST`
  - `DB_PORT`
  - `DB_USER`
  - `DB_PASSWORD`
  - `DB_NAME`
- 관리자/인증
  - `ADMIN_EMAILS`
  - `ADMIN_USER_IDS`
  - `SUPABASE_URL`
  - `GUEST_SESSION_HOURS`
  - `APP_SESSION_DAYS`
  - `AUTH_COOKIE_NAME`
  - `AUTH_COOKIE_SECURE`
  - `AUTH_COOKIE_SAMESITE`
- Lambda
  - `GAME_LAMBDA_NOVA_FUNCTION_NAME`
  - `GAME_LAMBDA_NOVA_URL`
  - `GAME_LAMBDA_REGION`
  - `WORD_HINT_FUNCTION_NAME`
  - `WORD_HINT_URL`
  - `WORD_HINT_REGION`
  - `DAILY_WORD_GENERATE_FUNCTION_NAME`
  - `DAILY_WORD_GENERATE_URL`
  - `DAILY_WORD_GENERATE_REGION`
  - `GAME_LAMBDA_GEMINI_FUNCTION_NAME`
  - `GAME_LAMBDA_GEMINI_URL`

예시는 [.env.example](./.env.example)를 참고하면 됩니다.

## 검증

```bash
npm run check
npm test
```

## 개발용 시드 계정

고정 아이디와 비밀번호는 코드에 포함하지 않습니다. 계정 시드는 명시적으로 활성화해야만 실행됩니다.

```bash
ENABLE_ACCOUNT_SEED=1 \
SEED_TEST_USERNAME=testuser \
SEED_TEST_PASSWORD=change-me \
SEED_ADMIN_USERNAME=admin \
SEED_ADMIN_PASSWORD=change-me \
npm run seed:accounts
```

운영 환경에서는 이 스크립트를 사용하지 않는 것을 기본 원칙으로 둡니다.
