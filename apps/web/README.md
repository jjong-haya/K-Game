# Web App

`apps/web`는 K-Game의 프론트엔드입니다. Vite를 사용하고, 정적 빌드 결과물은 `build/`에 생성됩니다.

## 역할

- 로그인, 게스트 진입, 소셜 로그인, 닉네임 보완 흐름 제공
- Daily Word, Prompt Room, Profile, Proposal, Admin 화면 제공
- API 연동, 세션 쿠키 기반 사용자 상태 반영, 로딩/에러/빈 상태 표현

## 주요 폴더

- `src/app`
  - 라우팅 조립과 앱 수준 설정
- `src/features`
  - 화면별 기능과 상태 로직
- `src/components`
  - 공통 UI 컴포넌트
- `src/lib`
  - API 호출, 날짜 처리, 세션 관련 유틸
- `src/test`
  - Vitest 공통 설정

## 실행

```bash
npm install
npm start
```

## 환경 변수

- `VITE_API_BASE_URL`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SUPABASE_REDIRECT_URL`
- `VITE_TERMS_URL`
- `VITE_PRIVACY_POLICY_URL`

기존 `REACT_APP_*` 이름도 `vite.config.js`에서 호환 지원합니다. 예시는 [.env.example](./.env.example)를 참고하세요.

## 테스트와 빌드

```bash
npm test
npm run build
```

## 참고

- 개발 서버는 기본적으로 `0.0.0.0:3000`으로 열립니다.
- 브라우저 라우팅은 `BrowserRouter` 기반입니다.
- 빌드 출력 경로는 `vite.config.js`에서 `build`로 고정되어 있어 S3 배포 스크립트와 맞물립니다.
