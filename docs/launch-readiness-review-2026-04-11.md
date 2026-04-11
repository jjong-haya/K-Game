# K-Game 출시 전 점검 리포트

작성일: 2026-04-11

## 1. 평가 요약

현재 프로젝트는 "기능 시연이 가능한 과제 수준"은 이미 넘어섰지만, "GitHub 공개와 AWS 운영을 자신 있게 설명할 수 있는 출시 직전 수준"으로 보려면 아직 큰 보완이 필요하다.

가장 좋은 점은 다음 세 가지다.

1. 프론트, 백엔드, Lambda, 배포 스크립트가 역할 단위로 나뉘어 있다.
2. 서버, 프론트, 주요 Lambda 테스트가 실제로 통과한다.
3. 루트 문서가 학생 프로젝트 평균보다 풍부하다.

가장 큰 위험은 다음 세 가지다.

1. 실제 비밀정보가 담긴 `.env`와 배포 자산이 작업 폴더에 존재해 GitHub 공개 위험이 매우 높다.
2. AWS 보안 구성은 설명은 있으나 IaC와 정책 증빙이 없어 심사자가 "정말 그렇게 구성했는가"를 물으면 방어가 약하다.
3. 프론트 핵심 로그인 흐름에 실제 클릭 버그가 있고, 백엔드는 단일 대형 파일 구조라 유지보수성과 신뢰도를 깎는다.

## 2. 핵심 검증 결과

- `server`: 테스트 통과
- `client`: 테스트 통과
- `game-lambda`, `game-lambda-hint`, `word-judge-lambda`, `word-reply-lambda`: 테스트 통과
- `client`: 빌드 성공, 경고 1건
- `server`: `npm audit --omit=dev` 기준 고위험 취약점 포함
- `client`: CRA 기반 의존성에서 취약점 다수 확인

## 3. 세부 리뷰

### 3.1 AWS 아키텍처

#### 현재 상태

- S3 배포 스크립트와 EC2 배포 스크립트, Lambda 업데이트 스크립트가 있다.
- `deploy/README_AWS.md`에 수동 배포 절차 설명이 있다.
- 서버는 Lambda Function URL 또는 Lambda 호출을 함께 사용하는 흔적이 있다.
- RDS 스키마 적용 스크립트가 존재한다.

#### 문제점

1. Terraform, CDK, CloudFormation 같은 IaC가 없다.
2. S3 공개 범위, CloudFront OAC/OAI, ACM, WAF, Route53, CloudWatch Alarm, 백업 정책이 코드로 증명되지 않는다.
3. `deploy/nginx.prompt-duel.conf`는 HTTPS가 기본 적용 상태가 아니다.
4. `deploy/apply-rds.ps1`가 샘플 시드까지 자동 적용한다.
5. Lambda 비밀정보 관리가 Secrets Manager/Parameter Store가 아니라 `.env` 중심이다.
6. `game-lambda` 문서상 역할과 실제 구현이 맞지 않는다.

#### 왜 문제인지

- 과제 심사자는 "동작한다"보다 "왜 그렇게 설계했는가"와 "재현 가능하게 설명 가능한가"를 본다.
- IaC가 없으면 보안 그룹, 서브넷, IAM 최소 권한, RDS 퍼블릭 여부를 입증하기 어렵다.
- HTTPS 기본 비활성, 샘플 데이터 자동 반영, 공개 Function URL 의존은 실무 기준에서 감점 요인이다.

#### 개선 방법

1. `infra/` 폴더를 만들고 최소한 다음을 IaC로 선언한다.
   - S3 + CloudFront + ACM
   - EC2 Security Group
   - RDS subnet group / private subnet
   - Lambda IAM role
   - CloudWatch log group / alarm
2. 정적 호스팅은 `S3 private + CloudFront OAC`로 고정하고, S3 public website hosting은 발표용 실험이 아니라면 제거한다.
3. EC2는 `80/443`만 외부 공개하고, 관리용 포트는 Bastion 또는 SSM Session Manager로 대체한다.
4. RDS는 퍼블릭 접근을 끄고, EC2/Lambda에서만 접근 가능하게 보안 그룹을 분리한다.
5. Lambda 비밀값은 `AWS Secrets Manager` 또는 `SSM Parameter Store`로 옮기고, 서버 `.env`는 로컬 개발 전용으로 축소한다.
6. `deploy/apply-rds.ps1`를 `schema-only`와 `seed-dev-only`로 분리한다.
7. `nginx` 설정은 HTTPS 리다이렉트, HSTS, 보안 헤더 기본 적용형으로 교체한다.

#### 우선순위

- 상: 비밀값 관리, HTTPS 기본화, RDS 시드 분리
- 중: CloudFront/OAC/WAF/모니터링
- 중: IaC 도입

### 3.2 보안

#### 현재 상태

- `.gitignore`는 기본적인 `.env`, `node_modules`, `build`, `zip`, 로그 일부를 제외한다.
- 서버는 인증 토큰 해싱 로직을 사용한다.
- 프론트에서 위험한 `dangerouslySetInnerHTML` 사용은 보이지 않았다.

#### 문제점

1. `server/.env`, `client/.env`, `deploy/lambda-artifacts/*.env`가 실제로 존재한다.
2. 프론트 소스의 약관/개인정보 페이지에 개인 연락처 정보가 직접 들어 있다.
3. 프론트 세션이 `localStorage`/`sessionStorage`에 저장된다.
4. 서버에 `helmet`, `x-powered-by` 비활성, 표준 404 처리 강화가 부족하다.
5. `server/scripts/seed-accounts.js`에 고정 개발 계정/약한 비밀번호가 있다.
6. Function URL, 관리자 시크릿, DB 비밀번호, 외부 API 키 관리가 문서와 실제 운영 흔적 사이에 어긋난다.

#### 왜 문제인지

- GitHub 공개 전 가장 큰 사고는 비밀정보 유출과 개인 정보 노출이다.
- 브라우저 저장소 세션은 XSS가 한 번만 생겨도 탈취될 수 있다.
- 보안 미들웨어가 부족하면 기본 방어선이 약하다.
- 약한 개발 계정은 나중에 운영 환경으로 흘러들어갈 위험이 있다.

#### 개선 방법

1. 아래 파일은 즉시 저장소에서 제거하고 새 키로 교체한다.
   - `server/.env`
   - `client/.env`
   - `deploy/lambda-artifacts/*.env`
2. 루트에 `.env.example`과 `server/.env.example`, `client/.env.example`을 따로 두고, 실제 값 대신 변수 이름과 설명만 남긴다.
3. 프론트 세션은 `httpOnly + Secure + SameSite=Lax 또는 Strict` 쿠키 기반으로 전환한다.
4. 서버에 `helmet`을 추가하고 `app.disable('x-powered-by')`를 적용한다.
5. 관리자 비밀값은 `.env` 문자열 비교보다 서버 측 권한 테이블 또는 별도 role 검증으로 이동한다.
6. 개인 연락처는 프로젝트 전용 메일로 교체하고 휴대전화 번호는 제거한다.
7. `seed-accounts.js`는 기본 계정 비활성화 또는 환경별 플래그 뒤로 숨긴다.
8. Dependabot 또는 주기적 `npm audit` 점검 방식을 문서화한다.

#### 우선순위

- 상: `.env` 제거 및 키 재발급
- 상: 개인정보 제거
- 상: 세션 저장 방식 개선
- 중: `helmet`, 권한 검증 구조 정비

### 3.3 백엔드

#### 현재 상태

- Express API가 인증, 게임, 관리자, 제안 기능을 모두 제공한다.
- MySQL 기반 스키마, 마이그레이션, 테스트가 있다.
- Lambda 호출을 서버에서 중계하는 구조가 있다.

#### 문제점

1. `server/src/app.js`가 지나치게 크고 책임이 많다.
2. 구식 Express 체인으로 `npm audit` 취약점이 남아 있다.
3. 에러 응답 체계가 통일돼 있지 않고, 일부 Lambda는 실패해도 HTTP 200을 돌려준다.
4. 소셜 로그인 닉네임 보완 흐름에 도달 불가능하거나 어색한 분기가 있다.
5. 클라이언트가 모델 선택값을 보내면 서버가 이를 받아 처리하는 구조가 남아 있다.
6. 일부 설정/모듈이 실제 사용과 어긋나거나 레거시 흔적이 남아 있다.

#### 왜 문제인지

- 대형 단일 파일은 작은 변경도 리스크가 커지고 리뷰가 어려워진다.
- 에러 포맷이 일관되지 않으면 프론트 UX와 운영 모니터링 둘 다 나빠진다.
- 클라이언트 입력에 모델 선택을 맡기면 정책 통제가 어려워진다.

#### 개선 방법

1. `server/src/app.js`를 아래처럼 분리한다.
   - `routes/authRoutes.js`
   - `routes/wordRoutes.js`
   - `routes/adminRoutes.js`
   - `routes/proposalRoutes.js`
   - `services/wordService.js`
   - `services/authService.js`
2. `express@4.21.x` 이상으로 올리고 회귀 테스트를 다시 돌린다.
3. 에러 응답은 `{ code, message, details? }` 형태로 통일하고, Lambda도 실패 시 4xx/5xx를 정확히 반환한다.
4. 모델 선택은 서버 정책으로 고정하거나 관리자/실험 플래그로 제한한다.
5. 인증 로직에서 죽은 분기와 레거시 모듈을 제거한다.
6. `server/README.md`에 환경 변수 표, API 목록, 실행 순서, 마이그레이션 순서를 넣는다.

#### 우선순위

- 상: Express 업그레이드, 에러 응답 통일
- 상: `app.js` 분리
- 중: 인증 분기 정리, 레거시 코드 제거

### 3.4 프론트엔드 / UIUX

#### 현재 상태

- React SPA 구조가 비교적 명확하다.
- 인증, 게임, 제안, 관리자 화면이 분리돼 있다.
- 오늘의 단어 화면은 꽤 완성도 있게 구성돼 있다.

#### 문제점

1. 로그인 첫 화면에서 `게스트로 시작` 버튼 클릭이 접힌 패널 헤더에 막히는 실사용 버그가 있다.
2. 포커스 표시가 사라지는 입력 필드가 여럿 있다.
3. 홈 화면은 API 실패를 빈 상태처럼 숨긴다.
4. 타이틀/브랜드 불일치와 유휴 코드가 남아 있다.
5. CRA 기반 도구 체인으로 프론트 의존성 취약점이 많다.
6. 핵심 사용자 흐름을 보장하는 e2e 테스트가 없다.

#### 왜 문제인지

- 첫 클릭에서 막히는 서비스는 평가 시연에서 바로 감점된다.
- 접근성은 단순 배려 차원이 아니라 입력 오류와 이탈률 문제다.
- 실패를 숨기는 UI는 "서비스가 불안정하다"는 인상을 준다.
- 브랜딩 불일치와 죽은 코드는 정리되지 않은 프로젝트라는 신호다.

#### 개선 방법

1. 로그인 아코디언은 접힌 패널을 `display:none` 또는 unmount 방식으로 바꾸고 `pointer-events:none`을 보강한다.
2. 공통 버튼/필드에 `focus-visible` 스타일을 통일한다.
3. 홈 화면에 `loading`, `error`, `empty`를 분리한다.
4. `public/index.html` 제목과 서비스 명칭을 `K-Game`으로 통일한다.
5. 사용하지 않는 페이지/함수/토큰 유틸을 정리한다.
6. Playwright로 다음 흐름 smoke test를 추가한다.
   - 홈 진입
   - 게스트 로그인
   - 오늘의 단어 입장
   - 질문 제출
   - 프로필 이동
7. 가능하면 CRA에서 Vite로 이전하거나, 최소한 현재 잔존 취약점과 이유를 문서에 적는다.

#### 우선순위

- 상: 로그인 클릭 버그
- 중: 접근성, 실패 상태 UI
- 중: e2e smoke test
- 중: CRA 정비 또는 이전 계획

### 3.5 데이터베이스

#### 현재 상태

- MySQL 스키마, 마이그레이션, 시드가 분리돼 있다.
- 외래키, 유니크 키, 일부 인덱스가 존재한다.

#### 문제점

1. `schema.sql`과 일부 마이그레이션이 중복되며 이력 관리가 혼란스럽다.
2. 여러 상태 컬럼이 문자열 자유 입력 형태라 데이터 무결성이 약하다.
3. DB 연결 설정에서 TLS/SSL 정책이 코드에서 명확하지 않다.
4. 개발/테스트/운영 데이터 분리 원칙이 배포 스크립트에서 약하다.
5. 백업/복구 계획이 코드와 문서에서 충분히 드러나지 않는다.

#### 왜 문제인지

- 과제 평가에서도 DB는 "잘 돌아간다"보다 "정확하고 통제 가능한가"를 본다.
- 스키마 중복은 운영 중 혼선을 만든다.
- 상태값 자유도는 잘못된 데이터 누적 위험을 높인다.

#### 개선 방법

1. 스키마 기준을 하나로 정한다.
   - 새 환경은 `schema.sql`
   - 운영 변경은 `migrations/`
   - 중복 정의는 정리
2. 상태 컬럼은 `ENUM` 또는 `CHECK`로 제한한다.
3. 자주 조회되는 랭킹/히스토리/제안 목록은 실행 계획을 확인해 복합 인덱스를 검토한다.
4. 운영 DB에는 샘플 시드를 절대 자동 반영하지 않도록 스크립트를 분리한다.
5. `docs/deployment.md` 또는 `docs/architecture.md`에 백업/복구 전략을 명시한다.

#### 우선순위

- 상: 운영 시드 분리
- 중: 스키마/마이그레이션 정리
- 중: 제약조건 강화

### 3.6 GitHub / 문서화

#### 현재 상태

- 루트 문서는 평균 이상으로 많다.
- 인증 정책, 아키텍처 FAQ, 프로젝트 설명 문서가 이미 있다.

#### 문제점

1. 현재 작업 폴더는 Git 저장소가 아니어서 커밋 품질, 브랜치 전략을 확인할 수 없다.
2. 로컬 절대 경로 링크가 문서에 섞여 있어 GitHub에서 깨질 가능성이 크다.
3. 산출물, 로그, 임시 폴더, zip 파일이 루트와 하위 폴더에 남아 있다.
4. `docs/` 중심 구조가 아니라 루트에 문서가 퍼져 있다.
5. `frontend/README`, `backend/README`, `infra/README`, `docs/*` 형태의 발표 친화적 문서 체계가 부족하다.

#### 왜 문제인지

- GitHub 저장소는 코드뿐 아니라 "관리 능력"을 보여주는 포트폴리오다.
- 폴더가 지저분하면 설계가 좋아도 완성도가 낮아 보인다.
- 문서가 흩어져 있으면 심사자가 필요한 정보를 빠르게 찾기 어렵다.

#### 개선 방법

1. `docs/` 폴더를 중심으로 아래 문서를 재배치한다.
   - `docs/architecture.md`
   - `docs/api-spec.md`
   - `docs/deployment.md`
   - `docs/troubleshooting.md`
   - `docs/security-checklist.md`
   - `docs/demo-script.md`
2. `client/README.md`, `server/README.md`, `deploy/README.md`를 각각 실행/구조 중심으로 확장한다.
3. 루트 `.gitignore`를 강화한다.
   - `.playwright-cli/`
   - `deploy/lambda-artifacts/*.env`
   - `*.zip`
   - `*.log`
4. GitHub 공개 전 루트에서 산출물과 개인 흔적을 제거한다.
5. 가능하면 `.github/workflows`에 최소 CI를 추가한다.

#### 우선순위

- 상: 비밀파일/산출물 제거
- 상: 문서 재구성
- 중: CI, 이슈/PR 템플릿

## 4. GitHub 공개 전 체크리스트

### 반드시 수정

- [ ] `server/.env` 제거 후 키 재발급
- [ ] `client/.env` 제거 후 공개 가능한 값만 예제 파일로 분리
- [ ] `deploy/lambda-artifacts/*.env` 제거
- [ ] 개인 연락처가 들어간 약관/개인정보 페이지 수정
- [ ] 로그인 CTA 클릭 버그 수정
- [ ] `npm audit` 고위험 항목 대응 계획 작성
- [ ] `deploy/apply-rds.ps1`의 샘플 시드 자동 반영 제거
- [ ] 문서의 로컬 절대 경로 링크 정리

### 공개해도 되는 항목

- [ ] 구조 설명 문서
- [ ] 스키마 설명서
- [ ] 테스트 코드
- [ ] 배포 절차서에서 비밀값이 제거된 일반 절차

### 삭제 / 마스킹 / 이동 필요

- [ ] `*.zip` 배포 산출물
- [ ] `.runlogs/`, `.runshots/`, `.playwright-cli/`
- [ ] `client/build/`
- [ ] 실행 로그 파일
- [ ] 개인 식별 정보가 포함된 문구
- [ ] 레거시 Lambda가 현재 구조를 혼란스럽게 만들면 `archive/` 또는 별도 브랜치로 이동

## 5. 문서화 보강안

### 필요한 문서

- `README.md`
- `client/README.md`
- `server/README.md`
- `deploy/README.md`
- `docs/architecture.md`
- `docs/api-spec.md`
- `docs/deployment.md`
- `docs/troubleshooting.md`
- `docs/security-checklist.md`
- `docs/demo-script.md`

### 각 문서 목차 예시

#### `README.md`

1. 프로젝트 한 줄 소개
2. 문제 정의와 서비스 목표
3. 주요 기능
4. 기술 스택과 선택 이유
5. 아키텍처 다이어그램
6. 빠른 실행 방법
7. 문서 링크 모음
8. 데모 계정 정책 또는 테스트 가이드

#### `client/README.md`

1. 프론트 역할
2. 라우트 구조
3. 인증 흐름
4. 환경 변수 표
5. 로컬 실행
6. 빌드 및 배포 방식
7. 상태 관리 전략
8. 테스트 방법

#### `server/README.md`

1. 서버 역할
2. API 도메인 구조
3. 환경 변수 표
4. DB 연결 구조
5. Lambda 연동 구조
6. 로컬 실행
7. 마이그레이션/시드 전략
8. 에러 응답 규약
9. 테스트 방법

#### `deploy/README.md`

1. 배포 대상 리소스
2. S3/CloudFront 배포
3. EC2 배포
4. Lambda 배포
5. RDS 마이그레이션
6. 롤백 절차
7. 운영 점검 체크리스트

#### `docs/architecture.md`

1. 시스템 개요
2. 요청 흐름
3. 서비스별 책임
4. AWS 리소스 구성
5. 보안 경계
6. 확장 포인트
7. 현재 한계와 향후 개선

#### `docs/api-spec.md`

1. 인증 API
2. 오늘의 단어 API
3. 프롬프트 룸 API
4. 제안 API
5. 관리자 API
6. 공통 에러 응답
7. 예시 요청/응답

#### `docs/deployment.md`

1. 환경 구분
2. 필수 AWS 리소스
3. 배포 순서
4. 환경 변수/비밀값 주입 방식
5. 헬스체크
6. 롤백
7. 백업/복구

#### `docs/troubleshooting.md`

1. 로그인 실패
2. Lambda 호출 실패
3. RDS 연결 실패
4. CORS 오류
5. S3/CloudFront 캐시 문제
6. 배포 후 헬스체크 실패

#### `docs/security-checklist.md`

1. 비밀정보 관리
2. IAM 최소 권한
3. 네트워크 접근 제어
4. CORS/HTTPS
5. 로그/모니터링
6. 개인정보 보호
7. 공개 저장소 점검 항목

#### `docs/demo-script.md`

1. 발표 1분 요약
2. 데모 시나리오
3. 기능 시연 순서
4. 예상 질문 대응 포인트
5. 장애 대비 플랜 B

## 6. 점수표

| 항목 | 점수(10) | 평가 |
| --- | --- | --- |
| 아키텍처 | 6.5 | 구조 개념은 좋지만 증빙과 일관성이 부족 |
| 보안 | 3.5 | 실제 비밀정보와 공개 전 위생 상태가 위험 |
| 코드 구조 | 6.0 | 작동은 하나 핵심 파일 비대화가 큼 |
| UI/UX | 6.0 | 방향성은 좋지만 첫 진입 버그와 상태 처리 약점 존재 |
| 문서화 | 7.0 | 문서 양은 좋으나 구조화와 공개 적합성이 부족 |
| 배포 준비도 | 5.5 | 스크립트는 있으나 운영 보안/복구 설계가 약함 |
| 과제 제출 완성도 | 6.5 | 설명 자료는 좋지만 정리 부족으로 감점 여지 큼 |

총점: `41 / 70`

한 줄 총평: "설계 의도와 기능 시연은 분명하지만, 공개 저장소 위생과 AWS 운영 보안 증빙이 부족해 실무형 완성도로는 아직 미흡하다."

## 7. 최종 액션 플랜

### 지금 당장 해야 할 일 TOP 10

1. 모든 실제 `.env`와 민감정보 파일 제거 후 키 재발급
2. 로그인 클릭 버그 수정
3. 개인 연락처 정보 제거 또는 프로젝트 메일로 교체
4. `deploy/apply-rds.ps1`에서 샘플 시드 자동 적용 제거
5. `express` 업그레이드 및 `helmet` 적용
6. Lambda 실패 시 HTTP 200 고정 반환 제거
7. 문서의 깨지는 로컬 절대 경로 링크 정리
8. 산출물/로그/zip 파일 정리
9. 루트 README를 발표형 구조로 재정리
10. 최소한의 e2e smoke test 추가

### 1일 안에 가능한 수정

- `.env.example` 체계 도입
- `.gitignore` 강화
- 로그인 화면 접힘 구조 수정
- 홈 화면 `loading/error/empty` 상태 분리
- `public/index.html` 브랜드 통일
- `server/README.md`, `client/README.md` 확장
- `npm audit` 고위험 항목 대응

### 3일 안에 가능한 수정

- `server/src/app.js` 라우트/서비스 분리
- 문서 `docs/` 재구성
- Lambda 호출 정책 정리
- Secrets Manager 또는 SSM Parameter Store 연동
- RDS 스키마/마이그레이션 중복 정리
- Playwright smoke test와 CI 추가

### 발표 전 반드시 해야 할 수정

- "왜 이 AWS 구성을 선택했는가"를 다이어그램과 함께 설명 가능하게 만들기
- 보안 체크리스트 문서화
- 배포/롤백/장애 대응 절차 문서화
- 공개 저장소에 불필요한 파일이 없도록 최종 점검
- 문서와 실제 코드가 어긋나는 부분 제거

## 8. 교수님 / 심사자가 물을 가능성이 높은 질문 15개

1. 왜 S3만 쓰지 않고 EC2와 Lambda를 같이 썼나요?
2. 왜 RDS를 선택했고, DynamoDB가 아니라 MySQL을 쓴 이유는 무엇인가요?
3. 인증은 왜 Supabase와 자체 세션을 혼합했나요?
4. Lambda Function URL을 썼다면 보안은 어떻게 보장하나요?
5. 정적 파일은 왜 CloudFront를 앞단에 두어야 하나요?
6. RDS를 퍼블릭으로 열지 않았다면 애플리케이션은 어떻게 접근하나요?
7. IAM 최소 권한은 어떻게 설계했나요?
8. 비밀값은 어디에 저장하고 누가 접근할 수 있나요?
9. 장애가 나면 어떻게 롤백하나요?
10. AI 응답 품질 문제나 정답 노출은 어떻게 막나요?
11. 왜 프론트 세션을 현재 방식으로 저장했고, 더 안전한 대안은 무엇인가요?
12. API 에러를 어떤 규칙으로 프론트에 전달하나요?
13. 배포 자동화가 부족한데 운영 실수를 어떻게 줄일 건가요?
14. 로그와 모니터링은 어떤 방식으로 보강할 건가요?
15. 이 구조가 사용자가 늘어났을 때 어떻게 확장되나요?

## 9. 모범 답변 방향

- 모든 답변은 "현재 상태", "왜 그렇게 했는지", "한계", "다음 개선 계획" 4단 구조로 답하면 좋다.
- 예시:
  - "현재는 과제 범위 안에서 EC2에 Express API를 두고, AI 추론 비용과 기능 경계를 분리하기 위해 Lambda를 병행했습니다."
  - "다만 공개 운영 기준으로는 Function URL 노출과 비밀값 관리가 약해, 다음 단계에서는 API Gateway 또는 IAM invoke, Secrets Manager, CloudFront를 적용할 계획입니다."
  - "RDS는 관계형 데이터와 랭킹, 제안 승인 흐름이 있어 트랜잭션과 조인이 쉬운 MySQL을 선택했습니다."
  - "세션은 현재 브라우저 저장소 기반이지만, 실무 보안 수준으로는 `httpOnly` 쿠키로 옮겨야 한다는 점을 인지하고 있습니다."

## 10. 더 있어 보이게 만드는 포인트

1. 루트 README 첫 화면에 아키텍처 다이어그램 1장
2. AWS 리소스별 역할표 1장
3. 요청 흐름도 1장
4. 보안 체크리스트 문서 1장
5. 데모 스크립트와 예상 질문 답변 문서
6. GitHub Actions 배지와 테스트 통과 배지
7. `docs/` 중심 문서 목차
8. 환경 변수 표와 샘플 파일
9. 롤백 절차와 운영 체크리스트
10. 현재 한계와 향후 개선 계획을 솔직하게 적은 섹션
