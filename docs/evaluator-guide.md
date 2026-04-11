# 평가자 가이드

이 문서는 GitHub 저장소를 처음 보는 평가자, 교수님, 심사자가 가장 빨리 구조를 파악하도록 만든 빠른 읽기 안내서입니다.

## 먼저 볼 순서

1. [README.md](../README.md)
2. [docs/project-overview.md](./project-overview.md)
3. [docs/architecture.md](./architecture.md)
4. [docs/repository-guide.md](./repository-guide.md)
5. [docs/demo-script.md](./demo-script.md)
6. [docs/release-checklist.md](./release-checklist.md)

## 한눈에 보는 강점

- 프론트, API, Lambda, DB, 인프라가 폴더와 역할 기준으로 분리되어 있습니다.
- GitHub 공개 저장소에 불필요한 산출물과 비밀값을 남기지 않도록 정리했습니다.
- 발표용 문서와 운영용 문서를 따로 두어 설명 순서가 명확합니다.
- 배포 스크립트와 Terraform 예시가 있어 재현성을 보여줄 수 있습니다.

## 평가할 때 보면 좋은 지점

- 구조가 `apps / services / infra / docs / .github`로 단순하게 읽히는지
- 인증과 세션이 브라우저 저장소가 아니라 서버 기준으로 설계되었는지
- S3, EC2, RDS, Lambda의 역할이 겹치지 않고 분리되어 있는지
- README만 읽어도 실행과 검증이 가능한지
- 데모 스크립트만 봐도 발표 흐름이 잡히는지

## 빠른 체크 항목

- 루트 README에 아키텍처 다이어그램이 있는지
- GitHub Actions 배지가 보이는지
- 실행 명령과 검증 명령이 분리되어 있는지
- 공개 전에 지워야 할 파일이 문서로 안내되는지
- 발표 전 체크리스트가 따로 있는지

## 심사자에게 말하면 좋은 핵심

- 이 프로젝트는 기능 구현뿐 아니라 공개 저장소 품질까지 같이 맞췄습니다.
- 보안은 비밀값 제거, 세션 쿠키, 최소 공개 범위, 문서 분리를 기준으로 정리했습니다.
- 운영은 `S3 / CloudFront`, `EC2`, `RDS`, `Lambda`로 나눠 설명할 수 있습니다.
- 발표는 `README -> architecture -> repository-guide -> demo-script` 순으로 보면 됩니다.
