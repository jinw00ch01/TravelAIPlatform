<think>사용자가 요청한 내용은 프로젝트의 README.md 파일에 다른 개발자들을 위한 배포 안내와 프로젝트 구조 설명을 추가하는 것입니다. 기존 README.md 파일을 기반으로 보완하여 로컬 환경 설정 방법과 각 파일의 역할에 대해 더 상세히 설명하는 내용을 작성해야 합니다.

기존 README.md 파일은 주로 서버리스 백엔드에 초점이 맞춰져 있으므로, 프론트엔드 부분에 대한 설명과 전체 프로젝트 구조에 대한 설명을 추가해야 합니다. 또한 로컬 환경 설정 방법에 대해 더 상세히 안내해야 합니다.

이를 위해 다음과 같은 내용을 포함시킬 예정입니다:
1. 프로젝트 소개 및 구조
2. 기술 스택 (프론트엔드 + 백엔드)
3. 설치 및 로컬 환경 설정 방법
4. 로컬 개발 방법
5. 배포 방법
6. 주요 파일 및 디렉토리 설명
7. 기타 유용한 정보

이 내용을 README.md 파일에 한국어로 작성하겠습니다.</think># AI 여행 서비스 플랫폼

## 프로젝트 개요

이 프로젝트는 AI 에이전트를 활용한 여행 서비스 플랫폼으로, 사용자가 텍스트나 이미지를 통해 여행 계획을 생성하고 관리할 수 있는 서비스입니다. AWS 서버리스 아키텍처를 기반으로 하여 확장성과 비용 효율성을 갖추고 있습니다.

## 기술 스택

### 프론트엔드
- React.js (SPA 구조)
- Tailwind CSS (UI 스타일링)
- React Router (라우팅)
- React Query (데이터 페칭)
- AWS Amplify (AWS 서비스 연동)

### 백엔드
- AWS Lambda
- Amazon API Gateway
- Amazon DynamoDB
- Amazon S3
- AWS Cognito
- AWS Rekognition
- AWS SAM (Serverless Application Model)
- Node.js

### AI/ML 서비스
- OpenAI API (GPT 모델)
- AWS Rekognition (이미지 분석)

## 설치 및 로컬 환경 설정

### 사전 요구사항
- Node.js 18.x 이상
- npm 또는 yarn
- AWS CLI 설치 및 구성
- AWS SAM CLI 설치
- OpenAI API 키

### 1. 프로젝트 클론
```bash
git clone https://github.com/your-username/travel-ai-platform.git
cd travel-ai-platform
```

### 2. 환경 변수 설정
`.env.example` 파일을 복사하여 `.env` 파일 생성:
```bash
cp .env.example .env
```

`.env` 파일을 열고 필요한 값 입력:
```
REACT_APP_API_URL=http://localhost:3000/api
REACT_APP_COGNITO_REGION=ap-northeast-2
REACT_APP_COGNITO_USER_POOL_ID=your-user-pool-id
REACT_APP_COGNITO_APP_CLIENT_ID=your-app-client-id
REACT_APP_COGNITO_IDENTITY_POOL_ID=your-identity-pool-id
REACT_APP_S3_BUCKET=your-s3-bucket
```

### 3. 프론트엔드 의존성 설치
```bash
npm install
```

### 4. 백엔드 의존성 설치
```bash
cd serverless
npm install
```

### 5. AWS 파라미터 스토어에 OpenAI API 키 설정
```bash
aws ssm put-parameter --name "/travel-ai/openai-api-key" --type "SecureString" --value "your-openai-api-key"
```

## 로컬 개발 환경 실행

### 1. 프론트엔드 실행
프로젝트 루트 디렉토리에서:
```bash
npm start
```
이렇게 하면 React 앱이 개발 모드로 실행되며 `http://localhost:3000`에서 확인할 수 있습니다.

### 2. 백엔드 실행
`serverless` 디렉토리에서:
```bash
npm run start-local
```
이 명령은 AWS SAM CLI를 사용하여 로컬에서 Lambda 함수와 API Gateway를 에뮬레이션합니다.

## 배포 방법

### 1. 프론트엔드 배포
```bash
npm run build
```
생성된 `build` 디렉토리를 AWS S3 버킷에 업로드하고 필요한 경우 CloudFront 배포를 설정할 수 있습니다.

### 2. 백엔드 배포
`serverless` 디렉토리에서:
```bash
npm run build
npm run deploy
```
첫 배포 시 필요한 설정을 입력하라는 메시지가 표시됩니다. 이후 배포에서는 저장된 설정을 사용합니다.

## 프로젝트 구조 및 파일 설명

### 루트 디렉토리
```
travel-ai-platform/
├── public/                  # 정적 파일
├── src/                     # 프론트엔드 소스 코드
├── serverless/              # 백엔드 서버리스 코드
├── package.json             # 프론트엔드 의존성 및 스크립트
├── postcss.config.js        # PostCSS 설정
├── tailwind.config.js       # Tailwind CSS 설정
└── README.md                # 프로젝트 문서
```

### 프론트엔드 구조 (`src/`)
```
src/
├── components/              # 재사용 가능한 컴포넌트
│   ├── auth/                # 인증 관련 컴포넌트
│   ├── layout/              # 레이아웃 컴포넌트 (Navbar, Footer 등)
│   └── travel/              # 여행 관련 컴포넌트
├── pages/                   # 페이지 컴포넌트
│   ├── Home.js              # 홈페이지
│   ├── Dashboard.js         # 사용자 대시보드
│   ├── PlanTravel.js        # 여행 계획 생성 페이지
│   └── ViewItinerary.js     # 여행 일정 조회 페이지
├── services/                # 외부 서비스 연동
│   ├── api.js               # API 호출 함수
│   ├── firebase.js          # Firebase 연동
│   └── amplify.js           # AWS Amplify 설정
├── utils/                   # 유틸리티 함수
│   ├── auth.js              # 인증 관련 유틸리티
│   └── dateUtils.js         # 날짜 관련 유틸리티
├── App.js                   # 메인 앱 컴포넌트
└── index.js                 # 앱 엔트리 포인트
```

### 백엔드 구조 (`serverless/`)
```
serverless/
├── functions/               # Lambda 함수
│   ├── travel-plan/         # 여행 계획 관련 함수
│   ├── image-search/        # 이미지 검색 관련 함수
│   └── auth/                # 인증 관련 함수
├── template.yaml            # SAM 템플릿
└── package.json             # 백엔드 의존성 및 스크립트
```

## 주요 파일 설명

### 프론트엔드 파일
- `src/App.js`: 앱의 메인 컴포넌트와 라우팅 설정
- `src/components/auth/AuthContext.js`: 인증 상태 관리를 위한 컨텍스트
- `src/components/layout/Navbar.js`: 네비게이션 바 컴포넌트
- `src/pages/Home.js`: 홈페이지 컴포넌트
- `src/pages/PlanTravel.js`: 여행 계획 생성 페이지
- `src/utils/auth.js`: AWS Cognito 인증 관련 유틸리티 함수
- `src/services/api.js`: 백엔드 API 호출 함수

### 백엔드 파일
- `serverless/template.yaml`: AWS SAM 템플릿으로 인프라 정의
- `serverless/functions/travel-plan/create.js`: 여행 계획 생성 Lambda 함수
- `serverless/functions/image-search/search.js`: 이미지 기반 여행 계획 생성 Lambda 함수
- `serverless/functions/auth/post-confirmation.js`: Cognito 회원가입 후처리 Lambda 함수

## API 엔드포인트

백엔드 배포 후 AWS CloudFormation 출력에서 API Gateway 엔드포인트 URL을 확인할 수 있습니다.

### 여행 계획 API
- `POST /travel-plans` - 새 여행 계획 생성
- `GET /travel-plans` - 사용자의 모든 여행 계획 조회
- `GET /travel-plans/{planId}` - 특정 여행 계획 조회
- `PUT /travel-plans/{planId}` - 여행 계획 업데이트
- `DELETE /travel-plans/{planId}` - 여행 계획 삭제
- `POST /travel-plans/{planId}/share` - 여행 계획 공유

### 이미지 검색 API
- `POST /image-search` - 이미지 기반 여행 계획 생성

## 문제 해결

### 일반적인 문제
- **API 연결 오류**: `.env` 파일에 올바른 API 엔드포인트가 설정되어 있는지 확인하세요.
- **인증 오류**: Cognito 설정이 올바른지 확인하고, AWS 콘솔에서 사용자 풀을 확인하세요.
- **Lambda 함수 오류**: CloudWatch 로그를 확인하여 오류 원인을 파악하세요.

### 로컬 개발 시 알려진 문제
- 로컬에서 Cognito 인증을 사용할 때 CORS 오류가 발생할 수 있습니다. 이 경우 `.env` 파일에서 `REACT_APP_API_URL`을 확인하세요.
- 이미지 업로드 시 로컬 개발 환경에서는 S3 연동이 제한될 수 있습니다. AWS 계정에 올바른 권한이 설정되어 있는지 확인하세요.

## 기여 방법

1. 이 저장소를 포크합니다.
2. 기능 브랜치를 생성합니다 (`git checkout -b feature/amazing-feature`).
3. 변경 사항을 커밋합니다 (`git commit -m 'Add some amazing feature'`).
4. 브랜치에 푸시합니다 (`git push origin feature/amazing-feature`).
5. Pull Request를 생성합니다.

## 라이센스

ISC

## 연락처

프로젝트 관리자: [이메일 주소]

프로젝트 링크: [GitHub 저장소 URL]
