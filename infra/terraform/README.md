# Terraform

이 폴더는 AWS 핵심 인프라를 선언형으로 설명하기 위한 골격입니다.

## 예상 리소스

- `S3` + `CloudFront` + `OAC`
- `ALB` + `EC2`
- `RDS MySQL`
- `Security Group`
- `IAM Role / Instance Profile`
- `CloudWatch Log Group / Alarm`

## 작성 원칙

- 환경별 값은 `terraform.tfvars.example`로 설명합니다.
- private subnet과 public subnet 분리를 전제로 합니다.
- 운영 비밀은 Terraform 코드에 직접 넣지 않습니다.
