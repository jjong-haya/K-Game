# Web App

`apps/web`는 K-Game의 프론트엔드입니다. CRA에서 Vite로 전환했고, 정적 빌드는 `build/`에 생성됩니다.

## 역할

- 로그인, 게스트 진입, 소셜 로그인, 닉네임 보완 흐름 제공
- Daily Word, Prompt Room, Profile, Proposal, Admin 화면 제공
- API 연동, 세션 쿠키, 로딩/에러/빈 상태 표현

## 주요 폴더

- `src/app`: 라우팅 조립
- `src/features`: 기능별 화면과 상태 로직
- `src/components`: 공통 UI 컴포넌트
- `src/lib`: API와 날짜/토큰 유틸
- `src/test`: Vitest 공통 설정

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

기존 `REACT_APP_*` 이름도 Vite 설정에서 호환 지원합니다. 예시는 [.env.example](./.env.example)를 참고하세요.

## 테스트와 빌드

```bash
npm test
npm run build
```

## 참고

- 브라우저 라우팅은 `BrowserRouter` 기반입니다.
- Tailwind는 `postcss.config.cjs` + `tailwind.config.js` 조합으로 동작합니다.
