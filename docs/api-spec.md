# API 명세

## 공통 규약

- Base path: `/api`
- 성공 응답: `{ "ok": true, "data": ... }`
- 실패 응답: `{ "ok": false, "code": "...", "message": "..." }`

## 인증

- `POST /api/auth/guest`
- `POST /api/auth/login`
- `POST /api/auth/social/exchange`
- `GET /api/auth/session`
- `POST /api/auth/logout`

## Daily Word

- `GET /api/word/daily`
- `POST /api/word/daily/join`
- `POST /api/word/daily/answer`
- `GET /api/word/daily/leaderboard`

## Prompt Room

- `GET /api/prompt-rooms`
- `GET /api/prompt-rooms/:roomId`
- `POST /api/prompt-rooms/:roomId/attempts`

## 관리 / 제안

- `GET /api/admin/proposals`
- `POST /api/proposals`

## 헬스체크

- `GET /api/health`

## 에러 코드 예시

- `auth_required`
- `validation_error`
- `not_found`
- `internal_error`
