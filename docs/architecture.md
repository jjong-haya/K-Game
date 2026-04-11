# 아키텍처

## 전체 흐름

```text
Browser
  -> CloudFront
    -> S3 (apps/web)
  -> ALB
    -> EC2 (services/api)
      -> RDS MySQL
      -> AWS Lambda (services/lambdas/*)
```

## 책임 분리

- `apps/web`
  - 사용자 인터페이스
  - 로그인, 오늘의 단어, 프로필, 제안 화면
- `services/api`
  - 인증 세션 처리
  - DB 조회와 저장
  - Lambda 호출 어댑터
  - 관리자/헬스체크 API
- `services/lambdas`
  - AI 응답 생성
  - 답변 판정
  - 힌트 생성
- `infra/terraform`
  - AWS 리소스의 선언형 구성

## 보안 경계

- 프론트는 CloudFront를 통해 HTTPS로만 노출합니다.
- API는 ALB 뒤에서만 접근합니다.
- RDS는 private subnet 기준으로만 둡니다.
- 비밀값은 Secrets Manager 또는 SSM으로 관리하는 전제를 둡니다.

## 발표 포인트

- 기능이 아니라 책임 단위로 나뉜 구조를 설명할 수 있습니다.
- 프론트, API, DB, Lambda의 경계가 분명합니다.
- 인프라와 문서가 분리되어 있어 협업과 운영 설명이 쉽습니다.
