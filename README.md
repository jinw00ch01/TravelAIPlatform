# Wind Road - AI 맞춤형 여행 일정 생성 플랫폼

## 시연영상

[![Watch the video](https://img.youtube.com/vi/RzQJm9uAX0c/hqdefault.jpg)](https://youtu.be/RzQJm9uAX0c)


## 프로젝트 개요

Wind Road는 Gemini AI 에이전트를 활용하여 사용자 맞춤형 여행 계획을 자동으로 생성하는 AWS 서버리스 아키텍처 기반의 지능형 여행 지원 플랫폼입니다. 사용자가 원하는 여행 스타일, 기간, 인원, 항공편 및 숙소 정보를 입력하면, AI가 실제 존재하는 장소와 현실적인 동선을 고려하여 상세 일정을 제공합니다. 생성된 일정은 사용자 계정과 연동되어 데이터베이스에 저장되며, 항공편(도착 및 출발 시간, 공항 위치)과 숙소(체크인 및 체크아웃 시간, 숙소 위치) 정보를 고려한 최적화된 여행 경험을 선사합니다. 모바일 버전도 함께 제공하여 언제 어디서든 편리하게 이용할 수 있습니다.

## 주요 기능

*   **AI 기반 맞춤형 여행 일정 생성**: 사용자의 요구사항(여행 스타일, 기간, 인원 등)에 맞춰 Gemini AI가 최적의 여행 일정 제안
*   **항공편 및 숙소 정보 연동**: Amadeus Self-Service API (항공편) 및 Booking.com API (호텔) 연동을 통해 실시간 정보 반영 및 예약 지원
*   **현실적인 동선 고려**: 실제 장소 및 이동 시간을 고려한 현실적인 여행 계획 수립
*   **지도 연동**: Mapbox API를 활용한 지도 기능으로 일정 시각화 및 경로 안내
*   **사용자 계정 연동 및 일정 저장**: 생성된 여행 일정을 사용자 계정에 안전하게 저장하고 언제든지 다시 확인 가능
*   **모바일 최적화**: 모바일 환경에서도 모든 기능을 편리하게 사용 --> https://github.com/Euno6910/TravelAIPlatform-Mobile

## 기술 스택

### 프론트엔드
*   React.js
*   Tailwind CSS
*   React Router
*   React Query
*   AWS Amplify (AWS 서비스 연동)

### 백엔드
*   AWS Lambda
*   AWS API Gateway
*   AWS DynamoDB
*   AWS Cognito (사용자 인증 및 관리)
*   Node.js (v20.0.0 이상 권장)
    *   `@aws-sdk/client-dynamodb`
    *   `@aws-sdk/client-s3`
    *   `@aws-sdk/client-lambda`
    *   `@aws-sdk/client-cognito-identity-provider`
    *   `axios`
    *   `dotenv`
    *   `uuid`
*   Python

### AI/ML 서비스
*   Google Gemini API

### 데이터베이스
*   AWS DynamoDB

### 외부 API
*   Amadeus Self-Service APIs (항공편 검색)
*   Booking.com API (Rapid API 기반 호텔 검색)
*   Mapbox API (지도 기능)

### 개발 도구 및 환경
*   Visual Studio Code
*   Android Studio
*   AWS Management Console
*   Windows

## 프로젝트 구조

### 루트 디렉토리
```
TravelPlatformAI/
├── public/                  # 정적 파일 (index.html, favicon 등)
├── src/                     # 프론트엔드 소스 코드 (React)
│   ├── components/          # 재사용 가능한 UI 컴포넌트
│   ├── pages/               # 페이지 단위 컴포넌트
│   ├── services/            # API 호출 등 서비스 로직
│   ├── utils/               # 유틸리티 함수
│   ├── lib/                 # 라이브러리 또는 주요 로직
│   ├── App.js               # 메인 애플리케이션 컴포넌트
│   ├── index.js             # 애플리케이션 진입점
│   └── index.css            # 전역 CSS
├── serverless/              # 백엔드 서버리스 코드 (AWS Lambda 등)
│   ├── API gateway/         # API Gateway 관련 설정 및 Lambda 함수 (Node.js)
│   ├── Cognito_Trigger_Lambda/ # Cognito Trigger Lambda 함수 (Node.js)
│   └── test/                # 테스트 코드
│   
│   
├── package.json             # 프론트엔드 의존성 및 스크립트
└── README.md                # 프로젝트 문서
```

## 설치 및 로컬 환경 설정

### 사전 요구사항
*   Node.js (20.0.0 이상)
*   npm 또는 yarn
*   AWS CLI 설치 및 구성 (AWS 서비스 관리를 위해)
*   Google Cloud SDK 설치 및 구성 (Gemini API 사용을 위해)
*   Python (AI 모듈 또는 Python Lambda 사용 시, 버전 명시 필요, 예: 3.9 이상)
*   pip (Python 패키지 관리자, Python 사용 시)

### 1. 프로젝트 클론
```bash
git clone [여기에 프로젝트 Git 저장소 URL을 입력하세요]
cd TravelPlatformAI
```

### 2. 환경 변수 설정
루트 디렉토리의 `src` 폴더 내 또는 프로젝트 설정에 따라 적절한 위치에 `.env` 파일을 생성하고 다음 내용을 입력합니다. (프론트엔드용)
```env
REACT_APP_API_URL=[배포된 백엔드 API Gateway Endpoint URL]
REACT_APP_COGNITO_REGION=[AWS Cognito Region, 예: ap-northeast-2]
REACT_APP_COGNITO_USER_POOL_ID=[Cognito User Pool ID]
REACT_APP_COGNITO_APP_CLIENT_ID=[Cognito App Client ID]
REACT_APP_MAPBOX_API_KEY=[Mapbox API Key]

# Google Gemini API 키 (프론트엔드에서 직접 호출 시. 백엔드 호출 권장)
# REACT_APP_GEMINI_API_KEY=[Gemini API Key] 
```

**백엔드 Lambda 환경 변수:**
*   AWS Lambda 함수의 환경 변수는 AWS Management Console을 통해 각 함수별로 설정합니다.
*   `GOOGLE_APPLICATION_CREDENTIALS`: Gemini API 등 Google Cloud 서비스 사용 시, 로컬 개발 환경에서는 서비스 계정 키 JSON 파일 경로를 이 환경 변수에 설정할 수 있습니다. **AWS Lambda 환경에서는 IAM 역할을 통해 권한을 부여하는 것이 보안상 권장됩니다.**
*   기타 필요한 API 키 (Amadeus, Booking.com 등)도 Lambda 함수 환경 변수로 설정합니다.

### 3. 프론트엔드 의존성 설치
```bash
# TravelPlatformAI 루트 디렉토리에서 실행
npm install
# 또는
# yarn install
```

### 4. 백엔드 의존성 설치 및 패키징 (Lambda 함수 배포 시)

각 AWS Lambda 함수(Node.js)는 필요한 모듈을 포함하여 패키징되어야 합니다.

*   **로컬 개발/테스트 시**: 각 개별 Lambda 함수 폴더(예: `serverless/API gateway/user/someFunction/`)로 이동하여 해당 함수에 필요한 npm 모듈을 `npm install <module_name>`으로 설치할 수 있습니다. `serverless/package.json`은 프로젝트 전체의 Node.js 백엔드 공통 의존성을 참고하는 용도로 활용될 수 있으나, 각 Lambda 함수는 자체적으로 필요한 최소한의 의존성만 갖도록 패키징하는 것이 좋습니다.
*   **ZIP 파일 업로드 방식 (AWS Console 사용 시)**:
    1.  Lambda 함수 코드와 해당 함수 실행에 필요한 `node_modules` 폴더를 함께 ZIP 파일로 압축합니다.
        *   `@aws-sdk/*` 계열 모듈은 대부분 Lambda 실행 환경에 이미 포함되어 있거나 포함될 예정이므로, 특별한 버전이 필요한 경우가 아니면 패키징에서 제외하여 용량을 줄일 수 있습니다.
    2.  AWS Lambda 콘솔에서 함수를 생성/업데이트하며 준비된 ZIP 파일을 업로드합니다.
*   **Lambda 레이어 활용**: 여러 함수에서 공통으로 사용되는 라이브러리(예: `axios`, `uuid` 등 `serverless/package.json`의 `dependencies` 참고)는 Lambda 레이어로 만들어 공유할 수 있습니다.

**Python Lambda 함수 (사용 시):**
*   Python 런타임을 사용하는 Lambda 함수의 경우, `requirements.txt` 파일에 의존성을 명시하고, 배포 패키지에 이를 포함시킵니다.
    ```bash
    # 예시: 함수 폴더 내에 의존성 설치 및 패키징
    pip install -r requirements.txt -t ./package
    # 이후 ./package 폴더와 .py 파일들을 함께 압축
    ```

## 로컬 개발 환경 실행

### 1. 프론트엔드 실행
```bash
# TravelPlatformAI 루트 디렉토리에서 실행
npm start
# 또는
# yarn start
```
브라우저에서 `http://localhost:3000` (또는 다른 포트)으로 접속합니다.

### 2. 백엔드 함수 테스트 (로컬)

AWS Lambda 함수는 AWS Management Console에서 직접 테스트하거나, 로컬 환경에서 개별 함수를 실행하여 테스트할 수 있습니다.

*   **Node.js 함수**: 각 함수 파일이 있는 폴더로 이동하여 `node yourFunctionFileName.js` 와 같이 직접 실행합니다. (실제 Lambda 호출 시 전달되는 `event` 객체와 `context` 객체를 모의(mocking)하여 테스트해야 합니다.)
*   **Python 함수**: 유사하게 Python 인터프리터를 사용하여 로컬에서 테스트합니다. (Lambda `event`, `context` 모의 필요)

API Gateway 연동을 포함한 전체 흐름 테스트는 AWS에 배포 후 API Gateway 엔드포인트를 통해 수행하는 것이 정확합니다.

## 배포 방법

### 1. 프론트엔드 배포 (AWS Amplify 또는 S3 + CloudFront)
```bash
# TravelPlatformAI 루트 디렉토리에서 실행
npm run build
```
생성된 `build` 폴더의 내용을 AWS Amplify에 연결하여 CI/CD를 구성하거나, 수동으로 S3 버킷에 업로드하고 CloudFront를 통해 배포합니다.

### 2. 백엔드 배포 (AWS Management Console)

본 프로젝트의 백엔드 Lambda 함수 및 API Gateway는 AWS Management Console을 통해 직접 구성하고 배포합니다.

**Lambda 함수 배포:**
1.  AWS Lambda 콘솔에 접속합니다.
2.  새 함수를 생성하거나 기존 함수를 업데이트합니다.
3.  런타임 (예: Node.js 20.x, Python 3.x 등)을 선택합니다.
4.  함수 코드는 위 "백엔드 의존성 설치 및 패키징" 섹션에서 설명한 방법으로 준비된 ZIP 파일을 업로드하거나, 콘솔 내 편집기를 사용하여 작성/수정합니다.
5.  필요한 환경 변수, IAM 역할 (적절한 권한 포함), 메모리, 제한 시간 등을 설정합니다.

**API Gateway 설정:**
1.  Amazon API Gateway 콘솔에 접속합니다.
2.  REST API 또는 HTTP API를 생성하거나 기존 API를 선택합니다.
3.  리소스 (예: `/users`, `/travel-plans/{planId}`) 및 HTTP 메서드 (예: GET, POST, PUT, DELETE)를 정의합니다.
4.  각 메서드의 통합 요청 유형으로 "Lambda 함수"를 선택하고, 해당 기능을 수행하는 Lambda 함수를 지정합니다.
5.  필요에 따라 요청/응답 템플릿 매핑, 권한 부여 (예: Cognito 사용자 풀 권한 부여자 연동) 등을 설정합니다.
6.  API를 특정 스테이지(예: `dev`, `v1`, `prod`)로 배포하고, 생성된 호출 URL을 확인합니다. 이 URL이 프론트엔드의 `.env` 파일에 `REACT_APP_API_URL` 값으로 사용됩니다.

## API 엔드포인트

API Gateway를 통한한 엔드포인트입니다. 

*   `POST /api/AeroDataBox/GetAirportInfo` - 공항 명칭 가져오는 함수 (IATA 또는 ICAO 코드로 검색된 공항 정보, 이름, 위치, 행정 정보, 고도 등)
*   `POST /api/Booking-com/SearchHotelsByCoordinates` - Booking.com API의 SearchHotelsByCoordinates 기능과 Room List Of the Hotel을 호출하는 함수
*   `GET /api/amadeus/AirlineCodeLookup` - 항공사의 IATA 또는 ICAO 코드를 사용하여 해당 항공사의 정식 명칭(Business Name) 및 일반 명칭(Common Name)을 조회하는 함수
*   `GET /api/amadeus/Airport_CitySearch` - 사용자가 입력한 키워드(문자열)와 일치하는 공항 및/또는 도시 목록을 검색하는 함수
*   `POST /api/amadeus/FlightOffersPrice` - Flight Offers Search API를 통해 받은 특정 항공편 제안(Flight Offer)의 실시간 가격과 좌석 유효성을 확인하고 최종 확정하는 함수
*   `POST /api/amadeus/FlightOffersSearch` - 사용자가 지정한 조건(출발/도착지, 날짜, 승객 수, 선호 클래스 등)에 맞는 항공편 상품을 검색하는 함수
*   `POST /api/amadeus/Flight_Inspiration_Search` - 특정 도시에서 출발하는 가장 저렴한 항공권의 목적지를 찾아 사용자의 여행 계획 영감(Inspiration)을 돕는 함수. 어디로 가야 할지 정하지 못한 사용자에게 가격 기준으로 여행지를 추천하는 데 사용함.
*   `POST /api/amadeus/Flight_Most_Traveled_Destinations` - 특정 도시에서 출발한 여행객들이 실제로 가장 많이 방문한(이동한) 목적지를 파악하여 현지 여행 트렌드에 대한 통찰력을 제공하는 함수
*   `POST /api/amadeus/Tours_and_Activities ` - 전 세계 여러 장소의 액티비티, 관광 투어, 당일 여행, 박물관 티켓 등을 검색하고 예약(외부 링크 제공)할 수 있도록 지원하는 함수
*   `POST /api/travel/LoadPlanFunction_NEW`
*   `POST /api/travel/checklist`
*   `POST /api/travel/checkplan`
*   `POST /api/travel/modify_python`
*   `POST /api/travel/save`
*   `GET /api/user/mypage`
*   `PUT /api/user/profile`


## 기대 효과

1.  **효율적인 여행 계획**: 외부 API(항공, 숙박)와 Google Gemini AI의 결합으로, 사용자는 분산된 정보를 일일이 탐색할 필요 없이 한 곳에서 모든 여행 계획을 효율적으로 완성할 수 있습니다.
2.  **합리적인 여행 준비**: 실시간 항공권 및 호텔 정보를 반영한 AI 추천은 최적의 가격과 조건을 제시하여 합리적인 여행 준비를 가능하게 하며, 숨겨진 장소 발견의 기회도 제공합니다.
3.  **시간 및 노력 절약**: 복잡한 예약 과정과 일정 조율의 어려움을 AI가 자동 처리함으로써 사용자의 시간과 노력을 절약하고, 여행 자체에 더 집중할 수 있는 환경을 조성하여 여행 만족도를 크게 향상시킵니다.

## 팀원 소개 및 역할

*   **최진우**: 항공편 및 숙박 관련 기능 구현(백엔드 로직 구현 및 배포, UI 설계 및 구축, 외부 API 연동), DB 설계 및 구축, AI 모듈 개발
*   **민동현**: 숙박 및 지도 관련 기능 구현(백엔드 로직 구현 및 배포, UI 설계 및 구축, 외부 API연동)
*   **이은호**: 모바일 어플리케이션 버전 개발, 백엔드 로직 구현 및 배포
*   **유관호**: 콘텐츠 및 항공편 관련 기능 구현(백엔드 로직 구현 및 배포, UI 설계 및 구축, 외부 API 연동)
*   **황지환**: AI 모듈 개발, 서버 데이터 구조 설계, DB 설계 및 구축, 백엔드 로직 구현 및 배포

## 라이센스

ISC

## 연락처

*   **팀명**: 바람길(Wind Road)
*   **문의**: herofactorycjw1998@gmail.com
