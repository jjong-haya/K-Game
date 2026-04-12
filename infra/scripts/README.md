# Deployment Scripts

이 폴더는 GitHub 공개용 monorepo 구조에 맞춰 배포 스크립트를 정리한 곳입니다.

## 파일 설명

- `deploy-web.ps1`
  - `apps/web/build` 결과물을 S3에 업로드할 때 사용
- `deploy-lambdas.ps1`
  - `services/lambdas/<service>` 폴더를 zip으로 묶고 Lambda 함수 코드로 업로드할 때 사용
- `apply-db-schema.ps1`
  - `services/api/sql/schema.sql`을 적용할 때 사용
- `apply-db-dev-seed.ps1`
  - 개발용 seed 데이터만 따로 넣을 때 사용
- `bootstrap-api.sh`
  - EC2 초기 세팅 스크립트
- `deploy-api.sh`
  - EC2 API 릴리스 배포 스크립트
- `rollback-api.sh`
  - 직전 릴리스로 롤백할 때 사용
- `health-check.sh`
  - API 헬스체크용
- `check-terraform.js`
  - Terraform 파일의 기본 구성을 빠르게 점검할 때 사용
- `nginx-api.conf`
  - Nginx 리버스 프록시 설정 예시

## Lambda 배포 공통 규칙

`deploy-lambdas.ps1`는 아래 파일만 zip에 포함합니다.

- `src/`
- `tests/`
- `index.js`, `index.mjs`, `index.cjs`가 Lambda 루트에 있을 경우 함께 포함
- `package.json`
- `package-lock.json`
- `README.md`
- `node_modules/`

현재 저장소에서 이 규칙을 바로 쓰는 활성 Lambda는 아래 세 개입니다.

- `services/lambdas/prompt-engine`
- `services/lambdas/prompt-hint`
- `services/lambdas/daily-word-generate`

예시:

```powershell
.\infra\scripts\deploy-lambdas.ps1 `
  -FunctionName "<PROMPT_ENGINE_FUNCTION_NAME>" `
  -LambdaDir "services/lambdas/prompt-engine" `
  -Region "us-east-1"
```

## 주의사항

- 실제 Lambda URL, 실제 함수명, 실제 비밀값은 Git에 넣지 않습니다.
- zip 파일은 로컬 배포 산출물이며 저장소에는 포함하지 않습니다.
- `prompt-engine`처럼 Handler가 `index.handler`인 함수는 ZIP 루트에 `index.js`가 반드시 들어가야 합니다.
- DB schema와 개발용 seed는 같은 단계에서 한 번에 적용하지 않는 것을 권장합니다.
