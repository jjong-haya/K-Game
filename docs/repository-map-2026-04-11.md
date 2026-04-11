# K-Game Repository Map

작성일: 2026-04-11

## 1. 범위

이 문서는 `K-Game` 저장소의 실제 폴더 구조를 기준으로, 과제 제출과 GitHub 공개를 염두에 두고 다음을 정리한다.

- 어떤 폴더가 어떤 역할을 하는지
- 프론트엔드, 백엔드, Lambda, 배포 스크립트, 문서가 어떻게 연결되는지
- 어떤 파일이 핵심 실행 경로를 구성하는지
- 어떤 파일이 산출물, 임시 로그, 레거시 자산인지

`node_modules`, 빌드 결과물, 압축 파일, 로그 파일처럼 생성물 성격이 강한 항목은 전부 나열하지 않고 핵심 구조 위주로 정리한다.

## 2. 최상위 구조

| 경로 | 역할 | 상태 |
| --- | --- | --- |
| `client/` | React 기반 프론트엔드 | 핵심 |
| `server/` | Express 기반 API 서버 | 핵심 |
| `game-lambda/` | 게임용 AWS Lambda | 핵심이지만 문서-구현 불일치 있음 |
| `game-lambda-hint/` | 힌트 생성용 AWS Lambda | 핵심 |
| `word-judge-lambda/` | 단어 판정용 AWS Lambda | 핵심 |
| `word-reply-lambda/` | 단어 응답 생성용 AWS Lambda | 핵심 |
| `deploy/` | AWS 배포 및 운영 스크립트 | 핵심 |
| `bedrock-lambda/` | 초기/레거시 Lambda 계열 | 레거시 가능성 높음 |
| `gemini-lambda/` | 초기/레거시 Lambda 계열 | 레거시 가능성 높음 |
| `README.md` | 루트 프로젝트 소개 문서 | 있음 |
| `PROJECT_DOCUMENTATION_KO.md` | 전체 프로젝트 설명 문서 | 있음 |
| `ARCHITECTURE_FAQ_KO.md` | 발표/설계 질문 대응 문서 | 있음 |
| `AUTH_POLICY_KO.md` | 인증 정책 정리 문서 | 있음 |
| `DropTable.md` | 운영 문서라기보다 위험한 작업 메모 성격 | 정리 필요 |
| `game-lambda.zip` | 배포 산출물 압축본 | GitHub 공개 대상에서 제외 권장 |
| `.runlogs/`, `.runshots/`, `.playwright-cli/` | 로컬 실행/검증 흔적 | 공개용 저장소에서 제거 권장 |

## 3. 서비스 연결 구조

### 3.1 런타임 아키텍처

1. 사용자는 `client/`에서 빌드된 React 정적 파일에 접속한다.
2. 프론트엔드는 `client/src/lib/api.js`를 통해 `server/`의 REST API를 호출한다.
3. `server/`는 다음 역할을 담당한다.
   - 회원가입/로그인/소셜 로그인 세션 발급
   - 오늘의 단어, 프롬프트 룸, 제안, 관리자 기능 API 제공
   - RDS(MySQL) 읽기/쓰기
   - 필요 시 AWS Lambda 호출
4. Lambda들은 AI 판정, 응답 생성, 힌트 생성 같은 비동기성/외부 모델 호출 로직을 담당한다.
5. 배포 스크립트는 클라이언트 정적 파일을 S3에 배포하고, 서버를 EC2에 배포하며, Lambda 코드를 업데이트한다.

### 3.2 논리 연결도

```text
Browser
  -> client (React SPA)
     -> server (Express API on EC2)
        -> RDS MySQL
        -> AWS Lambda Function URL / Lambda Invoke
           -> external model provider

Deploy scripts
  -> S3 sync for client
  -> EC2 deploy for server
  -> Lambda zip update for AI functions
  -> SQL apply for RDS
```

## 4. 프론트엔드 구조

### 4.1 핵심 파일

| 파일 | 역할 | 주요 연동 |
| --- | --- | --- |
| `client/src/index.js` | 앱 진입점 | `App.js`, `AuthProvider.jsx`, `index.css` |
| `client/src/App.js` | 전체 라우팅 | `ProtectedRoute.jsx`, 각 페이지 컴포넌트 |
| `client/src/index.css` | 전역 스타일, 접힘 애니메이션, 공통 효과 | 모든 페이지 |
| `client/src/auth/AuthProvider.jsx` | 인증 상태의 중심 | `authStorage.js`, `supabaseOAuth.js`, `lib/api.js` |
| `client/src/auth/authStorage.js` | 세션/PKCE/OAuth 보조 상태 저장 | 브라우저 `localStorage`, `sessionStorage` |
| `client/src/auth/supabaseOAuth.js` | Supabase OAuth 흐름 처리 | Supabase, `AuthProvider.jsx` |
| `client/src/lib/api.js` | 전체 API 호출 집합 | `server`의 `/api/*` |
| `client/src/components/AppShell.jsx` | 공통 레이아웃 | 인증 상태, 공통 내비게이션 |
| `client/src/components/ProtectedRoute.jsx` | 인증/권한 보호 | `useAuth()` |
| `client/src/pages/HomePage.jsx` | 랜딩 화면 | 랭킹 API |
| `client/src/pages/LoginPage.jsx` | 게스트, ID, Google, Apple 로그인 | 인증 API, Supabase OAuth |
| `client/src/pages/DailyWordPage.jsx` | 오늘의 단어 메인 화면 | `/api/word/daily*` |
| `client/src/pages/PromptRoomsPage.jsx` | 프롬프트 룸 목록/티저 | 서버 API 또는 준비 중 UI |
| `client/src/pages/PromptRoomPage.jsx` | 개별 프롬프트 룸 화면 | `/api/prompt-rooms/:roomId/*` |
| `client/src/pages/ProfilePage.jsx` | 프로필, 계정 연동, 관리자 이동 | 인증/프로필 API |
| `client/src/pages/ProposalPage.jsx` | 문제 제안 폼 | `/api/categories`, `/api/proposals` |
| `client/src/pages/AdminPage.jsx` | 관리자 승인/반려 | `/api/admin/proposals*` |
| `client/src/pages/TermsPage.jsx` | 이용약관 | 정적 문서 페이지 |
| `client/src/pages/PrivacyPage.jsx` | 개인정보 처리방침 | 정적 문서 페이지 |

### 4.2 프론트 설계 특징

- 전역 상태 관리는 사실상 인증에만 집중돼 있다.
- 데이터 캐싱 계층이 없어 각 페이지에서 `useEffect + useState`로 직접 API를 관리한다.
- `AuthProvider.jsx`, `LoginPage.jsx`, `DailyWordPage.jsx`가 비대해지며 책임이 많이 모여 있다.
- `ProtectedRoute`로 접근 제어가 분리돼 있는 점은 좋다.

## 5. 백엔드 구조

### 5.1 핵심 파일

| 파일 | 역할 | 주요 연동 |
| --- | --- | --- |
| `server/src/app.js` | 서버 진입점이자 거의 모든 라우트 정의 | `config.js`, `db.js`, `auth.js`, Lambda 호출 |
| `server/src/config.js` | 환경 변수 파싱 및 런타임 설정 | `.env`, 앱 전역 설정 |
| `server/src/db.js` | MySQL 풀 생성 및 DB 접근 유틸 | RDS MySQL |
| `server/src/auth.js` | 회원가입, 로그인, 소셜 로그인, 세션 검증 | DB, JWT/토큰, Supabase/OAuth 흐름 |
| `server/src/lambdaClient.js` | AWS Lambda 호출 래퍼 | `@aws-sdk/client-lambda` |
| `server/src/passwords.js` | 비밀번호 처리 보조 로직 | `auth.js` |
| `server/src/catalog.js` | 카테고리/단어/메타 성격의 보조 모듈 | 일부 라우트 |
| `server/sql/schema.sql` | 기본 스키마 정의 | MySQL |
| `server/sql/migrations/*.sql` | 점진적 스키마 변경 | MySQL |
| `server/sql/sample_seed.sql` | 샘플 데이터 | 개발용 |
| `server/scripts/seed-accounts.js` | 개발용 계정 생성 | MySQL |

### 5.2 백엔드 설계 특징

- `app.js`가 매우 크고, 인증/게임/관리자/제안/헬스체크가 한 파일에 밀집돼 있다.
- 설정은 `config.js`에 모였지만, 실제 환경 변수 계약이 문서와 완전히 맞아떨어지지 않는 부분이 있다.
- 인증은 자체 세션 토큰과 소셜 로그인 보조 흐름을 병행한다.
- DB 스키마는 외래키와 유니크 제약이 꽤 들어가 있으나, 상태 필드는 문자열 자유도가 높다.

## 6. Lambda 구조

### 6.1 현재 사용 중인 Lambda 후보

| 경로 | 역할 | 연동 |
| --- | --- | --- |
| `game-lambda/index.js` | 게임 AI 응답 처리 | 서버 또는 Function URL |
| `game-lambda-hint/index.js` | 힌트 응답 처리 | 서버 또는 Function URL |
| `word-judge-lambda/index.js` | 단어 판정 | 서버 또는 Function URL |
| `word-reply-lambda/index.js` | 단어 응답 생성 | 서버 또는 Function URL |

### 6.2 레거시/정리 대상 후보

| 경로 | 역할 | 상태 |
| --- | --- | --- |
| `gemini-lambda/` | 초기 모델 연동 Lambda | 현재 핵심 경로와 분리 필요 |
| `bedrock-lambda/` | 초기 Bedrock 연동 Lambda | 현재 핵심 경로와 분리 필요 |

### 6.3 Lambda 설계 특징

- 각 Lambda가 비교적 독립적으로 테스트 파일을 가진 점은 좋다.
- 하지만 문서상 역할과 실제 구현이 맞지 않는 파일이 있어 아키텍처 신뢰도를 떨어뜨린다.
- 공개 Function URL에 의존하는 흔적이 보이며, IAM 기반 비공개 호출 구조가 문서/코드에서 명확히 입증되지 않는다.

## 7. 배포 구조

### 7.1 핵심 파일

| 파일 | 역할 | 주의점 |
| --- | --- | --- |
| `deploy/README_AWS.md` | AWS 수동 배포 절차 문서 | 설명은 있으나 IaC 부재 |
| `deploy/build-and-sync-client.ps1` | 클라이언트 빌드 후 S3 업로드 | S3 공개 정책 검증 없음 |
| `deploy/ec2-bootstrap.sh` | EC2 초기 설정 | 최소 수준 설정 |
| `deploy/ec2-deploy-server.sh` | EC2 서버 배포 | 서버 `.env` 전제 |
| `deploy/package-and-update-lambda.ps1` | Lambda zip 패키징 및 업로드 | 산출물 관리 주의 |
| `deploy/apply-rds.ps1` | RDS에 스키마와 시드 적용 | 샘플 데이터 자동 반영 위험 |
| `deploy/nginx.prompt-duel.conf` | Nginx 리버스 프록시 예시 | HTTPS가 기본 활성화 아님 |
| `deploy/lambda-artifacts/` | Lambda 배포 산출물 | GitHub 제외 필요 |

### 7.2 배포 설계 특징

- 수동 배포 절차는 존재한다.
- 그러나 Terraform, CDK, CloudFormation 같은 IaC가 없어서 실제 보안 구성이 재현 가능하게 증명되지 않는다.
- 비밀정보는 Secrets Manager/SSM보다 `.env` 중심 운영 흔적이 강하다.

## 8. 문서 구조

| 파일 | 역할 | 상태 |
| --- | --- | --- |
| `README.md` | 저장소 첫 인상과 실행 안내 | 있음 |
| `PROJECT_DOCUMENTATION_KO.md` | 전체 서비스 설명 | 비교적 충실 |
| `ARCHITECTURE_FAQ_KO.md` | 발표 질문 대비 | 유용 |
| `AUTH_POLICY_KO.md` | 인증 정책 설명 | 유용 |
| `deploy/README_AWS.md` | 배포 절차 | 있음 |
| `client/README.md` | 프론트 실행 방법 | 얕음 |
| `server/README.md` | 서버 실행 방법 | 얕음 |

현재는 문서가 루트에 많이 흩어져 있다. GitHub 공개용으로는 `docs/` 폴더에 역할별로 재정리하는 편이 훨씬 보기 좋다.

## 9. 위험 자산 분류

### 9.1 공개 저장소에서 제거해야 할 가능성이 큰 항목

- `server/.env`
- `client/.env`
- `deploy/lambda-artifacts/*.env`
- `*.zip` 배포 산출물
- `.runlogs/`, `.runshots/`, `.playwright-cli/`
- `client/build/`
- `client/client-run.log`, `server/server-run.log`

### 9.2 구조 신뢰도를 떨어뜨리는 항목

- 레거시 Lambda와 현재 Lambda가 같은 레벨에 섞여 있음
- 실행 산출물과 소스가 같은 루트에 혼재
- GitHub 기준으로 깨지는 로컬 절대 경로 링크가 문서에 존재
- 저장소 루트가 소스/문서/산출물/메모 파일이 한 번에 보여서 첫인상이 복잡함

## 10. 구조 평가 요약

### 강점

- 프론트, 서버, Lambda, 배포 스크립트가 기능 축별로 분리돼 있어 큰 그림은 이해 가능하다.
- 테스트가 프론트, 서버, 주요 Lambda에 어느 정도 존재한다.
- 문서화 의지는 강하며, 발표 대응용 문서까지 이미 있다.

### 취약점

- 현재 구조는 “배포 가능한 저장소”라기보다 “개발 흔적이 많이 남아 있는 작업 폴더”에 가깝다.
- 비밀정보, 배포 산출물, 레거시 자산, 운영 스크립트가 공개 저장소 관점으로 정리되지 않았다.
- 인프라 구조는 설명 문서는 있지만, 재현 가능한 코드와 보안 증빙은 부족하다.
