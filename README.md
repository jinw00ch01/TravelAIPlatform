# AI 여행 서비스 플랫폼 - 서버리스 백엔드

이 프로젝트는 AWS SAM(Serverless Application Model)을 사용하여 구축된 AI 여행 서비스 플랫폼의 서버리스 백엔드입니다.

## 기능

- 사용자 여행 계획 관리 (생성, 조회, 수정, 삭제)
- 여행 계획 공유 기능
- 이미지 기반 여행 계획 생성
- AWS Rekognition을 활용한 이미지 분석
- OpenAI API를 활용한 여행 계획 생성

## 기술 스택

- AWS Lambda
- Amazon DynamoDB
- Amazon S3
- Amazon API Gateway
- AWS Rekognition
- AWS SAM (Serverless Application Model)
- Node.js

## 설치 및 배포

### 사전 요구사항

- [AWS CLI](https://aws.amazon.com/cli/) 설치 및 구성
- [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html) 설치
- [Node.js](https://nodejs.org/) 설치

### 로컬 개발 환경 설정

1. 프로젝트 클론
```bash
git clone <repository-url>
cd travel-ai-platform/serverless
```

2. 의존성 설치
```bash
npm install
```

3. 로컬에서 API 실행
```bash
npm run start-local
```

### AWS 배포

1. SAM 빌드
```bash
npm run build
```

2. SAM 배포
```bash
npm run deploy
```
첫 배포 시 필요한 설정을 입력하라는 메시지가 표시됩니다. 이후 배포에서는 저장된 설정을 사용합니다.

## 프로젝트 구조

```
serverless/
├── functions/               # Lambda 함수
│   ├── travel-plan/         # 여행 계획 관련 함수
│   │   ├── create.js        # 여행 계획 생성
│   │   ├── get.js           # 여행 계획 조회
│   │   ├── list.js          # 여행 계획 목록 조회
│   │   ├── update.js        # 여행 계획 수정
│   │   ├── delete.js        # 여행 계획 삭제
│   │   └── share.js         # 여행 계획 공유
│   └── image-search/        # 이미지 검색 관련 함수
│       └── search.js        # 이미지 기반 여행 계획 생성
├── lib/                     # 공통 라이브러리
├── template.yaml            # SAM 템플릿
└── package.json             # 프로젝트 메타데이터 및 의존성
```

## API 엔드포인트

배포 후 AWS CloudFormation 출력에서 API Gateway 엔드포인트 URL을 확인할 수 있습니다.

### 여행 계획 API

- `POST /travel-plans` - 새 여행 계획 생성
- `GET /travel-plans` - 사용자의 모든 여행 계획 조회
- `GET /travel-plans/{planId}` - 특정 여행 계획 조회
- `PUT /travel-plans/{planId}` - 여행 계획 업데이트
- `DELETE /travel-plans/{planId}` - 여행 계획 삭제
- `POST /travel-plans/{planId}/share` - 여행 계획 공유

### 이미지 검색 API

- `POST /image-search` - 이미지 기반 여행 계획 생성

## 환경 변수

Lambda 함수에서 사용되는 주요 환경 변수:

- `TRAVEL_PLANS_TABLE` - 여행 계획 DynamoDB 테이블 이름
- `IMAGES_BUCKET` - 이미지 저장용 S3 버킷 이름
- `FRONTEND_URL` - 프론트엔드 애플리케이션 URL (공유 링크 생성용)
- `OPENAI_API_KEY` - OpenAI API 키

## 라이센스

ISC 