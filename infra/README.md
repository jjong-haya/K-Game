# Infrastructure

`infra/`는 배포 스크립트와 Terraform 기반 AWS 구성을 모아 둔 폴더입니다.

## 구성

- `scripts/`
  - 웹 배포, API 배포, Lambda 패키징, DB 적용, 헬스체크, 롤백
- `terraform/`
  - S3, CloudFront, ALB, EC2, RDS, IAM, CloudWatch 선언

## 문서

- [스크립트 안내](./scripts/README.md)
- [Terraform 안내](./terraform/README.md)

## 원칙

- 운영 비밀값은 Git에 커밋하지 않습니다.
- DB 운영 반영과 개발 시드 반영은 분리합니다.
- 배포 스크립트는 현재 저장소 구조(`apps/web`, `services/api`, `services/lambdas`)를 기준으로 작성합니다.
