# Deployment Scripts

이 폴더는 GitHub 공개 기준에서 읽기 쉬운 이름으로 정리한 운영 스크립트를 담습니다.

## 파일

- `deploy-web.ps1`: `apps/web` 빌드 후 S3 동기화
- `deploy-lambdas.ps1`: `services/lambdas/*` 패키징 후 Lambda 업로드
- `apply-db-schema.ps1`: `services/api/sql/schema.sql` 반영
- `apply-db-dev-seed.ps1`: 개발용 seed 데이터만 반영
- `bootstrap-api.sh`: EC2 초기 패키지/런타임 설치
- `deploy-api.sh`: EC2 서버 릴리스 배포, 검증, 롤백
- `rollback-api.sh`: 마지막 정상 릴리스로 되돌림
- `health-check.sh`: API 헬스 엔드포인트 확인
- `nginx-api.conf`: Nginx 리버스 프록시 예시

## 기준

- 이전 루트 배포 폴더 표기는 더 이상 문서에서 사용하지 않습니다.
- 스크립트는 새 monorepo 경로만 참조합니다.
- DB schema와 dev seed는 절대 한 번에 적용하지 않습니다.
