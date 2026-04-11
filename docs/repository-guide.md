# 저장소 가이드

이 문서는 레포 전체를 처음 보는 사람이 폴더별 역할을 바로 이해하도록 돕는 안내서입니다.

## 최상위 구조

- `apps`: 사용자 화면
- `services`: API와 Lambda 작업 단위
- `infra`: 배포와 AWS 선언
- `docs`: 평가자와 발표자를 위한 설명 문서
- `.github`: CI와 템플릿

## 폴더별 역할

### `apps/web`

- 브라우저에서 직접 보이는 화면을 담당합니다.
- 로그인, 오늘의 단어, 프롬프트 룸, 프로필, 관리 화면이 들어갑니다.
- 빌드 결과물은 배포용 정적 파일로만 사용합니다.

### `services/api`

- 세션 인증, DB 조회, 비즈니스 로직, Lambda 호출을 담당합니다.
- `routes`, `controllers`, `services`, `repositories`로 분리되어 있습니다.
- 프론트가 직접 가지면 안 되는 로직을 모읍니다.

### `services/lambdas`

- AI 응답 생성, 답변 판정, 힌트 생성 같은 단일 작업을 담당합니다.
- 각 Lambda는 독립 테스트와 README를 가집니다.

### `infra`

- `scripts`는 배포와 운영 작업을 담당합니다.
- `terraform`은 AWS 리소스의 선언형 기준을 담당합니다.

### `docs`

- 평가자용 빠른 읽기, 아키텍처, 배포, 보안, 발표, 체크리스트를 둡니다.

## 읽는 순서

1. `README.md`
2. `docs/evaluator-guide.md`
3. `docs/project-overview.md`
4. `docs/architecture.md`
5. `docs/repository-guide.md`
6. `docs/demo-script.md`
7. `docs/release-checklist.md`

## 평가자가 보는 포인트

- 파일과 폴더 이름이 영어로 정리되어 있는지
- 루트가 너무 복잡하지 않은지
- 실행과 검증 명령이 바로 보이는지
- 문서가 설명만 많고 실제 구조와 안 맞지 않는지
- 공개 저장소에 올라가면 안 되는 것이 빠져 있는지

## 공개 기준

- 예시 파일만 Git에 둡니다.
- 비밀값은 문서에 직접 쓰지 않습니다.
- 불필요한 산출물과 개인용 임시 파일은 제외합니다.
- 새로운 파일을 추가할 때는 먼저 이 구조에 어디에 들어가는지부터 결정합니다.
