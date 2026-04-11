# 프로젝트 개요

K-Game은 `Daily Word`와 `Prompt Room`을 중심으로 구성된 AWS 기반 웹서비스입니다.  
이 저장소는 GitHub 공개와 과제 제출을 모두 고려해 `apps / services / infra / docs / .github` 구조로 정리했습니다.

## 서비스 목표

- 사용자는 오늘의 단어를 맞히고, AI가 생성한 응답을 확인합니다.
- 사용자는 프롬프트 룸에서 제안과 토론 흐름을 경험합니다.
- 운영자는 Lambda, RDS, EC2, CloudFront, S3를 통해 서비스 흐름을 관리합니다.

## 폴더 역할

- `apps/web`: 사용자 화면과 브라우저 상태
- `services/api`: 인증, 비즈니스 로직, DB 연동, Lambda 호출
- `services/lambdas`: AI 작업 단위와 응답 생성 로직
- `infra/scripts`: 배포, DB 적용, 헬스체크, 롤백 스크립트
- `infra/terraform`: 핵심 AWS 인프라 선언
- `docs`: 아키텍처, 배포, 보안, 발표 자료
- `.github`: CI, PR 템플릿, Issue 템플릿

## 설계 원칙

1. 프론트는 S3 + CloudFront를 기본 진입점으로 둡니다.
2. API는 ALB 뒤 EC2에서 동작하도록 설명합니다.
3. RDS는 private subnet 기준으로 운영합니다.
4. AI 작업은 Lambda로 분리해 확장성과 책임 경계를 나눕니다.
5. 비밀값과 운영 정보는 문서와 코드에서 분리합니다.

## 현재 읽을 문서

- [아키텍처](./architecture.md)
- [아키텍처 FAQ](./architecture-faq.md)
- [인증 정책](./auth-policy.md)
- [API 명세](./api-spec.md)
- [배포 가이드](./deployment.md)
- [보안 체크리스트](./security-checklist.md)
- [문제 해결](./troubleshooting.md)
- [발표 데모 스크립트](./demo-script.md)
- [저장소 가이드](./repository-guide.md)
