# 아키텍처

## 전체 흐름

```text
Presentation Tier
  Browser
    -> CloudFront
      -> S3 (apps/web)

Application Tier
  Browser
    -> ALB
      -> EC2 (services/api)
        -> AWS Lambda (services/lambdas/*)

Data Tier
  EC2 (services/api)
    -> RDS MySQL
```

## 3티어 설명

이 프로젝트는 `S3 + EC2 + Lambda + RDS`를 사용하지만, 계층 관점으로는 다음과 같이 설명하는 것이 맞습니다.

- 프레젠테이션 계층
  - 브라우저가 CloudFront와 S3에서 정적 프론트엔드를 전달받습니다.
- 애플리케이션 계층
  - 동적 요청은 ALB를 통해 EC2의 Express API로 들어갑니다.
  - EC2는 핵심 비즈니스 로직을 처리하고, AI 응답/힌트/판정처럼 분리 가능한 계산 작업은 Lambda에 위임합니다.
- 데이터 계층
  - 영속 데이터는 RDS MySQL에 저장합니다.

즉, Lambda는 독립된 별도 tier라기보다 **애플리케이션 계층 안에서 EC2 API를 보조하는 serverless 실행 컴포넌트**입니다.

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

## 현재 구현에서 정직하게 설명해야 하는 부분

- Terraform은 현재 S3, CloudFront, ALB, EC2, RDS 같은 핵심 인프라를 선언합니다.
- Lambda는 현재 Terraform 리소스로 선언된 상태가 아니라, 별도 배포 스크립트 기준으로 관리합니다.
- 따라서 발표나 README에서는 `핵심 인프라는 Terraform으로 관리하고, Lambda 배포는 스크립트로 운영한다`고 설명하는 것이 가장 정확합니다.

## 발표 포인트

- 기능이 아니라 책임 단위로 나뉜 구조를 설명할 수 있습니다.
- 프론트, API, DB, Lambda의 경계가 분명합니다.
- 인프라와 문서가 분리되어 있어 협업과 운영 설명이 쉽습니다.
