# K-Game

K-Game은 `Daily Word`와 `Prompt Room`을 중심으로 한 AWS 기반 웹서비스입니다.  
이 저장소는 GitHub 공개와 과제 제출을 모두 고려해 `apps`, `services`, `infra`, `docs`, `.github` 구조로 정리되어 있습니다.

## 구조

- `apps/web`: 프론트엔드
- `services/api`: Express API
- `services/lambdas`: Lambda 작업 단위
- `infra/scripts`: 배포 및 운영 스크립트
- `infra/terraform`: AWS IaC 골격
- `docs`: 아키텍처, 배포, 보안, 발표 문서
- `.github`: CI, PR 템플릿, Issue 템플릿

## 바로 읽을 문서

- [프로젝트 개요](./docs/project-overview.md)
- [아키텍처](./docs/architecture.md)
- [아키텍처 FAQ](./docs/architecture-faq.md)
- [인증 정책](./docs/auth-policy.md)
- [API 명세](./docs/api-spec.md)
- [배포 가이드](./docs/deployment.md)
- [보안 체크리스트](./docs/security-checklist.md)
- [문제 해결](./docs/troubleshooting.md)
- [발표 데모 스크립트](./docs/demo-script.md)
- [저장소 가이드](./docs/repository-guide.md)

## 기술 스택

| 영역 | 기술 |
| --- | --- |
| Frontend | React |
| Backend | Node.js, Express, MySQL |
| AI Runtime | AWS Lambda |
| Infra | S3, CloudFront, ALB, EC2, RDS, IAM, CloudWatch |

## 실행

### Frontend

```bash
npm --prefix ./apps/web install
npm --prefix ./apps/web start
```

### API

```bash
npm --prefix ./services/api install
npm --prefix ./services/api start
```

### Lambda

```bash
npm --prefix ./services/lambdas/prompt-engine install
npm --prefix ./services/lambdas/prompt-engine test
```

## 환경 변수 예시

- `apps/web/.env.example`
- `services/api/.env.example`
- `infra/terraform/terraform.tfvars.example`

## 공개 기준

- 실제 `.env`, 로그, zip, build 산출물은 Git 추적 대상에서 제외합니다.
- 문서와 워크플로우는 GitHub 공개 기준으로 유지합니다.
- 세부 설명은 `docs/`를 따릅니다.
