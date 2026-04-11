# 배포 가이드

## 배포 대상

- `infra/scripts/deploy-web.ps1`
- `infra/scripts/deploy-lambdas.ps1`
- `infra/scripts/apply-db-schema.ps1`
- `infra/scripts/apply-db-dev-seed.ps1`
- `infra/scripts/deploy-api.sh`
- `infra/scripts/health-check.sh`
- `infra/scripts/rollback-api.sh`

## 순서

1. Terraform 예시 값을 확인합니다.
2. DB schema를 먼저 적용합니다.
3. API를 배포하고 헬스체크를 확인합니다.
4. Lambda를 개별 단위로 업로드합니다.
5. Frontend를 S3에 업로드합니다.

## 운영 원칙

- schema와 dev seed는 분리합니다.
- 운영 비밀값은 Git에 올리지 않습니다.
- 실패 시 롤백 경로를 문서와 스크립트에 함께 둡니다.

## 검증 포인트

- `GET /api/health` 응답 확인
- CloudFront에서 프론트 열림 확인
- ALB에서 API 라우팅 확인
- RDS가 private 기준으로만 접근되는지 확인
