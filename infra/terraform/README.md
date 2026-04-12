# Terraform

이 폴더는 AWS 핵심 인프라를 선언형으로 설명하기 위한 기준입니다.

## 예상 리소스

- `storage.tf`
  - `S3` + `CloudFront` + `OAC`
- `compute.tf`
  - `ALB` + `EC2`
- `database.tf`
  - `RDS MySQL`
- `lambda_daily_word.tf`
  - 오늘의 단어 자동 생성 Lambda 관련 리소스
- `monitoring.tf`
  - `CloudWatch Log Group / Alarm`
- 공통
  - `Security Group`
  - `IAM Role / Instance Profile`

## 작성 원칙

- 환경별 값은 `terraform.tfvars.example`로 설명합니다.
- public subnet과 private subnet 분리를 전제로 합니다.
- 운영 비밀은 Terraform 코드에 직접 넣지 않습니다.
- 웹, API, DB, 자동 생성 배치의 핵심 경계가 문서와 코드에서 같은 방향으로 읽히도록 유지합니다.
