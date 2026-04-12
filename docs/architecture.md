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
        -> Lambda: prompt-engine
        -> Lambda: prompt-hint
        -> Lambda: daily-word-generate
  EventBridge
    -> Lambda: daily-word-generate

Data Tier
  EC2 (services/api)
    -> RDS MySQL
  Lambda: daily-word-generate
    -> RDS MySQL
```

## 왜 3티어로 설명하는가

이 프로젝트는 `S3 + EC2 + Lambda + RDS`를 모두 사용하지만, 구조 설명은 아래처럼 하는 것이 가장 정확합니다.

- 프레젠테이션 계층
  - `CloudFront + S3`가 정적 프론트엔드를 제공
- 애플리케이션 계층
  - `ALB + EC2`가 메인 웹 API를 담당
  - Lambda가 실시간 AI 처리와 배치 자동화를 담당
- 데이터 계층
  - `RDS MySQL`이 영속 데이터를 저장

즉 Lambda는 독립된 4번째 계층이라기보다, **애플리케이션 계층 안에서 분리된 serverless 실행 컴포넌트**입니다.

## Lambda를 여러 개로 나눈 이유

### 실시간 AI Lambda

- `prompt-engine`
  - 오늘의 단어 `question_answer`
  - AI Lab `raw_prompt_lab`
- `prompt-hint`
  - 오늘의 단어 힌트 생성

현재 오늘의 단어는 실시간 요청 경로에서 예전 2단계 Lambda를 따로 호출하지 않습니다.  
이전 2단계 구조는 `prompt-engine`의 단일 `question_answer` 호출로 통합되었습니다.

### 배치/운영 Lambda

- `daily-word-generate`
  - 매일 오늘의 단어 생성
  - 관리자 수동 생성 재사용
  - RDS 직접 저장

이 함수는 실시간 질문 응답과 성격이 다릅니다.

- 실시간 반응보다 스케줄/배치에 가깝고
- RDS 저장 책임을 가지며
- EventBridge 트리거까지 고려해야 합니다

그래서 실시간 Lambda와 분리해 전용 Lambda로 유지합니다.

## 왜 `daily-word-generate`를 새로 만들었는가

가장 큰 고민은 아래 두 가지였습니다.

1. 기존 `prompt-engine`에 `daily_word_generate` operation 추가
2. 전용 Lambda를 별도로 생성

최종 선택은 **전용 Lambda 생성**입니다.

이유:

- `prompt-engine`은 실시간 질문 응답 Lambda라서 RDS 저장 책임까지 넣으면 무거워집니다.
- `daily-word-generate`는 EventBridge 스케줄, Bedrock 호출, RDS 저장까지 묶이는 배치 작업입니다.
- `EventBridge -> Lambda -> RDS` 경로가 명확해야 운영과 발표 설명이 쉬워집니다.
- 실시간 Lambda와 배치 Lambda를 분리하는 편이 장애 범위를 줄이기 쉽습니다.

## 데이터 흐름

### 일반 사용자 요청

1. 브라우저가 ALB를 통해 EC2 API 호출
2. EC2가 인증/권한/DB 조회 처리
3. 오늘의 단어 실시간 응답은 `prompt-engine(question_answer)` 호출
4. 필요하면 `prompt-hint` 또는 다른 서버 로직과 함께 결과를 조합
5. 최종 결과를 브라우저에 응답

### 오늘의 단어 자동 생성

1. EventBridge가 `daily-word-generate` 호출
2. Lambda가 카테고리와 날짜를 확정
3. Bedrock에 단어/힌트/동의어 생성을 요청
4. Lambda가 RDS에 INSERT 또는 UPDATE
5. 관리자/사용자 페이지는 저장된 결과를 조회

### 관리자 수동 생성

1. 관리자 페이지에서 자동 생성 또는 다시 생성 요청
2. EC2 API가 `daily-word-generate` Lambda 호출
3. Lambda가 같은 생성/저장 경로를 재사용
4. EC2가 결과를 조회해서 관리자 화면에 반환

## 보안 관점

- 프론트는 CloudFront를 통해 배포
- API는 ALB 뒤 EC2에서 제공
- RDS는 내부 데이터 저장소
- `prompt-engine`과 `prompt-hint`는 API 서버가 호출하는 보조 컴포넌트로 취급
- `daily-word-generate`는 RDS 접근이 필요한 Lambda이므로 네트워크/IAM/비밀값 관리가 중요

## 발표 때 설명하기 좋은 한 줄

“웹 요청은 EC2 API가 처리하고, 오늘의 단어 실시간 AI 응답은 `prompt-engine(question_answer)`가 맡으며, 매일 자동 생성되는 오늘의 단어는 EventBridge가 깨우는 `daily-word-generate`가 Bedrock과 RDS를 연결해 저장하도록 설계했습니다.”
